// WEB-only Firebase Cloud Messaging (FCM) Web Push for Lovemeetly.
//
// Responsibilities (background/closed-tab delivery only):
// - register the /firebase-messaging-sw.js service worker
// - obtain an FCM registration token for the authenticated user
// - register that token with the backend as platform: 'web'
// - unregister/cleanup the token on logout
//
// Foreground chat notifications stay owned by the existing Socket.IO path
// (see src/utils/desktopNotifications.ts + src/utils/messageAlerts.ts). This
// module deliberately does NOT create foreground notifications, so the two
// systems never double-notify. The service worker renders background pushes.
import { firebaseApp } from '../lib/firebase';
import { api } from '../services/api';
import { safeStorage } from './storage';

// Public Web Push VAPID key for Firebase project `app-lovemeetly`.
// This is a client-side public key, not a secret.
const DEFAULT_VAPID_KEY =
  'BPtxb_OMFRpUWDuZn_xTeZWrjv2sCJHjcW0WYV-VGMil81sSXIc5Ss5BTX5iSUsdFVP9FFv5qbNLvNarNrg3AVQ';

const SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';
const DEVICE_ID_KEY = 'lm_web_push_device_id';
const REGISTERED_TOKEN_KEY = 'lm_web_push_token';
const REGISTERED_TOKEN_USER_KEY = 'lm_web_push_token_user';

function getVapidKey(): string {
  const envKey = (import.meta as any)?.env?.VITE_FIREBASE_VAPID_KEY;
  return typeof envKey === 'string' && envKey.trim() ? envKey.trim() : DEFAULT_VAPID_KEY;
}

/** True when this browser can receive Web Push / FCM. */
export function isWebPushSupported(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'Notification' in window &&
      'PushManager' in window
    );
  } catch {
    return false;
  }
}

function getNotificationPermission(): NotificationPermission | 'unsupported' {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/** Stable per-browser identifier, reused across sessions for the same install. */
export function getStableDeviceId(): string {
  try {
    const existing = safeStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    safeStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `web_${Date.now().toString(36)}`;
  }
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    const existing = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  } catch (err) {
    console.warn('[WebPush] Service worker registration failed:', err);
    return null;
  }
}

/**
 * Request an FCM token and register it with the backend for the current user.
 * No-op unless the user has already granted notification permission and Web
 * Push is supported. Never throws.
 */
export async function registerWebPushForCurrentUser(currentUserId?: string | null): Promise<boolean> {
  try {
    if (!isWebPushSupported()) return false;
    const permission = getNotificationPermission();
    if (permission !== 'granted') return false;

    const registration = await getServiceWorkerRegistration();
    if (!registration) return false;

    const { getMessaging, getToken, onMessage, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return false;

    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;

    // Skip redundant round-trips for the same token/user pairing.
    const cachedToken = safeStorage.getItem(REGISTERED_TOKEN_KEY);
    const cachedUser = safeStorage.getItem(REGISTERED_TOKEN_USER_KEY);
    const userId = currentUserId || '';
    if (cachedToken === token && cachedUser && cachedUser === userId) return true;

    // Foreground messages are intentionally ignored: Socket.IO owns the
    // foreground path, and letting FCM also notify here would duplicate it.
    try {
      onMessage(messaging, () => {});
    } catch {}

    const res = await api.registerPushToken(token, getStableDeviceId(), 'web');
    if (res?.success) {
      safeStorage.setItem(REGISTERED_TOKEN_KEY, token);
      safeStorage.setItem(REGISTERED_TOKEN_USER_KEY, userId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[WebPush] Token registration skipped:', err);
    return false;
  }
}

/**
 * Unregister the current browser's FCM token on logout so it is never bound to
 * a different account on the same browser. Never throws.
 */
export async function unregisterWebPush(): Promise<void> {
  try {
    const token = safeStorage.getItem(REGISTERED_TOKEN_KEY);
    if (token) {
      try {
        await api.unregisterPushToken(token);
      } catch {}
    }
    safeStorage.removeItem(REGISTERED_TOKEN_KEY);
    safeStorage.removeItem(REGISTERED_TOKEN_USER_KEY);

    if (isWebPushSupported()) {
      try {
        const { getMessaging, deleteToken, isSupported } = await import('firebase/messaging');
        if (await isSupported()) {
          await deleteToken(getMessaging(firebaseApp));
        }
      } catch {}
    }
  } catch {
    // best-effort only
  }
}
