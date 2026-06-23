import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

const projectId  = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

if (!projectId || !clientEmail || !privateKey) {
  console.warn(
    '[firebaseAdmin] Env vars FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY no están definidas. adminDb y adminAuth serán null.'
  );
} else {
  const app: App =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  adminDb   = getFirestore(app);
  adminAuth = getAuth(app);
}

export { adminDb, adminAuth };
