import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { verifyFirebaseUser } from '../_auth';

export async function POST(request: Request) {
  const auth = await verifyFirebaseUser(request);
  if (!auth.ok) return auth.response;

  const { email, nombre } = await request.json();
  if (email !== auth.user.email) {
    return NextResponse.json({ error: 'Email invalido' }, { status: 403 });
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
      text: `Se ha registrado un nuevo usuario en la plataforma de Afiliaciones: ${nombre}\nEmail: ${email}\n\nIngresa al panel de administrador para asignarle un rol.\nhttps://afiliaciones.sanisidroavanza.com.ar/`,
    });
  } catch {
    // El fallo del email no bloquea el registro
  }

  return NextResponse.json({ success: true });
}
