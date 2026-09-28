// Focused tests for the Android release metadata + app_update push (src/lib/androidRelease.ts and
// the app_update helpers in src/lib/push.ts).
//
// Run with:  npm run test:release
//            (node --import tsx --test src/lib/androidRelease.test.ts)
//
// No network, no credentials, no database and no real FCM send are involved: the Admin SDK client is
// replaced by a fake that records the exact request, and the metadata file is a temporary document.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ANDROID_RELEASE_FILE_NAME,
  DEFAULT_ANDROID_APK_URL,
  DEFAULT_ANDROID_RELEASE,
  isNewerAndroidRelease,
  isUsableApkUrl,
  parseAndroidReleaseMetadata,
  readAndroidReleaseMetadata,
  resolveAndroidReleasePath,
  shouldNotifyAndroidRelease,
  toAndroidVersionCode,
  writeAndroidReleaseMetadata,
  type AndroidReleaseMetadata,
} from './androidRelease.ts';
import {
  APP_UPDATE_TITLE,
  APP_UPDATE_TYPE,
  buildAndroidAppUpdateMulticastRequest,
  buildAppUpdateNotificationBody,
  buildAppUpdatePushData,
  classifyMulticastResults,
  sendAndroidAppUpdatePush,
  type AndroidMulticastMessage,
  type MulticastMessaging,
} from './push.ts';

const APK_URL = 'https://lovemeetly.com/downloads/lovemeetly.apk';

const RELEASE: AndroidReleaseMetadata = {
  versionCode: 2,
  versionName: '2.0',
  apkUrl: APK_URL,
  releaseNotes: 'New features.',
  forceUpdate: false,
  publishedAt: null,
  notifiedVersionCode: 1,
};

/** Minimal stand-in for firebase-admin's Messaging that captures what it was asked to send. */
function fakeMessaging(
  respond: (request: AndroidMulticastMessage) => Array<{ success: boolean; code?: string }>
) {
  const calls: AndroidMulticastMessage[] = [];
  const messaging: MulticastMessaging = {
    async sendEachForMulticast(request) {
      calls.push(request);
      return {
        responses: respond(request).map((entry) =>
          entry.success
            ? { success: true }
            : { success: false, error: { code: entry.code ?? 'messaging/internal-error' } }
        ),
      };
    },
  };
  return { messaging, calls };
}

test('the fixed public APK URL is the only accepted apkUrl', () => {
  assert.equal(DEFAULT_ANDROID_APK_URL, APK_URL);
  assert.equal(isUsableApkUrl(APK_URL), true);
  assert.equal(isUsableApkUrl('  https://lovemeetly.com/downloads/lovemeetly.apk  '), true);
  assert.equal(isUsableApkUrl('/downloads/lovemeetly.apk'), false);
  assert.equal(isUsableApkUrl('ftp://lovemeetly.com/lovemeetly.apk'), false);
  assert.equal(isUsableApkUrl('javascript:alert(1)'), false);
  assert.equal(isUsableApkUrl('https://lovemeetly.com/a b.apk'), false);
  assert.equal(isUsableApkUrl(undefined), false);
});

test('versionCode parsing only accepts positive integers (numbers or numeric strings)', () => {
  assert.equal(toAndroidVersionCode(2), 2);
  assert.equal(toAndroidVersionCode(' 7 '), 7);
  assert.equal(toAndroidVersionCode(2.9), 2);
  assert.equal(toAndroidVersionCode(0), null);
  assert.equal(toAndroidVersionCode(-1), null);
  assert.equal(toAndroidVersionCode('2.0'), 2);
  assert.equal(toAndroidVersionCode('v2'), null);
  assert.equal(toAndroidVersionCode(null), null);
  assert.equal(toAndroidVersionCode(Number.NaN), null);
  assert.equal(toAndroidVersionCode(Number.POSITIVE_INFINITY), null);
});

test('a complete release document is accepted', () => {
  const parsed = parseAndroidReleaseMetadata(RELEASE);
  assert.deepEqual(parsed, RELEASE);
});

test('display-only fields are defaulted, never invented', () => {
  const parsed = parseAndroidReleaseMetadata({
    versionCode: 3,
    apkUrl: APK_URL,
  });
  assert.ok(parsed);
  assert.equal(parsed?.versionName, '3');
  assert.equal(parsed?.releaseNotes, '');
  assert.equal(parsed?.forceUpdate, false);
  assert.equal(parsed?.publishedAt, null);
  assert.equal(parsed?.notifiedVersionCode, 3);
});

