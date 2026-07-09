// ============================================================================
//  app/api/link-publico/[token]/iniciar-sesion-didit/route.ts
//  Inicia una sesión de verificación Didit para un link público.
//  Autenticación: el token del link en la URL (no Firebase Auth).
// ============================================================================
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { crearSesionDidit } from '@/app/lib/diditClient';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  // Mismas validaciones que GET /api/link-publico/[token]: existe, no usado, no vencido.
  const linkSnap = await adminDb.collection('linksCargaPublica').doc(token).get();
  if (!linkSnap.exists) {
    return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 });
  }
  const link = linkSnap.data()!;
  if (link.usado || link.revocado) {
    return NextResponse.json({ error: 'Link ya usado' }, { status: 410 });
  }
  if (link.venceEn?.toDate && link.venceEn.toDate() < new Date()) {
    return NextResponse.json({ error: 'Link vencido' }, { status: 410 });
  }

  // Cap anti-abuso: máximo de sesiones Didit por link. Cubre reintentos legítimos
  // (cámara fallida, foto borrosa) sin permitir vaciar la cuota de Didit durante las 24h.
  const MAX_SESIONES_DIDIT = 10;
  const sesionesUsadas = typeof link.sesionesDiditCount === 'number' ? link.sesionesDiditCount : 0;
  if (sesionesUsadas >= MAX_SESIONES_DIDIT) {
    return NextResponse.json({ error: 'Límite de verificaciones alcanzado para este link' }, { status: 429 });
  }

  // Obtener nombre del afiliador del documento usuarios (igual que el GET del link).
  const userSnap = await adminDb.collection('usuarios').doc(link.afiliadorUid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Afiliador inexistente' }, { status: 404 });
  }
  const u = userSnap.data()!;
  const afiliadorNombre = `${u.apellido || ''} ${u.nombre || ''}`.trim();

  try {
    // localId viaja en la URL de callback y en vendorData. El webhook lo persiste
    // para que /estado-didit pueda encontrar la sesión.
    // linkToken también se incluye para que /estado-didit pueda validar que el
    // sessionId solicitado realmente pertenece a este link público (anti-cross-link).
    const localId = randomUUID();
    const vendorData = JSON.stringify({
      afiliadorUid: link.afiliadorUid,
      afiliadorNombre,
      linkToken: token,
      localId,
      timestamp: new Date().toISOString(),
    });

    const callback = `${APP_URL}/cargar/${token}?didit_session=${localId}`;
    const sesion = await crearSesionDidit({ vendorData, callback });

    // Incrementar el contador solo tras crear la sesión con éxito.
    await linkSnap.ref.update({ sesionesDiditCount: FieldValue.increment(1) });

    return NextResponse.json({ sessionId: localId, url: sesion.url });
  } catch (err) {
    console.error('[link-publico/iniciar-sesion-didit] Error:', err);
    return NextResponse.json({ error: 'Error al crear sesión' }, { status: 500 });
  }
}
