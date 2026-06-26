// ============================================================================
//  app/api/link-publico/[token]/estado-didit/route.ts
//  Polling de estado de una sesión Didit iniciada desde un link público.
//  Autenticación: el token del link en la URL (no Firebase Auth).
//  Seguridad: valida que el sessionId pertenece efectivamente a este link
//  (mediante vendorData.linkToken), no a otro link cualquiera.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  const linkSnap = await adminDb.collection('linksCargaPublica').doc(token).get();
  if (!linkSnap.exists) {
    return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 });
  }
  const link = linkSnap.data()!;
  if (link.usado || link.revocado) {
    return NextResponse.json({ error: 'Link cerrado' }, { status: 410 });
  }
  if (link.venceEn?.toDate && link.venceEn.toDate() < new Date()) {
    return NextResponse.json({ error: 'Link vencido' }, { status: 410 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'Falta session_id' }, { status: 400 });
  }

  // Buscar por localId en sesionesDidit (igual que el endpoint interno).
  const q = await adminDb.collection('sesionesDidit').where('localId', '==', sessionId).limit(1).get();
  if (q.empty || q.docs[0].data()?.procesadoEn == null) {
    return NextResponse.json({ status: 'pendiente', datos: null });
  }

  const data = q.docs[0].data();

  // Seguridad: la sesión debe pertenecer a este link público concreto.
  // Si el vendorData no tiene linkToken o tiene uno distinto, rechazar.
  const sessionLinkToken = (data.vendorData as Record<string, unknown> | undefined)?.linkToken;
  if (sessionLinkToken !== token) {
    return NextResponse.json({ error: 'Sesión no pertenece a este link' }, { status: 403 });
  }

  return NextResponse.json({
    status: 'completado',
    datos: data.datosExtraidos as Record<string, string>,
    diditStatus: data.status as string,
  });
}
