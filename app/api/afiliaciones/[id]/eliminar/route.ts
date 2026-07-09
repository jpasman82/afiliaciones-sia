import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { adminApp, adminDb } from '@/app/lib/firebaseAdmin';
import { requireRole } from '@/app/api/_auth';

export const dynamic = 'force-dynamic';

const ROLES_PERMITIDOS = ['admin', 'supervisor', 'afiliador'];

function estadoPendiente(data: FirebaseFirestore.DocumentData) {
  return !data.estadoControl || data.estadoControl === 'pendiente';
}

function esArchivoDniBorrable(path: unknown, ficha: FirebaseFirestore.DocumentData): path is string {
  if (typeof path !== 'string' || !path) return false;
  if (path.startsWith(`dnis/${ficha.afiliadorUid}/`)) return true;
  if (ficha.linkToken && path.startsWith(`dnisPublicos/${ficha.linkToken}/`)) return true;
  return false;
}

function esArchivoFichaBorrable(path: unknown, fichaId: string): path is string {
  return typeof path === 'string' && path.startsWith(`fichas/${fichaId}/`);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!adminDb || !adminApp) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const auth = await requireRole(request, ROLES_PERMITIDOS);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  }

  const fichaRef = adminDb.collection('afiliaciones').doc(id);
  const fichaSnap = await fichaRef.get();
  if (!fichaSnap.exists) {
    return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 });
  }

  const ficha = fichaSnap.data()!;
  const pendiente = estadoPendiente(ficha);
  const esAdmin = auth.user.role === 'admin';
  const esSupervisor = auth.user.role === 'supervisor';
  const esOwner = ficha.afiliadorUid === auth.user.uid;

  if (!esAdmin && !(pendiente && (esSupervisor || esOwner))) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }

  const bucket = getStorage(adminApp).bucket();
  const paths: string[] = [];
  if (esArchivoDniBorrable(ficha.archivoDniPath, ficha)) {
    paths.push(ficha.archivoDniPath);
  }
  if (esArchivoFichaBorrable(ficha.archivoFichaPath, id)) {
    paths.push(ficha.archivoFichaPath);
  }

  for (const path of paths) {
    try {
      await bucket.file(path).delete({ ignoreNotFound: true });
    } catch (err) {
      console.error('[afiliaciones/eliminar] Error borrando archivo:', err);
      return NextResponse.json({ error: 'No se pudo borrar archivo asociado' }, { status: 500 });
    }
  }

  const batch = adminDb.batch();
  batch.delete(fichaRef);
  const dniNormalizado = String(ficha.dni || '').replace(/\D/g, '');
  if (dniNormalizado) {
    const indiceRef = adminDb.collection('dniIndex').doc(dniNormalizado);
    const indiceSnap = await indiceRef.get();
    if (indiceSnap.exists && indiceSnap.data()?.fichaId === id) {
      batch.delete(indiceRef);
    }
  }
  await batch.commit();

  return NextResponse.json({ ok: true });
}
