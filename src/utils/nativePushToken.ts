// Android-only FCM registration-token handoff.
//
//   FCM token -> native SharedPreferences (LovemeetlyPushTokens.java)
//             -> Capacitor `LovemeetlyPush` plugin
//             -> this module
//             -> EXISTING authenticated api.registerPushToken(...)
//             -> POST /api/push-tokens  (platform: 'android')
//
// This module performs no authentication of its own: it relies on the session that the WebView
// already holds (api.authFetch attaches the existing Bearer / x-session-token credentials). It also
// creates no new endpoint and never touches the web push path (src/utils/webPush.ts).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { api } from '../services/api';
import { safeStorage } from './storage';

// Local registration guard, mirroring webPush.ts's cached-token idea but scoped by BOTH the user id
// and the token: a different user OR a different token always re-registers, otherwise nothing is sent.
const GUARD_TOKEN_KEY = 'lm_native_push_token';
const GUARD_USER_KEY = 'lm_native_push_token_user';
const GUARD_DEVICE_KEY = 'lm_native_push_device_id';

/** Same minimum the backend enforces (server.ts accepts 20..4096 characters). */
const MIN_TOKEN_LENGTH = 20;

export const NATIVE_PUSH_PLATFORM = 'android';

export interface NativePushTokenResult {
  token: string;
  deviceId: string;
}

interface LovemeetlyPushPluginApi {
  getPushToken(): Promise<Partial<NativePushTokenResult>>;
  clearPushToken(): Promise<void>;
  addListener(
    eventName: 'pushToken',
    listener: (data: Partial<NativePushTokenResult>) => void
  ): Promise<unknown> | unknown;
}

const LovemeetlyPush = registerPlugin<LovemeetlyPushPluginApi>('LovemeetlyPush');

/** True only inside the Android app; the web/desktop build is untouched. */
export function isNativePushSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/** Server-valid token check, so obviously unusable values are never sent. */
export function isUsableNativeToken(raw?: string | null): boolean {
  return typeof raw === 'string' && raw.trim().length >= MIN_TOKEN_LENGTH;
}

interface RegistrationGuard {
  token: string;
  userId: string;
  deviceId: string;
}

function readGuard(): RegistrationGuard {
  try {
    return {
      token: safeStorage.getItem(GUARD_TOKEN_KEY) || '',
      userId: safeStorage.getItem(GUARD_USER_KEY) || '',
      deviceId: safeStorage.getItem(GUARD_DEVICE_KEY) || '',
    };
  } catch {
    return { token: '', userId: '', deviceId: '' };
  }
}

function writeGuard(token: string, userId: string, deviceId: string): void {
  try {
    safeStorage.setItem(GUARD_TOKEN_KEY, token);
    safeStorage.setItem(GUARD_USER_KEY, userId);
    safeStorage.setItem(GUARD_DEVICE_KEY, deviceId);
  } catch {}
}

/** Exposed for tests/diagnostics: forgets what was registered locally. */
export function clearNativePushGuard(): void {
  try {
    safeStorage.removeItem(GUARD_TOKEN_KEY);
    safeStorage.removeItem(GUARD_USER_KEY);
    safeStorage.removeItem(GUARD_DEVICE_KEY);
  } catch {}
}

/**
 * Registers this device's Android FCM token for the given authenticated user through the existing
 * endpoint. Never throws; returns false when unsupported, unavailable or already registered.
 */
export async function registerNativePushTokenForUser(
  userId?: string | null
): Promise<boolean> {
  try {
    if (!isNativePushSupported() || !userId) return false;

    // Cached value first; the plugin fetches a fresh one when nothing is stored yet.
    const native = await LovemeetlyPush.getPushToken();
    const token = typeof native?.token === 'string' ? native.token.trim() : '';
    if (!isUsableNativeToken(token)) return false;

    const deviceId = typeof native?.deviceId === 'string' ? native.deviceId.trim() : '';
    const guard = readGuard();
    if (guard.token === token && guard.userId === userId) {
      // Same user + same token: already registered, so skip the round-trip.
      return true;
    }

    const res = await api.registerPushToken(token, deviceId, NATIVE_PUSH_PLATFORM);
    if (!res?.success) return false;

    writeGuard(token, userId, deviceId);
    return true;
  } catch (err) {
    console.warn('[NativePush] Token registration skipped:', err);
    return false;
  }
}

/**
 * Logout: unbinds this device's Android token from the departing account using the existing
 * unregister endpoint, then clears the local native/guard state.
 *
 * Must run before the session is destroyed (App.tsx calls it alongside unregisterWebPush()).
 */
export async function unregisterNativePushToken(): Promise<void> {
  try {
    if (!isNativePushSupported()) return;
    const guard = readGuard();
    if (guard.token) {
      try {
        await api.unregisterPushToken(guard.token, guard.deviceId || undefined);
      } catch {}
    }
    clearNativePushGuard();
    // Drops the cached native copy; the device id stays stable for the next sign-in.
    try {
      await LovemeetlyPush.clearPushToken();
    } catch {}
  } catch {}
}

/**
 * Subscribes to native token refreshes (the `pushToken` event emitted by LovemeetlyPushPlugin when a
 * token changes while the WebView is alive). The callback is expected to call
 * registerNativePushTokenForUser, whose (user, token) guard makes repeated emissions harmless - so a
 * refresh can never create a duplicate registration.
 *
 * Returns an unsubscribe function; a no-op on every non-Android platform.
 */
export function initializeNativePushToken(onTokenChanged: () => void): () => void {
  if (!isNativePushSupported()) return () => {};

  let cancelled = false;
  let handle: { remove?: () => void } | null = null;

  try {
    Promise.resolve(
      LovemeetlyPush.addListener('pushToken', () => {
        if (!cancelled) void onTokenChanged();
      }) as Promise<{ remove?: () => void }> | { remove?: () => void }
    )
      .then((created) => {
        if (cancelled) {
          try {
            created?.remove?.();
          } catch {}
          return;
        }
        handle = created || null;
      })
      .catch(() => {});
  } catch {
    // Plugin unavailable: registration still happens on the next launch.
  }

  return () => {
    cancelled = true;
    try {
      handle?.remove?.();
    } catch {}
  };
}