// Android in-app "new version available" check.
//
// SCOPE: Android/Capacitor only. Every entry point here is a no-op on the web
// (isAndroidApp() is false there), so the browser build behaves exactly as before.
//
// Design constraints, all deliberate:
//  - the compared version is the INSTALLED APK's versionCode, read natively through
//    @capacitor/app (App.getInfo().build) - no version is hardcoded in JavaScript
//  - the published version comes from the public GET /api/android/version endpoint
//    (server.ts), fetched through the same primary/fallback URL pair every other API
//    call uses (/server-api first, then /api)
//  - the whole check is fire-and-forget and timeout-bounded: offline, a missing
//    endpoint, a timeout, invalid JSON or an unusable payload all resolve to
//    "no prompt" and can never throw into app startup, login, chat, calls or FCM
//  - one check at startup plus one when Android brings the app back to the foreground
//    with a cooldown - never continuous polling
import { useCallback, useEffect, useState } from 'react';
import { App } from '@capacitor/app';

import { resolveApiUrl, resolveFallbackApiUrl } from '../services/api';
import { isAndroidApp, onAndroidAppResume } from './capacitorApp';
import {
  isUsableUpdateUrl,
  parseAndroidUpdateConfig,
  shouldOfferAndroidUpdate,
  type AndroidAppUpdateConfig,
} from './appUpdateConfig';

/** Public endpoint added to server.ts (also reachable through the /server-api alias). */
const ANDROID_UPDATE_ENDPOINT = '/api/android/version';

/**
 * Overall budget for one check. Nothing in the app waits for this request, and a slow
 * or hanging endpoint is simply abandoned once this elapses.
 */
const UPDATE_CHECK_TIMEOUT_MS = 10_000;

/** A foreground return re-checks at most this often (no continuous polling). */
const UPDATE_CHECK_COOLDOWN_MS = 5 * 60 * 1000;

/** The APK file name the existing download flow uses (LovemeetlyApkDownloads). */
const APK_FILE_NAME = 'lovemeetly.apk';

/**
 * "Later" is remembered per app session (the WebView lifetime), per version, in
 * memory only - so the prompt cannot reappear every few seconds. A NEWER release
 * still prompts, and a forced update ignores this entirely.
 */
let dismissedVersionCode: number | null = null;

/**
 * versionCode of the running APK, or null when it cannot be read (plugin unavailable,
 * unexpected value). Callers treat null as "skip the check" rather than guessing.
 */
export async function readInstalledAndroidVersionCode(): Promise<number | null> {
  try {
    const info = await App.getInfo();
    const parsed = Number.parseInt(String(info?.build ?? '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch (error) {
    console.debug('Installed Android version unavailable:', error);
    return null;
  }
}

/**
 * Fetches and validates the remote document. Never throws.
 *
 * @returns the validated config, or null when the endpoint is unreachable, slower than
 *     the timeout, answers with a non-2xx status, answers with invalid JSON, or answers
 *     with a payload that fails validation.
 */
export async function fetchAndroidUpdateConfig(): Promise<AndroidAppUpdateConfig | null> {
  const deadline = Date.now() + UPDATE_CHECK_TIMEOUT_MS;
  const candidates = [
    resolveApiUrl(ANDROID_UPDATE_ENDPOINT),
    resolveFallbackApiUrl(ANDROID_UPDATE_ENDPOINT),
  ].filter((url, index, all) => Boolean(url) && all.indexOf(url) === index);

  for (const url of candidates) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetch(url, {
        method: 'GET',
        // A bare GET with only CORS-safelisted headers: no preflight, no credentials.
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const config = parseAndroidUpdateConfig(await res.json().catch(() => null));
      if (config) return config;
    } catch {
      // Offline, aborted/timed out, or invalid JSON: try the next URL, then give up.
    } finally {
      window.clearTimeout(timer);
    }
  }

  return null;
}

/**
 * Starts the APK download through the EXISTING download flow: the same anchor the
 * site's "Download APK" links use (Sidebar / ProfileSettingsHub), which the native
 * WebView DownloadListener (LovemeetlyApkDownloads) hands to Android's
 * DownloadManager. Nothing is installed silently - the user installs the downloaded
 * file themselves.
 */
export function openAndroidUpdateDownload(updateUrl: string): void {
  try {
    if (!isUsableUpdateUrl(updateUrl)) {
      console.warn('Android update download skipped: unusable update URL.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = updateUrl.trim();
    anchor.setAttribute('download', APK_FILE_NAME);
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch (error) {
    // The existing Settings > "Download Android App" entry still works as a fallback.
    console.warn('Android update download could not be started:', error);
  }
}

export interface AndroidAppUpdatePromptState {
  /** The newer release to offer, or null while there is nothing to show. */
  update: AndroidAppUpdateConfig | null;
  /** "Later": hides this version's prompt for the rest of the app session. */
  dismiss: () => void;
}

/**
 * Wires the check into the Android app lifecycle (startup + foreground return).
 * On the web this returns a permanently empty state, so no prompt ever exists there.
 */
export function useAndroidAppUpdatePrompt(): AndroidAppUpdatePromptState {
  const [update, setUpdate] = useState<AndroidAppUpdateConfig | null>(null);

  useEffect(() => {
    if (!isAndroidApp()) return;

    let cancelled = false;

    const runCheck = async () => {
      const installed = await readInstalledAndroidVersionCode();
      if (cancelled || installed === null) return;

      const config = await fetchAndroidUpdateConfig();
      if (cancelled) return;

      // Debug visibility only (logcat): never user facing, never blocking.
      console.debug(
        `[app-update] installed versionCode=${installed}, published versionCode=${config?.latestVersionCode ?? 'unavailable'}`
      );

      if (!config || !shouldOfferAndroidUpdate(installed, config)) return;

      // "Later" silences that release for this session; a forced update is always shown.
      if (!config.forceUpdate && dismissedVersionCode === config.latestVersionCode) return;

      setUpdate(config);
    };

    void runCheck();

    let lastCheckedAt = Date.now();
    const unsubscribe = onAndroidAppResume(() => {
      if (Date.now() - lastCheckedAt < UPDATE_CHECK_COOLDOWN_MS) return;
      lastCheckedAt = Date.now();
      void runCheck();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const dismiss = useCallback(() => {
    setUpdate((current) => {
      if (current && !current.forceUpdate) dismissedVersionCode = current.latestVersionCode;
      return null;
    });
  }, []);

  return { update, dismiss };
}
