import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireRole } from '../_auth';

const ROL_LABELS: Record<string, string> = {
  afiliador: 'Afiliador',
  supervisor: 'Supervisor',
  admin: 'Administrador',
};

export async function POST(request: Request) {
  const auth = await requireRole(request, ['admin', 'supervisor']);
  if (!auth.ok) return auth.response;

  const { email, nombre, rol } = await request.json();
  if (auth.user.role === 'supervisor' && rol !== 'afiliador') {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
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

    const rolLabel = ROL_LABELS[rol] || rol;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'SIA AFILIACIONES - Tu acceso fue habilitado',
      text: `Hola ${nombre},\n\nTu acceso a la plataforma de Afiliaciones de San Isidro Avanza fue habilitado con el rol de ${rolLabel}.\n\nYa podes ingresar con tu cuenta de Google en:\nhttps://afiliaciones.sanisidroavanza.com.ar/\n\nSaludos,\nSan Isidro Avanza`,
    });
  } catch {
    // El fallo del email no bloquea el cambio de rol
  }

  return NextResponse.json({ success: true });
}
