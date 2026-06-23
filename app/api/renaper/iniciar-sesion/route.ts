import { NextResponse } from 'next/server';
import { requireRole } from '../../_auth';
import { crearSesionDidit } from '@/app/lib/diditClient';

const ROLES_PERMITIDOS = ['admin', 'supervisor', 'afiliador'];
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function POST(request: Request) {
  const auth = await requireRole(request, ROLES_PERMITIDOS);
  if (!auth.ok) return auth.response;

  let afiliadorUid: string;
  let afiliadorNombre: string;
  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as Record<string, unknown>).afiliadorUid !== 'string' ||
      typeof (body as Record<string, unknown>).afiliadorNombre !== 'string'
    ) {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }
    ({ afiliadorUid, afiliadorNombre } = body as { afiliadorUid: string; afiliadorNombre: string });
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  try {
    const vendorData = JSON.stringify({
      afiliadorUid,
      afiliadorNombre,
      timestamp: new Date().toISOString(),
    });

    // {session_id} es el template que Didit sustituye con el ID real antes de redirigir.
    const callback = `${APP_URL}/?tab=nueva&didit_session={session_id}`;

    const sesion = await crearSesionDidit({ vendorData, callback });

    return NextResponse.json({ sessionId: sesion.session_id, url: sesion.url });
  } catch (err) {
    console.error('[renaper/iniciar-sesion] Error al crear sesión Didit:', err);
    return NextResponse.json({ error: 'Error al crear sesión' }, { status: 500 });
  }
}
