import { NextResponse } from 'next/server';
import { requireRole } from '../_auth';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { appUrl, estadoLabel, sendMail } from '@/app/lib/emailNotifications';

function fichaNombre(ficha: Record<string, any>) {
  return [ficha.apellidos, ficha.nombres].filter(Boolean).join(', ').trim() || ficha.dni || 'Sin identificar';
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ['admin', 'supervisor']);
  if (!auth.ok) return auth.response;
  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const fichaId = typeof body.fichaId === 'string' ? body.fichaId : '';
  const estadoAnterior = typeof body.estadoAnterior === 'string' ? body.estadoAnterior : '';
  const estadoNuevo = typeof body.estadoNuevo === 'string' ? body.estadoNuevo : '';
  const comentario = typeof body.comentario === 'string' ? body.comentario.trim() : '';
  if (!fichaId || !estadoNuevo) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const fichaSnap = await adminDb.collection('afiliaciones').doc(fichaId).get();
  if (!fichaSnap.exists) {
    return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 });
  }

  const ficha = fichaSnap.data()!;
  if (ficha.estadoControl !== estadoNuevo) {
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    await sendMail(
      ficha.afiliadorEmail ? [ficha.afiliadorEmail] : [],
      'SIA AFILIACIONES - Una ficha cambio de estado',
      `La ficha de ${fichaNombre(ficha)} cambio de estado${estadoAnterior ? ` de ${estadoLabel(estadoAnterior)}` : ''} a ${estadoLabel(estadoNuevo)}.\n\nDNI: ${ficha.dni || '-'}${comentario ? `\nComentario: ${comentario}` : ''}\n\nPodes revisar el detalle en la plataforma.\n${appUrl()}/`
    );
  } catch {
    // El fallo del email no bloquea el cambio de estado.
  }

  return NextResponse.json({ success: true });
}
