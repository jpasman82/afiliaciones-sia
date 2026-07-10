import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET!;
const GRAPH_URL = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

function verificarFirma(body: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', APP_SECRET).update(body).digest('hex');
  const received = signatureHeader.slice(7);
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  } catch {
    return false;
  }
}

// GET: verificación inicial de Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// POST: mensajes entrantes
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  if (!verificarFirma(rawBody, signature)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = JSON.parse(rawBody);
    const entry = body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];

    if (message) {
      const from = message.from;

      // Dedup: Meta reintenta el webhook si no recibe 200 a tiempo.
      // Si ya procesamos este message.id, no reenviamos el menú.
      if (adminDb && message.id) {
        const procesadoRef = adminDb.collection('whatsappMensajesProcesados').doc(message.id);
        const yaProcesado = await procesadoRef.get();
        if (yaProcesado.exists) {
          return NextResponse.json({ ok: true });
        }
        await procesadoRef.set({ procesadoEn: FieldValue.serverTimestamp() });
      }

      // Por ahora, cualquier mensaje dispara el menú
      await sendMenu(from);
    }
  } catch (err) {
    console.error('[whatsapp/webhook] webhook error', err);
    return new Response('Bad Request', { status: 400 });
  }

  // Respuesta rápida a Meta
  return NextResponse.json({ ok: true });
}

async function sendMenu(to: string) {
  const res = await fetch(GRAPH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: '¡Hola! 👋 Soy el asistente de San Isidro Avanza. ¿En qué puedo ayudarte?',
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'afiliarme', title: 'Quiero afiliarme' } },
            { type: 'reply', reply: { id: 'voluntario', title: 'Ser voluntario' } },
            { type: 'reply', reply: { id: 'info', title: 'Más información' } },
          ],
        },
      },
    }),
  });

  if (!res.ok) {
    console.error('[whatsapp/webhook] Error enviando menú:', res.status, await res.text());
  }
}
