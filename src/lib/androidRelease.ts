// Server-side Android release metadata: the single source of truth for "which APK build is
// currently published". It feeds
//
//   * the public read-only endpoint GET /api/android/version (the in-app update prompt), and
//   * the FCM app_update notification (type = "app_update") that
//     LovemeetlyMessagingService renders on Android.
//
// Design constraints, all deliberate:
//  - the metadata is a small JSON document next to the app root (android-release.json), NOT a
//    database row: it is static release configuration, identical for every visitor, and must
//    survive a database reset untouched.
//  - versions are compared as INTEGERS (Android's versionCode), never as strings, so 10 > 9.
//  - reading can never throw: a missing, unreadable or malformed file falls back to the built-in
//    defaults, so the public endpoint always answers and the Android client never sees a bogus
//    "update available".
//  - writing is atomic (temp file + rename) so a reader can never observe a half-written file.
//  - `notifiedVersionCode` makes publishing idempotent: re-publishing the same versionCode can
//    never send the FCM update notification again unless it is explicitly requested.
//  - this module is Node-only (fs/path) and is imported by server.ts and by the release CLI
//    (scripts/publish-android-release.ts). It is never part of the web bundle, and it holds no
//    credentials whatsoever.

import fs from 'fs';
import path from 'path';

export interface AndroidReleaseMetadata {
  /** Android versionCode of the published APK (android/app/build.gradle). Integer, >= 1. */
  versionCode: number;
  /** Android versionName of the published APK (android/app/build.gradle), e.g. "2.0". */
  versionName: string;
  /** Absolute http(s) URL of the official APK. */
  apkUrl: string;
  /** Optional release notes shown in the in-app prompt. */
  releaseNotes: string;
  /** Optional: only a literal `true` forces the in-app prompt to be non-dismissible. */
  forceUpdate: boolean;
  /** ISO timestamp of the last publish action, or null for the built-in initial document. */
  publishedAt: string | null;
  /** versionCode the FCM app_update notification was last sent for (idempotency marker). */
  notifiedVersionCode: number;
}

/** File name read from the app root (process.cwd()), deployable as a normal repository file. */
export const ANDROID_RELEASE_FILE_NAME = 'android-release.json';

/**
 * Fixed public APK URL. Must stay byte-identical to the site's "Download APK" anchor href and to
 * the native constant `LovemeetlyApkDownloads.APK_URL`.
 */
export const DEFAULT_ANDROID_APK_URL = 'https://lovemeetly.com/downloads/lovemeetly.apk';

/** The document used when no release file exists yet (matches android/app/build.gradle: 1 / 1.0). */
export const DEFAULT_ANDROID_RELEASE: AndroidReleaseMetadata = {
  versionCode: 1,
  versionName: '1.0',
  apkUrl: DEFAULT_ANDROID_APK_URL,
  releaseNotes: '',
  forceUpdate: false,
  publishedAt: null,
  notifiedVersionCode: 1,
};

/** Where android-release.json lives. Overridable for tests/deployments. */
export function resolveAndroidReleasePath(): string {
  const configured =
    typeof process.env.ANDROID_RELEASE_FILE === 'string' ? process.env.ANDROID_RELEASE_FILE.trim() : '';
  return configured ? path.resolve(configured) : path.join(process.cwd(), ANDROID_RELEASE_FILE_NAME);
}

/** Accepts a number or a numeric string; anything below 1 or unparsable is rejected. */
export function toAndroidVersionCode(value: unknown): number | null {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 ? rounded : null;
}

/**
 * True for an absolute http(s) URL without whitespace - the only shape the Android download path
 * accepts (LovemeetlyApkDownloads.isApkDownload only handles http/https).
 */
export function isUsableApkUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return /^https?:\/\//i.test(trimmed);
}

/**
 * Validates a raw release document (a JSON file's contents or an admin request body).
 *
 * Strict on the two fields that decide whether users are told to update - a positive integer
 * `versionCode` and an absolute http(s) `apkUrl` - and lenient (defaulted) on the display-only
 * fields. Returns null instead of throwing, so a caller can fail closed.
 */
