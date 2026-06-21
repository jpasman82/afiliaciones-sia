import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }
  const db = getDb();
  const linkSnap = await db.collection('linksCargaPublica').doc(token).get();
  if (!linkSnap.exists) {
    return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 });
  }
  const link = linkSnap.data()!;
  if (link.usado) {
    return NextResponse.json({ error: 'Link ya usado' }, { status: 410 });
  }
  if (link.venceEn.toDate() < new Date()) {
    return NextResponse.json({ error: 'Link vencido' }, { status: 410 });
  }
  const userSnap = await db.collection('usuarios').doc(link.afiliadorUid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Afiliador inexistente' }, { status: 404 });
  }
  const u = userSnap.data()!;
  return NextResponse.json({
    afiliadorUid: link.afiliadorUid,
    afiliadorEmail: u.email,
    afiliadorNombre: `${u.apellido || ''} ${u.nombre || ''}`.trim(),
  });
}
