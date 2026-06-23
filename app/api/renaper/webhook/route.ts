import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { verificarFirmaDidit, verificarTimestamp } from '@/app/lib/diditWebhook';

const WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET ?? '';

function mapearSexo(gender: string | undefined): 'Masculino' | 'Femenino' | '' {
  if (!gender) return '';
  const g = gender.toUpperCase();
  if (g === 'M' || g === 'MALE'   || g === 'MASCULINO') return 'Masculino';
  if (g === 'F' || g === 'FEMALE' || g === 'FEMENINO')  return 'Femenino';
  return '';
}

// Convierte YYYY-MM-DD → DD/MM/AAAA.
function formatearFecha(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

const PAISES_ISO3: Record<string, string> = {
  ARG: 'Argentina', BRA: 'Brasil',          BOL: 'Bolivia',
  CHL: 'Chile',     PRY: 'Paraguay',        URY: 'Uruguay',
  PER: 'Perú',      COL: 'Colombia',        VEN: 'Venezuela',
  ECU: 'Ecuador',   ESP: 'España',          ITA: 'Italia',
  CHN: 'China',     USA: 'Estados Unidos',
};

function mapearNacionalidad(code: string | undefined): string {
  if (!code) return '';
  return PAISES_ISO3[code.toUpperCase()] ?? code;
}

function toTitleCase(str: string | undefined): string {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function separarCalleNumero(street: string | undefined): { calle: string; numero: string } {
  if (!street) return { calle: '', numero: '' };
  const match = street.match(/^(.*?)\s+(\d+)\s*$/);
  if (match) return { calle: match[1].trim(), numero: match[2] };
  return { calle: street.trim(), numero: '' };
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
    const decision = rawPayload.decision as { id_verifications?: Record<string, unknown>[] } | undefined;
    const idv = (decision?.id_verifications?.[0] ?? {}) as Record<string, unknown>;
    const extraFields  = (idv.extra_fields   ?? {}) as Record<string, string>;
    const parsedAddress = (idv.parsed_address ?? {}) as Record<string, string>;
    const { calle, numero } = separarCalleNumero(parsedAddress.street_1);
    datosExtraidos = {
      dni:             String(idv.document_number ?? ''),
      nombres:         String(idv.first_name      ?? ''),
      apellidos:       String(idv.last_name       ?? ''),
      sexo:            mapearSexo(idv.gender as string | undefined),
      fechaNacimiento: formatearFecha(idv.date_of_birth as string | undefined),
      nacionalidad:    mapearNacionalidad(idv.nationality as string | undefined),
      lugarNacimiento: toTitleCase(idv.place_of_birth as string | undefined),
      cuil:            extraFields.tax_number ?? '',
      calle,
      numero,
      localidad:       parsedAddress.city ?? '',
      frontImageUrl:   String(idv.front_image ?? ''),
      backImageUrl:    String(idv.back_image  ?? ''),
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

  // localId es el UUID que generamos en iniciar-sesion y que viajó en la callback URL.
  // Lo guardamos en el doc para que /api/renaper/estado pueda buscarlo por este campo.
  const localId = typeof vendorData.localId === 'string' ? vendorData.localId : null;

  const payloadHash = createHash('sha256').update(rawBody).digest('hex');
  const esFinal = status === 'Approved' || status === 'Declined';

  // Paso 7: persistir en sesionesDidit (merge para preservar recibidoEn del primer webhook).
  await docRef.set({
    sessionId,
    status,
    datosExtraidos,
    vendorData,
    ...(localId ? { localId } : {}),
    payloadHash,
    recibidoEn: FieldValue.serverTimestamp(),
    ...(esFinal ? { procesadoEn: FieldValue.serverTimestamp() } : {}),
    rawPayload,
  }, { merge: true });

  // Paso 8: respuesta rápida.
  return NextResponse.json({ ok: true });
}