test('forceUpdate only honours a literal boolean true', () => {
  const base = { versionCode: 3, apkUrl: APK_URL };
  assert.equal(parseAndroidReleaseMetadata({ ...base, forceUpdate: true })?.forceUpdate, true);
  assert.equal(parseAndroidReleaseMetadata({ ...base, forceUpdate: false })?.forceUpdate, false);
  assert.equal(parseAndroidReleaseMetadata({ ...base, forceUpdate: 'true' })?.forceUpdate, false);
  assert.equal(parseAndroidReleaseMetadata({ ...base, forceUpdate: 1 })?.forceUpdate, false);
});

test('malformed documents are rejected instead of published', () => {
  const rejected: unknown[] = [
    null,
    undefined,
    'not-json',
    42,
    [],
    {},
    { apkUrl: APK_URL },
    { versionCode: 0, apkUrl: APK_URL },
    { versionCode: -3, apkUrl: APK_URL },
    { versionCode: 'abc', apkUrl: APK_URL },
    { versionCode: 2 },
    { versionCode: 2, apkUrl: '' },
    { versionCode: 2, apkUrl: 'notaurl' },
  ];
  for (const payload of rejected) {
    assert.equal(
      parseAndroidReleaseMetadata(payload),
      null,
      `should reject ${JSON.stringify(payload)}`
    );
  }
});

test('versionCode comparison is numeric, so 10 is newer than 9', () => {
  assert.equal(isNewerAndroidRelease(10, 9), true);
  assert.equal(isNewerAndroidRelease(9, 10), false);
  assert.equal(isNewerAndroidRelease(2, 2), false);
  assert.equal(isNewerAndroidRelease('2', 1), true);
  assert.equal(isNewerAndroidRelease(0, 1), false);
  assert.equal(isNewerAndroidRelease(2, 0), true);
});

test('publishing the same versionCode again never notifies twice (idempotency)', () => {
  assert.equal(shouldNotifyAndroidRelease(RELEASE, 1), true);
  assert.equal(shouldNotifyAndroidRelease(RELEASE, 2), false);
  assert.equal(shouldNotifyAndroidRelease(RELEASE, 3), false);
  assert.equal(shouldNotifyAndroidRelease(RELEASE, null), true);
  assert.equal(shouldNotifyAndroidRelease(null, 1), false);
});

test('the update push data matches the documented contract', () => {
  const data = buildAppUpdatePushData(RELEASE);

  assert.equal(data.type, 'app_update');
  assert.equal(APP_UPDATE_TYPE, 'app_update');
  assert.equal(data.type, APP_UPDATE_TYPE);
  assert.equal(data.versionCode, '2');
  assert.equal(data.versionName, '2.0');
  assert.equal(data.apkUrl, APK_URL);
  assert.equal(data.title, 'Lovemeetly update available');
  assert.equal(data.title, APP_UPDATE_TITLE);
  assert.equal(data.body, 'Lovemeetly 2.0 is now available. Tap to update.');
  assert.equal(buildAppUpdateNotificationBody('2.0'), data.body);
  // Every value must be a string: FCM data messages only carry strings.
  for (const value of Object.values(data)) {
    assert.equal(typeof value, 'string');
  }
});

test('the update request is data-only, high priority and free of a web block', () => {
  const request = buildAndroidAppUpdateMulticastRequest(
    ['android_token_aaaaaaaaaaaaaaaaaaaaaa'],
    RELEASE
  );

  assert.deepEqual(Object.keys(request).sort(), ['android', 'data', 'tokens']);
  assert.deepEqual(request.android, { priority: 'high' });
  const raw = request as unknown as Record<string, unknown>;
  assert.equal(raw.notification, undefined);
  assert.equal(raw.webpush, undefined);
  assert.equal(request.data.type, APP_UPDATE_TYPE);
  assert.equal(request.tokens.length, 1);
});

