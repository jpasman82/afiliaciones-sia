import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const idToken = authHeader.slice(7);
  const { email, nombre } = await request.json();

  // Verifica el ID token de Firebase contra la API de Google Identity
  const verification = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!verification.ok) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
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
