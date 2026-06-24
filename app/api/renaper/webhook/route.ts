import { createHash } from 'crypto';
import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { adminDb, adminApp } from '@/app/lib/firebaseAdmin';
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

// Fallback cuando Didit no devuelve parsed_address: parsear el string libre `address`.
// Formato típico del DNI argentino: "<calle> <numero> - <provincia> - <localidad> -<,> <pais>".
// Si no matchea ese formato, devuelve los campos vacíos para no plantar datos basura.
function parsearAddressLibre(address: string | undefined): { calle: string; numero: string; localidad: string } {
  if (!address) return { calle: '', numero: '', localidad: '' };
  const partes = address.split(' - ').map(p => p.trim()).filter(Boolean);
  if (partes.length < 3) return { calle: '', numero: '', localidad: '' };
  const direccion = partes[0];
  const localidad = (partes[2] || '').replace(/[,\s]+$/g, '').trim();
  const { calle, numero } = separarCalleNumero(direccion);
  return { calle, numero, localidad };
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
    // Primero intentamos con parsed_address (que viene estructurado de Didit).
    // Si está vacío, hacemos best-effort sobre el string libre `address`.
    let calle = '';
    let numero = '';
    let localidad = parsedAddress.city ?? '';
    if (parsedAddress.street_1) {
      ({ calle, numero } = separarCalleNumero(parsedAddress.street_1));
    } else {
      const parsed = parsearAddressLibre(idv.address as string | undefined);
      calle = parsed.calle;
      numero = parsed.numero;
      if (!localidad) localidad = parsed.localidad;
    }
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
      localidad,
      frontImageUrl:   String(idv.front_image ?? ''),
      backImageUrl:    String(idv.back_image  ?? ''),
    };
  }

  // Paso 6b: descargar fotos de Didit, combinarlas verticalmente y subirlas a Storage.
  // Las URLs de Didit son firmadas de S3 y expiran en ~4 h; hay que persistirlas ahora.
  if (status === 'Approved' && adminApp && (datosExtraidos.frontImageUrl || datosExtraidos.backImageUrl)) {
    try {
      const bucket = getStorage(adminApp).bucket();
      const timestamp = Date.now();
      const dniSeguro = String(datosExtraidos.dni || 'sin-dni').replace(/\D/g, '') || 'sin-dni';

      const descargarBuffer = async (url: string, sufijo: string): Promise<Buffer | null> => {
        const res = await fetch(url);
        if (!res.ok) { console.error(`[webhook] HTTP ${res.status} al descargar ${sufijo}`); return null; }
        return Buffer.from(await res.arrayBuffer());
      };

      const [bufFrente, bufDorso] = await Promise.all([
        datosExtraidos.frontImageUrl ? descargarBuffer(datosExtraidos.frontImageUrl, 'frente') : Promise.resolve(null),
        datosExtraidos.backImageUrl  ? descargarBuffer(datosExtraidos.backImageUrl,  'dorso')  : Promise.resolve(null),
      ]);

      // Subir frente y dorso por separado (para referencia).
      const subirBuffer = async (buf: Buffer, sufijo: string) => {
        const path = `dnis/${dniSeguro}-didit-${sufijo}-${timestamp}.jpg`;
        const file = bucket.file(path);
        await file.save(buf, { contentType: 'image/jpeg' });
        await file.makePublic();
        return { path, publicUrl: `https://storage.googleapis.com/${bucket.name}/${path}` };
      };

      const [frente, dorso] = await Promise.all([
        bufFrente ? subirBuffer(bufFrente, 'frente') : Promise.resolve(null),
        bufDorso  ? subirBuffer(bufDorso,  'dorso')  : Promise.resolve(null),
      ]);

      if (frente) { datosExtraidos.frontImageStorageUrl = frente.publicUrl; datosExtraidos.frontImageStoragePath = frente.path; }
      if (dorso)  { datosExtraidos.backImageStorageUrl  = dorso.publicUrl;  datosExtraidos.backImageStoragePath  = dorso.path; }

      // Combinar frente + dorso verticalmente (igual que el flujo manual con canvas).
      if (bufFrente && bufDorso) {
        try {
          const metaF = await sharp(bufFrente).metadata();
          const metaD = await sharp(bufDorso).metadata();
          const ancho = Math.max(metaF.width ?? 0, metaD.width ?? 0);
          const dorsoResized = await sharp(bufDorso).resize({ width: ancho, fit: 'contain', background: { r: 255, g: 255, b: 255 } }).jpeg().toBuffer();
          const frenteResized = await sharp(bufFrente).resize({ width: ancho, fit: 'contain', background: { r: 255, g: 255, b: 255 } }).jpeg().toBuffer();
          const metaFR = await sharp(frenteResized).metadata();
          const metaDR = await sharp(dorsoResized).metadata();
          const alturaTotal = (metaFR.height ?? 0) + (metaDR.height ?? 0);
          const combinado = await sharp({
            create: { width: ancho, height: alturaTotal, channels: 3, background: { r: 255, g: 255, b: 255 } },
          }).composite([
            { input: frenteResized, top: 0, left: 0 },
            { input: dorsoResized,  top: metaFR.height ?? 0, left: 0 },
          ]).jpeg({ quality: 85 }).toBuffer();

          const pathCombinado = `dnis/${dniSeguro}-didit-${timestamp}.jpg`;
          const fileCombinado = bucket.file(pathCombinado);
          await fileCombinado.save(combinado, { contentType: 'image/jpeg' });
          await fileCombinado.makePublic();
          datosExtraidos.dniImageStorageUrl  = `https://storage.googleapis.com/${bucket.name}/${pathCombinado}`;
          datosExtraidos.dniImageStoragePath = pathCombinado;
        } catch (errCombinar) {
          console.error('[webhook] Error combinando imágenes, se usará solo el frente:', errCombinar);
          // Fallback: usar la imagen del frente como imagen combinada.
          if (frente) { datosExtraidos.dniImageStorageUrl = frente.publicUrl; datosExtraidos.dniImageStoragePath = frente.path; }
        }
      } else if (frente) {
        // Solo hay frente disponible.
        datosExtraidos.dniImageStorageUrl  = frente.publicUrl;
        datosExtraidos.dniImageStoragePath = frente.path;
      }
    } catch (err) {
      console.error('[webhook] Error general al subir imágenes a Storage:', err);
    }
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