export function parseAndroidReleaseMetadata(raw: unknown): AndroidReleaseMetadata | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;

  const versionCode = toAndroidVersionCode(source.versionCode);
  if (versionCode === null) return null;

  const apkUrl = typeof source.apkUrl === 'string' ? source.apkUrl.trim() : '';
  if (!isUsableApkUrl(apkUrl)) return null;

  const versionName =
    typeof source.versionName === 'string' && source.versionName.trim()
      ? source.versionName.trim()
      : String(versionCode);
  const releaseNotes = typeof source.releaseNotes === 'string' ? source.releaseNotes.trim() : '';
  const publishedAt =
    typeof source.publishedAt === 'string' && source.publishedAt.trim()
      ? source.publishedAt.trim()
      : null;
  const notifiedVersionCode = toAndroidVersionCode(source.notifiedVersionCode) ?? versionCode;

  return {
    versionCode,
    versionName,
    apkUrl,
    releaseNotes,
    // Strict: a string "true" or any truthy value must not be able to force an update.
    forceUpdate: source.forceUpdate === true,
    publishedAt,
    notifiedVersionCode,
  };
}

/** Numeric versionCode comparison (never string): true only when `next` is genuinely newer. */
export function isNewerAndroidRelease(next: unknown, current: unknown): boolean {
  const nextCode = toAndroidVersionCode(next);
  const currentCode = toAndroidVersionCode(current);
  if (nextCode === null) return false;
  if (currentCode === null) return true;
  return nextCode > currentCode;
}

/**
 * Idempotency rule for the FCM update notification: send only when the published versionCode is
 * strictly newer than the one already announced. Publishing the same versionCode again therefore
 * spams nobody (an explicit resend has to be requested).
 */
export function shouldNotifyAndroidRelease(
  release: Pick<AndroidReleaseMetadata, 'versionCode'> | null | undefined,
  notifiedVersionCode: unknown
): boolean {
  const code = toAndroidVersionCode(release?.versionCode);
  if (code === null) return false;
  return isNewerAndroidRelease(code, notifiedVersionCode);
}

/** Last successfully read document, keyed by file mtime+size so an edit is picked up immediately. */
let cachedRelease: { key: string; value: AndroidReleaseMetadata } | null = null;

/**
 * Reads android-release.json. Never throws and never returns null: a missing, unreadable or
 * malformed document resolves to {@link DEFAULT_ANDROID_RELEASE}, which can only ever mean
 * "no update available".
 */
export function readAndroidReleaseMetadata(): AndroidReleaseMetadata {
  const filePath = resolveAndroidReleasePath();
  try {
    const stat = fs.statSync(filePath);
    const key = `${filePath}:${stat.mtimeMs}:${stat.size}`;
    if (cachedRelease && cachedRelease.key === key) return cachedRelease.value;

    const parsed = parseAndroidReleaseMetadata(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    if (!parsed) {
      console.warn(
        `[Android Release] ${ANDROID_RELEASE_FILE_NAME} is malformed (versionCode/apkUrl); ` +
          'falling back to the built-in release defaults.'
      );
      cachedRelease = { key, value: DEFAULT_ANDROID_RELEASE };
      return DEFAULT_ANDROID_RELEASE;
    }
    cachedRelease = { key, value: parsed };
    return parsed;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      console.warn(
        `[Android Release] Could not read ${ANDROID_RELEASE_FILE_NAME}: ` +
          `${(err as Error)?.message ?? 'unknown error'}`
      );
    }
    return DEFAULT_ANDROID_RELEASE;
  }
}

/**
 * Atomically persists the release document (temp file + rename).
 *
 * @returns true on success; false when the file could not be written (the caller must then report
 *     the failure and must NOT claim the release was published or sent).
 */
export function writeAndroidReleaseMetadata(metadata: AndroidReleaseMetadata): boolean {
  const filePath = resolveAndroidReleasePath();
  const normalized = parseAndroidReleaseMetadata(metadata);
  if (!normalized) {
    console.error('[Android Release] Refusing to write an invalid release document.');
    return false;
  }

  const document = {
    ...normalized,
    publishedAt: metadata.publishedAt ?? new Date().toISOString(),
  };
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;

  try {
    fs.writeFileSync(tmpPath, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');
    fs.renameSync(tmpPath, filePath);
    cachedRelease = null; // The next read must come from disk.
    return true;
  } catch (err) {
    console.error(
      `[Android Release] Could not write ${filePath}: ${(err as Error)?.message ?? 'unknown error'}`
    );
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // Best effort cleanup only.
    }
    return false;
  }
}