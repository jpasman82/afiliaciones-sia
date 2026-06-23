import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { requireRole } from '../../_auth';

export const dynamic = 'force-dynamic';

const ROLES_PERMITIDOS = ['admin', 'supervisor', 'afiliador'];

export async function GET(request: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const auth = await requireRole(request, ROLES_PERMITIDOS);
  if (!auth.ok) return auth.response;

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
