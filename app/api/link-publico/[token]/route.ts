import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }
  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }
  try {
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
    const userSnap = await adminDb.collection('usuarios').doc(link.afiliadorUid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Afiliador inexistente' }, { status: 404 });
    }
    const u = userSnap.data()!;
    return NextResponse.json({
      afiliadorUid: link.afiliadorUid,
      afiliadorNombre: `${u.apellido || ''} ${u.nombre || ''}`.trim(),
    });
  } catch (err) {
    console.error('[link-publico] Error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
