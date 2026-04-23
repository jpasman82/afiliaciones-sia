import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    // --- CANDADO DE SEGURIDAD ---
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.API_SECRET_TOKEN}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    // ----------------------------

    const { email, nombre } = await request.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'SIA AFILIACIONES- Nuevo usuario registrado',
      text: `Se ha registrado un nuevo usuario en la plataforma de Afiliaciones: ${nombre}\nEmail: ${email}\n\nIngresa al panel de administrador para asignarle un rol.\nhttps://afiliaciones.sanisidroavanza.com.ar/`
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}