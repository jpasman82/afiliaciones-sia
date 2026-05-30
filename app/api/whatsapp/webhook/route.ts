import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;

// GET: verificación inicial de Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado por Meta');
    return new Response(challenge, { status: 200 });
  }

  console.warn('❌ Verificación fallida', { mode, token });
  return new Response('Forbidden', { status: 403 });
}

// POST: mensajes entrantes
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Por ahora solo logueamos para confirmar que llegan los eventos
  console.log('📩 Webhook POST recibido:', JSON.stringify(body, null, 2));

  // Respuesta rápida (Meta espera 200 en menos de 5 segundos)
  return NextResponse.json({ ok: true });
}