// Pure parsing/validation rules for the Android in-app update check.
//
// The remote document comes from the public, unauthenticated endpoint in server.ts:
//
//   GET /api/android/version
//   { latestVersionCode, latestVersionName, updateUrl, releaseNotes?, forceUpdate? }
//
// Everything in this file is dependency-free on purpose: no Capacitor, no fetch, no DOM.
// That keeps the fail-gracefully rules (unavailable endpoint, offline, malformed or
// partial payload, unparsable version) unit testable in plain Node - the same split
// src/lib/push.ts uses for the FCM payloads - and it guarantees that a bad payload can
// only ever result in "no prompt", never in a broken app.

export interface AndroidAppUpdateConfig {
  /** versionCode of the newest published APK. */
  latestVersionCode: number;
  /** versionName of the newest published APK (falls back to the versionCode). */
  latestVersionName: string;
  /** Absolute http(s) URL of the official APK. */
  updateUrl: string;
  /** Optional, may be an empty string. */
  releaseNotes: string;
  /** Optional. Only a literal `true` counts; anything else means "not forced". */
  forceUpdate: boolean;
}

/**
 * True for an absolute http(s) URL without whitespace - the only shapes the existing
 * download flow can handle (LovemeetlyApkDownloads.isApkDownload accepts http/https).
 */
export function isUsableUpdateUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return /^https?:\/\//i.test(trimmed);
}

/** Accepts a number or a numeric string; anything below 1 or unparsable is rejected. */
function toPositiveInt(value: unknown): number | null {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 ? rounded : null;
}

/**
 * Validates the remote document.
 *
 * Returns null for anything unusable - a missing/empty body, a non-object, a missing,
 * zero, negative or non-numeric `latestVersionCode`, or a missing/invalid `updateUrl` -
 * so the caller simply does not prompt. It never throws.
 */
export function parseAndroidUpdateConfig(raw: unknown): AndroidAppUpdateConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;

  const latestVersionCode = toPositiveInt(source.latestVersionCode);
  if (latestVersionCode === null) return null;

  if (!isUsableUpdateUrl(source.updateUrl)) return null;

  const versionName =
    typeof source.latestVersionName === 'string' ? source.latestVersionName.trim() : '';
  const releaseNotes = typeof source.releaseNotes === 'string' ? source.releaseNotes.trim() : '';

  return {
    latestVersionCode,
    latestVersionName: versionName || String(latestVersionCode),
    updateUrl: (source.updateUrl as string).trim(),
    releaseNotes,
    // Strict: a string "true" or a truthy value must NOT be able to force an update.
    forceUpdate: source.forceUpdate === true,
  };
}

/**
 * True only when the published build is genuinely newer than the installed one.
 *
 * Fails closed: an unknown/unreadable installed versionCode never prompts. The
 * comparison is numeric on purpose (versionCode, not versionName), so 10 > 9 as
 * Android itself defines it.
 */
export function shouldOfferAndroidUpdate(
  installedVersionCode: unknown,
  config: AndroidAppUpdateConfig | null | undefined
): boolean {
  if (!config) return false;
  const installed = toPositiveInt(installedVersionCode);
  if (installed === null) return false;
  return config.latestVersionCode > installed;
}
