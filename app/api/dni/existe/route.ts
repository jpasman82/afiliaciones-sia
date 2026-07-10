import { NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { requireRole } from '@/app/api/_auth';

export const dynamic = 'force-dynamic';

const ROLES_PERMITIDOS = ['admin', 'supervisor', 'afiliador'];

// Devuelve SOLO si un DNI ya está cargado, sin exponer afiliadorUid ni fichaId.
// El DNI viaja en el body (POST) para no quedar en los access logs de Vercel.
export async function POST(request: Request) {
  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const auth = await requireRole(request, ROLES_PERMITIDOS);
  if (!auth.ok) return auth.response;

  let body: { dni?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const dni = String(body.dni ?? '').replace(/\D/g, '');
  if (dni.length < 7 || dni.length > 9) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 });
  }

  const snap = await adminDb.collection('dniIndex').doc(dni).get();
  return NextResponse.json({ existe: snap.exists });
}
