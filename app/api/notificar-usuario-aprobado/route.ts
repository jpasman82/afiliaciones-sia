import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const ROL_LABELS: Record<string, string> = {
  afiliador: 'Afiliador',
  supervisor: 'Supervisor',
  admin: 'Administrador',
};

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const idToken = authHeader.slice(7);
  const { email, nombre, rol } = await request.json();

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
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 465,
      secure: true, // false si usás el puerto 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const rolLabel = ROL_LABELS[rol] || rol;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'SIA AFILIACIONES - Tu acceso fue habilitado',
      text: `Hola ${nombre},\n\nTu acceso a la plataforma de Afiliaciones de San Isidro Avanza fue habilitado con el rol de ${rolLabel}.\n\nYa podés ingresar con tu cuenta de Google en:\nhttps://afiliaciones.sanisidroavanza.com.ar/\n\nSaludos,\nSan Isidro Avanza`,
    });
  } catch {
    // El fallo del email no bloquea el cambio de rol
  }

  return NextResponse.json({ success: true });
}