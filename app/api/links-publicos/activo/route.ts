import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyFirebaseUser } from '../../_auth';

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

export async function GET(request: Request) {
  const auth = await verifyFirebaseUser(request);
  if (!auth.ok) return auth.response;

  const db = getDb();
  const now = new Date();

  const snapshot = await db
    .collection('linksCargaPublica')
    .where('afiliadorUid', '==', auth.user.uid)
    .limit(10)
    .get();

  const activeDoc = snapshot.docs.find((d) => {
    const data = d.data();
    return data.usado === false && data.revocado !== true && data.venceEn.toDate() > now;
  });

  if (!activeDoc) {
    return NextResponse.json({ activo: false });
  }

  return NextResponse.json({ activo: true, token: activeDoc.id });
}
