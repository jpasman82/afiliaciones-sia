import { NextRequest } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { adminDb, adminApp } from '@/app/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

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

  // Paths permitidos: subidas propias de este token, o los paths exactos de la
  // sesión Didit asociada a este link. No se permite el namespace completo del
  // afiliador (evita enumerar DNIs de otras cargas del mismo afiliador).
  let pathPermitido = path.startsWith(`dnisPublicos/${token}/`);

  if (!pathPermitido) {
    const sesionesSnap = await adminDb
      .collection('sesionesDidit')
      .where('vendorData.linkToken', '==', token)
      .limit(10)
      .get();
    const pathsSesion = new Set<string>();
    sesionesSnap.forEach((doc) => {
      const datos = (doc.data()?.datosExtraidos ?? {}) as Record<string, unknown>;
      for (const p of [datos.dniImageStoragePath, datos.frontImageStoragePath, datos.backImageStoragePath]) {
        if (typeof p === 'string' && p) pathsSesion.add(p);
      }
    });
    pathPermitido = pathsSesion.has(path);
  }

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
