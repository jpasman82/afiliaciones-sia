import { NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { verifyFirebaseUser } from '../../_auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const auth = await verifyFirebaseUser(request);
  if (!auth.ok) return auth.response;

  try {
    const now = new Date();

    const snapshot = await adminDb
      .collection('linksCargaPublica')
      .where('afiliadorUid', '==', auth.user.uid)
      .limit(10)
      .get();

    const activeDoc = snapshot.docs.find((d) => {
      const data = d.data();
      return data.usado === false && data.revocado !== true && data.venceEn?.toDate && data.venceEn.toDate() > now;
    });

    if (!activeDoc) {
      return NextResponse.json({ activo: false });
    }

    return NextResponse.json({ activo: true, token: activeDoc.id });
  } catch (err) {
    console.error('[links-publicos/activo] Error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
