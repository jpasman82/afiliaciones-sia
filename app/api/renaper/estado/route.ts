import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/app/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const ROLES_PERMITIDOS = ['admin', 'supervisor', 'afiliador'];

export async function GET(request: NextRequest) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const idToken = authHeader.slice(7);
  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  const userSnap = await adminDb.collection('usuarios').doc(uid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }
  const rol = userSnap.data()?.rol as string | undefined;
  if (!rol || !ROLES_PERMITIDOS.includes(rol)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'Falta session_id' }, { status: 400 });
  }

  const snap = await adminDb.collection('sesionesDidit').doc(sessionId).get();
  if (!snap.exists || snap.data()?.procesadoEn == null) {
    return NextResponse.json({ status: 'pendiente', datos: null });
  }

  const data = snap.data()!;
  return NextResponse.json({
    status:  'completado',
    datos:   data.datosExtraidos as Record<string, string>,
    diditStatus: data.status as string,
  });
}
