// Server-side Firebase Admin SDK access. Authenticates using a service account
// referenced by FIREBASE_SERVICE_ACCOUNT_PATH (or Application Default
// Credentials). The service-account JSON must stay OUTSIDE the repo and public
// web directories; it is never imported, bundled, or logged here.
import fs from 'fs';
import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

function loadServiceAccount(): Record<string, unknown> | null {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath && fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error('[Firebase Admin] Could not parse service account file:', (err as Error)?.message);
      return null;
    }
  }

  // Optional inline credential (avoids committing a file); still server-side only.
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson && inlineJson.trim()) {
    try {
      return JSON.parse(inlineJson);
    } catch (err) {
      console.error('[Firebase Admin] Could not parse FIREBASE_SERVICE_ACCOUNT_JSON:', (err as Error)?.message);
      return null;
    }
  }

  return null;
}

let adminApp: App | null = null;

export function getFirebaseAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0];
    return adminApp;
  }
  try {
    const serviceAccount = loadServiceAccount();
    if (serviceAccount) {
      adminApp = initializeApp({ credential: cert(serviceAccount as any) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      adminApp = initializeApp({ credential: applicationDefault() });
    } else {
      // No server-side credential configured — leave messaging disabled rather
      // than attempt unauthenticated sends.
      console.warn('[Firebase Admin] No service account configured; Web FCM push disabled.');
      return null;
    }
    return adminApp;
  } catch (err) {
    console.warn('[Firebase Admin] Initialization failed:', (err as Error)?.message);
    return null;
  }
}

const app = getFirebaseAdminApp();

export const adminAuth = app ? getAuth(app) : null;
export const adminMessaging = app ? getMessaging(app) : null;
export const isFirebaseAdminReady = Boolean(app);
