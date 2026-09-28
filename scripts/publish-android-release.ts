// Lovemeetly Android release publisher (explicit, protected, idempotent).
//
// Run it AFTER the new APK has been uploaded to https://lovemeetly.com/downloads/lovemeetly.apk:
//
//   npm run release:android -- --version-code 2 --version-name 2.0 --notes "Bug fixes"
//
// What it does, in order:
//   1. reads android-release.json (the currently published release) and android/app/build.gradle
//   2. refuses to continue unless the versionCode is an integer that is NUMERICALLY newer than the
//      published one (and, by default, matches the versionCode/versionName in build.gradle)
//   3. calls the protected admin action POST /server-api/admin/android-release with an admin session
//      token, which updates the release metadata and sends the FCM app_update notification exactly
//      once for that versionCode
//
// The token comes from LM_ADMIN_SESSION_TOKEN (an ADMIN / super-admin user's session token, the
// same value the app stores after login) or --session-token. It is only ever sent to the API as the
// x-session-token header; no Firebase credential is read, stored or printed by this script.
//
// Flags: --resend (re-announce an already published versionCode), --no-notify (metadata only),
//        --local-only (edit android-release.json locally instead of calling the API),
//        --dry-run (validate and print, change nothing), --skip-gradle-check,
//        --api <origin> (default https://lovemeetly.com).

import fs from 'fs';
import path from 'path';

import {
  DEFAULT_ANDROID_APK_URL,
  isNewerAndroidRelease,
  parseAndroidReleaseMetadata,
  readAndroidReleaseMetadata,
  resolveAndroidReleasePath,
  toAndroidVersionCode,
  writeAndroidReleaseMetadata,
  type AndroidReleaseMetadata,
} from '../src/lib/androidRelease.ts';

interface Options {
  versionCode: number | null;
  versionName: string;
  notes: string;
  forceUpdate: boolean;
  resend: boolean;
  notify: boolean;
  localOnly: boolean;
  dryRun: boolean;
  skipGradleCheck: boolean;
  api: string;
  sessionToken: string;
}

function readArgValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}.`);
  }
  return value;
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    versionCode: null,
    versionName: '',
    notes: '',
    forceUpdate: false,
    resend: false,
    notify: true,
    localOnly: false,
    dryRun: false,
    skipGradleCheck: false,
    api: (process.env.LM_RELEASE_API || 'https://lovemeetly.com').trim().replace(/\/+$/, ''),
    sessionToken: (process.env.LM_ADMIN_SESSION_TOKEN || '').trim(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--version-code':
      case '--versionCode':
        options.versionCode = toAndroidVersionCode(readArgValue(argv, index, arg));
        index += 1;
        break;
      case '--version-name':
      case '--versionName':
        options.versionName = readArgValue(argv, index, arg).trim();
        index += 1;
        break;
      case '--notes':
      case '--release-notes':
        options.notes = readArgValue(argv, index, arg);
        index += 1;
        break;
      case '--api':
        options.api = readArgValue(argv, index, arg).trim().replace(/\/+$/, '');
        index += 1;
        break;
      case '--session-token':
        options.sessionToken = readArgValue(argv, index, arg).trim();
        index += 1;
        break;
      case '--force':
        options.forceUpdate = true;
        break;
      case '--resend':
        options.resend = true;
        break;
      case '--no-notify':
        options.notify = false;
        break;
      case '--local-only':
        options.localOnly = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-gradle-check':
        options.skipGradleCheck = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printUsage(): void {
  console.log(
    [
      'Usage: npm run release:android -- --version-code <n> --version-name <x.y> [options]',
      '',
      '  --version-code <n>    Android versionCode of the APK just uploaded (integer, > published)',
      '  --version-name <v>    Android versionName of that APK, e.g. 2.0',
      '  --notes "<text>"      Optional release notes shown in the in-app prompt',
      '  --force               Make the in-app prompt non-dismissible (forceUpdate)',
      '  --resend              Re-announce the already published versionCode (explicit re-send)',
      '  --no-notify           Update the metadata but send no FCM notification',
      '  --local-only          Edit android-release.json locally instead of calling the API',
      '  --dry-run             Validate everything and print the plan; change nothing',
      '  --skip-gradle-check   Do not require build.gradle to match the arguments',
      '  --api <origin>        API origin (default https://lovemeetly.com)',
      '  --session-token <t>   Admin session token (default: $LM_ADMIN_SESSION_TOKEN)',
    ].join('\n')
  );
}

/** Reads versionCode/versionName from android/app/build.gradle (the Android version source). */
function readGradleVersion(): { versionCode: number; versionName: string } | null {
  try {
    const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
    const contents = fs.readFileSync(gradlePath, 'utf-8');
    const codeMatch = contents.match(/versionCode\s+(\d+)/);
    const nameMatch = contents.match(/versionName\s+["']([^"']*)["']/);
    if (!codeMatch) return null;
    return {
      versionCode: Number.parseInt(codeMatch[1], 10),
      versionName: nameMatch ? nameMatch[1].trim() : '',
    };
  } catch {
    return null;
  }
}

async function callReleaseApi(options: Options): Promise<number> {
  if (!options.sessionToken) {
    throw new Error(
      'No admin session token. Set LM_ADMIN_SESSION_TOKEN (an ADMIN user session token) or pass ' +
        '--session-token. Publishing is admin-only on purpose: no anonymous visitor can send pushes.'
    );
  }

  const endpoint = `${options.api}/server-api/admin/android-release`;
  console.log(`Publishing through the protected admin action: ${endpoint}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': options.sessionToken,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      versionCode: options.versionCode,
      versionName: options.versionName,
      apkUrl: DEFAULT_ANDROID_APK_URL,
      releaseNotes: options.notes,
      forceUpdate: options.forceUpdate,
      resend: options.resend,
      notify: options.notify,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload: any = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Release action failed: ${payload?.error || `HTTP ${response.status}`}`);
  }

  console.log('Release published:', JSON.stringify(payload, null, 2));
  if (!payload?.fcmSent) {
    console.log(
      options.notify
        ? 'No notification was sent: this versionCode had already been announced.'
        : 'Notification was intentionally skipped (--no-notify).'
    );
    return 0;
  }

  const push = payload.push || {};
  console.log(
    `FCM app_update notification sent for versionCode=${payload?.released?.versionCode}: ` +
      `attempted=${push.attempted ?? 0} delivered=${push.delivered ?? 0} failed=${push.failed ?? 0}`
  );
  if ((push.attempted ?? 0) === 0) {
    console.log('No Android device token is registered yet, so nothing was delivered.');
  }
  return 0;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  if (options.versionCode === null) {
    throw new Error("--version-code must be an integer >= 1 (the APK's Android versionCode).");
  }
  if (!options.versionName) {
    throw new Error('--version-name is required (e.g. 2.0) - it is what users see.');
  }

  const releasePath = resolveAndroidReleasePath();
  const published = readAndroidReleaseMetadata();
  console.log(
    `Published release document: ${releasePath}\n` +
      `  versionCode=${published.versionCode} versionName=${published.versionName} ` +
      `notifiedVersionCode=${published.notifiedVersionCode}`
  );

  const isNewer = isNewerAndroidRelease(options.versionCode, published.versionCode);
  const isSame = options.versionCode === published.versionCode;
  if (!isNewer && !(isSame && options.resend)) {
    throw new Error(
      `versionCode ${options.versionCode} is not newer than the published versionCode ` +
        `${published.versionCode}. A release can never go backwards: pass a newer versionCode, or ` +
        '--resend to re-announce the already published one.'
    );
  }

  if (!options.skipGradleCheck) {
    const gradle = readGradleVersion();
    if (!gradle) {
      console.warn(
        'android/app/build.gradle could not be read; skipping the build.gradle consistency check.'
      );
    } else {
      if (gradle.versionCode !== options.versionCode) {
        throw new Error(
          `android/app/build.gradle has versionCode ${gradle.versionCode} but you passed ` +
            `${options.versionCode}. Bump build.gradle (or pass --skip-gradle-check).`
        );
      }
      if (gradle.versionName && gradle.versionName !== options.versionName) {
        throw new Error(
          `android/app/build.gradle has versionName "${gradle.versionName}" but you passed ` +
            `"${options.versionName}". Bump build.gradle (or pass --skip-gradle-check).`
        );
      }
      console.log(
        `build.gradle matches: versionCode ${gradle.versionCode} / "${gradle.versionName}"`
      );
    }
  }

  const apkUrl = DEFAULT_ANDROID_APK_URL;
  if (published.apkUrl !== apkUrl) {
    console.warn(
      `The published document points at ${published.apkUrl}; this release publishes the fixed ` +
        `${apkUrl} instead.`
    );
  }

  // Same idempotency rule the server applies: a versionCode that was already announced is not
  // announced again unless --resend is given.
  const willNotify =
    options.notify &&
    (options.resend || isNewerAndroidRelease(options.versionCode, published.notifiedVersionCode));

  if (options.dryRun) {
    console.log(
      [
        'Dry run - nothing was changed.',
        `  would publish  versionCode=${options.versionCode} versionName=${options.versionName}`,
        `  apkUrl         ${apkUrl}`,
        `  releaseNotes   ${options.notes || '(none)'}`,
        `  forceUpdate    ${options.forceUpdate}`,
        `  fcmNotify      ${willNotify ? 'yes (one app_update push to Android devices)' : 'no'}`,
      ].join('\n')
    );
    return;
  }

  if (options.localOnly) {
    const next: AndroidReleaseMetadata = {
      versionCode: options.versionCode,
      versionName: options.versionName,
      apkUrl,
      releaseNotes: options.notes,
      forceUpdate: options.forceUpdate,
      publishedAt: published.publishedAt,
      // No FCM send happens from a local-only run, so the release stays unannounced on purpose.
      notifiedVersionCode: published.notifiedVersionCode,
    };
    if (!writeAndroidReleaseMetadata(next)) {
      throw new Error(`Could not write ${releasePath}.`);
    }
    console.log(
      `Updated ${releasePath} to versionCode=${options.versionCode} (v${options.versionName}).\n` +
        'No FCM notification was sent (--local-only). Devices are notified by running this command ' +
        'without --local-only, or with --resend once the file is live on the server.'
    );
    return;
  }

  if (!willNotify && options.notify) {
    console.log(
      'This versionCode was already announced to devices; pass --resend if a second notification ' +
        'for it is really wanted.'
    );
  }

  process.exitCode = await callReleaseApi(options);
}

main().catch((error: unknown) => {
  console.error(`Release aborted: ${(error as Error)?.message ?? error}`);
  process.exitCode = 1;
});