import { NextRequest } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { adminDb, adminApp } from '@/app/lib/firebaseAdmin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!adminDb || !adminApp) return new Response('Service Unavailable', { status: 503 });

  const { token } = await params;
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');
  if (!path) return new Response('Bad Request', { status: 400 });

  const linkSnap = await adminDb.collection('linksCargaPublica').doc(token).get();
  if (!linkSnap.exists) return new Response('Not Found', { status: 404 });
  const link = linkSnap.data()!;
  if (link.usado || link.revocado) return new Response('Gone', { status: 410 });
  if ((link.venceEn?.toMillis?.() ?? 0) < Date.now()) return new Response('Gone', { status: 410 });

  const afiliadorUid = link.afiliadorUid as string;
  const pathPermitido =
    path.startsWith(`dnis/${afiliadorUid}/`) ||
    path.startsWith(`dnisPublicos/${token}/`);
  if (!pathPermitido) return new Response('Forbidden', { status: 403 });

  try {
    const [buffer] = await getStorage(adminApp).bucket().file(path).download();
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch (err) {
    console.error('[dni-preview] error bajando blob:', err);
    return new Response('Not Found', { status: 404 });
  }
}