test('sending the update classifies results and only prunes permanently invalid tokens', async () => {
  const staleToken = 'android_token_stale_aaaaaaaaaaaaaaaaaa';
  const transientToken = 'android_token_transient_aaaaaaaaaaaaaa';
  const goodToken = 'android_token_good_aaaaaaaaaaaaaaaaa';

  const { messaging, calls } = fakeMessaging(() => [
    { success: true },
    { success: false, code: 'messaging/registration-token-not-registered' },
    { success: false, code: 'messaging/server-unavailable' },
  ]);

  const result = await sendAndroidAppUpdatePush(
    messaging,
    [goodToken, staleToken, transientToken],
    RELEASE
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.versionCode, '2');
  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 2);
  assert.deepEqual(result.staleTokens, [staleToken]);
  assert.deepEqual(result.errorCodes.slice().sort(), [
    'messaging/registration-token-not-registered',
    'messaging/server-unavailable',
  ]);
});

test('classification of a failed multicast never invents stale tokens', () => {
  const result = classifyMulticastResults(
    [{ success: false, error: { code: 'messaging/internal-error' } }],
    ['android_token_x_aaaaaaaaaaaaaaaaaaaaaaaa']
  );
  assert.deepEqual(result.staleTokens, []);
  assert.equal(result.failed, 1);
});

test('release metadata survives a write/read round trip through the JSON document', () => {
  const previous = process.env.ANDROID_RELEASE_FILE;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-release-'));
  const file = path.join(dir, ANDROID_RELEASE_FILE_NAME);
  process.env.ANDROID_RELEASE_FILE = file;

  try {
    assert.equal(resolveAndroidReleasePath(), file);
    fs.writeFileSync(
      file,
      JSON.stringify({ versionCode: 1, versionName: '1.0', apkUrl: APK_URL, notifiedVersionCode: 1 }),
      'utf-8'
    );
    assert.equal(readAndroidReleaseMetadata().versionCode, 1);

    assert.equal(writeAndroidReleaseMetadata({ ...RELEASE, publishedAt: null }), true);
    const reloaded = readAndroidReleaseMetadata();
    assert.equal(reloaded.versionCode, 2);
    assert.equal(reloaded.versionName, '2.0');
    assert.equal(reloaded.apkUrl, APK_URL);
    assert.equal(reloaded.notifiedVersionCode, 1);
    assert.ok(reloaded.publishedAt, 'a publish action records publishedAt');

    // A malformed document can only ever fall back to "no update available".
    fs.writeFileSync(file, '{ not json', 'utf-8');
    assert.deepEqual(readAndroidReleaseMetadata(), DEFAULT_ANDROID_RELEASE);

    // Writing rubbish is refused instead of corrupting the document.
    assert.equal(writeAndroidReleaseMetadata({ ...RELEASE, versionCode: 0 }), false);
  } finally {
    if (previous === undefined) delete process.env.ANDROID_RELEASE_FILE;
    else process.env.ANDROID_RELEASE_FILE = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing release document falls back to the built-in defaults', () => {
  const previous = process.env.ANDROID_RELEASE_FILE;
  process.env.ANDROID_RELEASE_FILE = path.join(os.tmpdir(), 'lm-release-does-not-exist.json');
  try {
    assert.deepEqual(readAndroidReleaseMetadata(), DEFAULT_ANDROID_RELEASE);
    assert.equal(DEFAULT_ANDROID_RELEASE.apkUrl, APK_URL);
  } finally {
    if (previous === undefined) delete process.env.ANDROID_RELEASE_FILE;
    else process.env.ANDROID_RELEASE_FILE = previous;
  }
});

test('the shipped release document agrees with android/app/build.gradle', () => {
  const previous = process.env.ANDROID_RELEASE_FILE;
  delete process.env.ANDROID_RELEASE_FILE;
  try {
    const release = readAndroidReleaseMetadata();
    assert.equal(release.apkUrl, APK_URL, 'the published APK URL must stay fixed');

    const gradle = fs.readFileSync(
      path.join(process.cwd(), 'android', 'app', 'build.gradle'),
      'utf-8'
    );
    const gradleCode = Number.parseInt(gradle.match(/versionCode\s+(\d+)/)?.[1] ?? '', 10);
    const gradleName = gradle.match(/versionName\s+["']([^"']*)["']/)?.[1];

    assert.equal(
      release.versionCode,
      gradleCode,
      'android-release.json must not drift from the Android versionCode'
    );
    assert.equal(
      release.versionName,
      gradleName,
      'android-release.json must not drift from the Android versionName'
    );
  } finally {
    if (previous !== undefined) process.env.ANDROID_RELEASE_FILE = previous;
  }
});