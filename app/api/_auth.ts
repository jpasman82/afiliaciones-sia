import { NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';

type FirebaseUser = {
  uid: string;
  email: string;
  role?: string;
};

type AuthOk = { ok: true; user: FirebaseUser; idToken: string };
type AuthFail = { ok: false; response: NextResponse };

function unauthorized(message = 'No autorizado') {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message = 'Permisos insuficientes') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function verifyFirebaseUser(request: Request): Promise<AuthOk | AuthFail> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: unauthorized() };
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return { ok: false, response: unauthorized('Firebase no configurado') };
  }

  const idToken = authHeader.slice(7);
  const verification = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!verification.ok) {
    return { ok: false, response: unauthorized('Token invalido') };
  }

  const data = await verification.json();
  const firebaseUser = data.users?.[0];
  if (!firebaseUser?.localId) {
    return { ok: false, response: unauthorized('Token invalido') };
  }

  return {
    ok: true,
    idToken,
    user: {
      uid: firebaseUser.localId,
      email: firebaseUser.email || '',
    },
  };
}

export async function requireRole(request: Request, roles: string[]): Promise<AuthOk | AuthFail> {
  const auth = await verifyFirebaseUser(request);
  if (!auth.ok) return auth;

  if (!adminDb) {
    return { ok: false, response: forbidden('Firestore Admin no configurado') };
  }
  const userSnap = await adminDb.collection('usuarios').doc(auth.user.uid).get();
  if (!userSnap.exists) {
    return { ok: false, response: forbidden('Usuario no encontrado') };
  }
  const role = userSnap.data()?.rol;
  console.log('[_auth] uid:', auth.user.uid, 'rol encontrado:', role);
  if (!roles.includes(role)) {
    return { ok: false, response: forbidden() };
  }

  return {
    ...auth,
    user: {
      ...auth.user,
      role,
    },
  };
}
