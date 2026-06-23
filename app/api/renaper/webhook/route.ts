import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { verificarFirmaDidit, verificarTimestamp } from '@/app/lib/diditWebhook';

const WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET ?? '';

// Mapea el gender que devuelve Didit al valor del dominio.
// TODO: verificar valores reales de gender en la respuesta de Didit.
function mapearSexo(gender: string | undefined): 'Masculino' | 'Femenino' | '' {
  if (!gender) return '';
  const g = gender.toUpperCase();
  if (g === 'M' || g === 'MALE'   || g === 'MASCULINO') return 'Masculino';
  if (g === 'F' || g === 'FEMALE' || g === 'FEMENINO')  return 'Femenino';
  return '';
}

// Convierte YYYY-MM-DD → DD/MM/AAAA.
// TODO: verificar formato de date_of_birth en la respuesta real de Didit.
function formatearFecha(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export async function POST(req: NextRequest) {
  if (!adminDb) {
    console.error('[renaper/webhook] adminDb no disponible');
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  // Paso 1: body crudo (necesario para verificar firma antes de parsear).
  const rawBody = await req.text();

  // Paso 2: verificar firma.
  if (!WEBHOOK_SECRET || !verificarFirmaDidit(rawBody, req.headers, WEBHOOK_SECRET)) {
    console.warn('[renaper/webhook] Firma inválida');
    return new Response('Unauthorized', { status: 401 });
  }

  // Paso 3: verificar timestamp.
  if (!verificarTimestamp(req.headers)) {
    console.warn('[renaper/webhook] Timestamp fuera de ventana');
    return new Response('Unauthorized', { status: 401 });
  }

  // Paso 4: parsear payload.
  let rawPayload: Record<string, unknown>;
  try {
    rawPayload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const sessionId = typeof rawPayload.session_id === 'string' ? rawPayload.session_id : null;
  if (!sessionId) {
    return new Response('Bad Request', { status: 400 });
  }

  const status = typeof rawPayload.status === 'string' ? rawPayload.status : '';

  // Paso 5: idempotencia — solo saltar si ya llegó a un estado final.
  const docRef = adminDb.collection('sesionesDidit').doc(sessionId);
  const existing = await docRef.get();
  const existingStatus = existing.exists ? existing.data()?.status : null;
  if (existingStatus === 'Approved' || existingStatus === 'Declined') {
    return NextResponse.json({ ok: true });
  }

  // Paso 6: extraer datos del DNI solo cuando el status es Approved.
  let datosExtraidos: Record<string, string> = {};
  if (status === 'Approved') {
    const kyc = rawPayload.kyc as { data?: Record<string, string> } | undefined;
    const kycData = kyc?.data ?? {};
    datosExtraidos = {
      dni:             kycData.document_number ?? '',  // TODO: verificar nombre de campo en respuesta real de Didit
      nombres:         kycData.first_name      ?? '',  // TODO: verificar nombre de campo en respuesta real de Didit
      apellidos:       kycData.last_name       ?? '',  // TODO: verificar nombre de campo en respuesta real de Didit
      sexo:            mapearSexo(kycData.gender),
      fechaNacimiento: formatearFecha(kycData.date_of_birth),
      nacionalidad:    kycData.nationality     ?? '',
    };
  }

  // Parsear vendorData que se mandó al crear la sesión.
  let vendorData: Record<string, unknown> = {};
  try {
    const rawVendor = typeof rawPayload.vendor_data === 'string' ? rawPayload.vendor_data : '{}';
    vendorData = JSON.parse(rawVendor) as Record<string, unknown>;
  } catch {
    // vendor_data malformado no es fatal; guardamos vacío.
  }

  const payloadHash = createHash('sha256').update(rawBody).digest('hex');
  const esFinal = status === 'Approved' || status === 'Declined';

  // Paso 7: persistir en sesionesDidit (merge para preservar recibidoEn del primer webhook).
  await docRef.set({
    sessionId,
    status,
    datosExtraidos,
    vendorData,
    payloadHash,
    recibidoEn: FieldValue.serverTimestamp(),
    ...(esFinal ? { procesadoEn: FieldValue.serverTimestamp() } : {}),
    rawPayload,
  }, { merge: true });

  // Paso 8: respuesta rápida.
  return NextResponse.json({ ok: true });
}
