import nodemailer from 'nodemailer';
import { adminDb } from './firebaseAdmin';
import { ESTADOS, ROLES } from './estados';
import type { EstadoControl, Rol } from './types';

type Recipient = {
  email?: string;
  nombre?: string;
  apellido?: string;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://afiliaciones.sanisidroavanza.com.ar');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function uniqueEmails(recipients: Recipient[]) {
  return Array.from(new Set(
    recipients
      .map((recipient) => recipient.email?.trim())
      .filter((email): email is string => !!email)
  ));
}

export async function getUserEmailsByRoles(roles: Rol[]) {
  if (!adminDb) return [];

  const snapshot = await adminDb
    .collection('usuarios')
    .where('rol', 'in', roles)
    .get();

  return uniqueEmails(snapshot.docs.map((doc) => doc.data() as Recipient));
}

export async function sendMail(to: string[], subject: string, text: string) {
  const recipients = to.length > 0 ? to : uniqueEmails([{ email: process.env.EMAIL_USER }]);
  if (!process.env.EMAIL_USER || recipients.length === 0) return;

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: recipients.join(', '),
    subject,
    text,
  });
}

export function userDisplayName(user: Recipient) {
  return [user.nombre, user.apellido].filter(Boolean).join(' ').trim() || user.email || 'Sin nombre';
}

export function roleLabel(role?: string) {
  return role && ROLES[role as Rol]?.label ? ROLES[role as Rol].label : role || 'Sin rol';
}

export function estadoLabel(estado?: string) {
  return estado && ESTADOS[estado as EstadoControl]?.label ? ESTADOS[estado as EstadoControl].label : estado || 'Sin estado';
}

export function appUrl() {
  return APP_URL;
}
