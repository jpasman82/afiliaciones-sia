import { NextResponse } from 'next/server';
import { verifyFirebaseUser } from '../_auth';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { appUrl, getUserEmailsByRoles, sendMail, userDisplayName } from '@/app/lib/emailNotifications';

export async function POST(request: Request) {
  const auth = await verifyFirebaseUser(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const userRef = adminDb.collection('usuarios').doc(auth.user.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const usuario = userSnap.data()!;
  if (usuario.notificacionRegistroEnviadaEn) {
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    const destinatarios = await getUserEmailsByRoles(['admin', 'supervisor']);
    await sendMail(
      destinatarios,
      'SIA AFILIACIONES - Nuevo usuario registrado',
      `Se ha registrado un nuevo usuario en la plataforma de Afiliaciones: ${userDisplayName({ ...usuario, email: usuario.email || auth.user.email })}\nEmail: ${usuario.email || auth.user.email}\n\nIngresa al panel de administrador para asignarle un rol.\n${appUrl()}/`
    );
    await userRef.update({ notificacionRegistroEnviadaEn: new Date() });
  } catch {
    // El fallo del email no bloquea el registro
  }

  return NextResponse.json({ success: true });
}
