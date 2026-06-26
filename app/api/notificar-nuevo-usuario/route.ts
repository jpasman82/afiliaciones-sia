import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { verifyFirebaseUser } from '../_auth';
import { adminDb } from '@/app/lib/firebaseAdmin';

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
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'SIA AFILIACIONES - Nuevo usuario registrado',
      text: `Se ha registrado un nuevo usuario en la plataforma de Afiliaciones: ${[usuario.nombre, usuario.apellido].filter(Boolean).join(' ')}\nEmail: ${usuario.email || auth.user.email}\n\nIngresa al panel de administrador para asignarle un rol.\nhttps://afiliaciones.sanisidroavanza.com.ar/`,
    });
    await userRef.update({ notificacionRegistroEnviadaEn: new Date() });
  } catch {
    // El fallo del email no bloquea el registro
  }

  return NextResponse.json({ success: true });
}
