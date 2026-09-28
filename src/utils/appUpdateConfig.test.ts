// Focused tests for the Android in-app update check rules (src/utils/appUpdateConfig.ts).
//
// Run with:  npm run test:update-check
//            (node --import tsx --test src/utils/appUpdateConfig.test.ts)
//
// No network, no Capacitor and no Android device are involved: only the pure
// parsing/comparison rules are exercised, i.e. exactly the "remote endpoint unavailable,
// offline, malformed or partial payload, unreadable version" cases that must never
// produce a prompt (and must never break the app).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isUsableUpdateUrl,
  parseAndroidUpdateConfig,
  shouldOfferAndroidUpdate,
} from './appUpdateConfig.ts';

/** The exact document GET /api/android/version serves (server.ts). */
const PRODUCTION_PAYLOAD = {
  latestVersionCode: 2,
  latestVersionName: '1.0.1',
  updateUrl: 'https://lovemeetly.com/downloads/lovemeetly.apk',
  releaseNotes: 'Bug fixes and performance improvements.',
  forceUpdate: false,
};

test('the documented production payload is accepted', () => {
  const config = parseAndroidUpdateConfig(PRODUCTION_PAYLOAD);

  assert.ok(config);
  assert.equal(config?.latestVersionCode, 2);
  assert.equal(config?.latestVersionName, '1.0.1');
  assert.equal(config?.updateUrl, 'https://lovemeetly.com/downloads/lovemeetly.apk');
  assert.equal(config?.releaseNotes, 'Bug fixes and performance improvements.');
  assert.equal(config?.forceUpdate, false);
});

test('optional fields may be absent and default to safe values', () => {
  const config = parseAndroidUpdateConfig({
    latestVersionCode: 2,
    latestVersionName: '1.0.1',
    updateUrl: 'https://lovemeetly.com/downloads/lovemeetly.apk',
  });

  assert.ok(config);
  assert.equal(config?.releaseNotes, '');
  assert.equal(config?.forceUpdate, false);
});

test('a numeric versionCode as string is tolerated, a missing name falls back to it', () => {
  const config = parseAndroidUpdateConfig({
    latestVersionCode: '  7 ',
    latestVersionName: '   ',
    updateUrl: 'https://lovemeetly.com/downloads/lovemeetly.apk',
  });

  assert.ok(config);
  assert.equal(config?.latestVersionCode, 7);
  assert.equal(config?.latestVersionName, '7');
});

test('forceUpdate only honours a literal boolean true', () => {
  const base = {
    latestVersionCode: 3,
    latestVersionName: '1.1',
    updateUrl: 'https://lovemeetly.com/downloads/lovemeetly.apk',
  };

  assert.equal(parseAndroidUpdateConfig({ ...base, forceUpdate: true })?.forceUpdate, true);
  assert.equal(parseAndroidUpdateConfig({ ...base, forceUpdate: false })?.forceUpdate, false);
  assert.equal(parseAndroidUpdateConfig({ ...base, forceUpdate: 'true' })?.forceUpdate, false);
  assert.equal(parseAndroidUpdateConfig({ ...base, forceUpdate: 1 })?.forceUpdate, false);
});

test('malformed documents are rejected instead of prompting', () => {
  const updateUrl = 'https://lovemeetly.com/downloads/lovemeetly.apk';
  const rejected: unknown[] = [
    null,
    undefined,
    'not-json',
    42,
    [],
    {},
    { latestVersionCode: 2 }, // no updateUrl
    { latestVersionCode: 0, updateUrl },
    { latestVersionCode: -5, updateUrl },
    { latestVersionCode: 'abc', updateUrl },
    { latestVersionCode: null, updateUrl },
    { latestVersionCode: Number.NaN, updateUrl },
    { latestVersionCode: Number.POSITIVE_INFINITY, updateUrl },
    { latestVersionCode: 2, updateUrl: '' },
    { latestVersionCode: 2, updateUrl: null },
    { latestVersionCode: 2, updateUrl: '/downloads/lovemeetly.apk' },
    { latestVersionCode: 2, updateUrl: 'javascript:alert(1)' },
    { latestVersionCode: 2, updateUrl: 'ftp://lovemeetly.com/lovemeetly.apk' },
    { latestVersionCode: 2, updateUrl: 'https://lovemeetly.com/a b.apk' },
  ];

  for (const payload of rejected) {
    assert.equal(parseAndroidUpdateConfig(payload), null, `should reject ${JSON.stringify(payload)}`);
  }
});

test('only absolute http(s) URLs without whitespace are usable', () => {
  assert.equal(isUsableUpdateUrl('https://lovemeetly.com/downloads/lovemeetly.apk'), true);
  assert.equal(isUsableUpdateUrl('http://10.0.0.5/lovemeetly.apk'), true);
  assert.equal(isUsableUpdateUrl('  https://lovemeetly.com/x.apk  '), true);
  assert.equal(isUsableUpdateUrl('//lovemeetly.com/x.apk'), false);
  assert.equal(isUsableUpdateUrl('lovemeetly.com/x.apk'), false);
  assert.equal(isUsableUpdateUrl('data:application/vnd.android.package-archive;base64,AA'), false);
  assert.equal(isUsableUpdateUrl('https://lovemeetly.com/a\nb.apk'), false);
  assert.equal(isUsableUpdateUrl(undefined), false);
});

test('a newer versionCode prompts, an equal or older one does not', () => {
  const config = parseAndroidUpdateConfig(PRODUCTION_PAYLOAD);

  assert.equal(shouldOfferAndroidUpdate(1, config), true);
  assert.equal(shouldOfferAndroidUpdate(2, config), false);
  assert.equal(shouldOfferAndroidUpdate(3, config), false);
});

test('the comparison is numeric, so versionCode 10 is newer than 9', () => {
  const config = parseAndroidUpdateConfig({
    latestVersionCode: 10,
    latestVersionName: '1.0.10',
    updateUrl: 'https://lovemeetly.com/downloads/lovemeetly.apk',
  });

  assert.equal(shouldOfferAndroidUpdate(9, config), true);
  assert.equal(shouldOfferAndroidUpdate('9', config), true);
});

test('an unreadable or missing installed version never prompts', () => {
  const config = parseAndroidUpdateConfig(PRODUCTION_PAYLOAD);

  assert.equal(shouldOfferAndroidUpdate(null, config), false);
  assert.equal(shouldOfferAndroidUpdate(undefined, config), false);
  assert.equal(shouldOfferAndroidUpdate('', config), false);
  assert.equal(shouldOfferAndroidUpdate('not-a-number', config), false);
  assert.equal(shouldOfferAndroidUpdate(0, config), false);
  assert.equal(shouldOfferAndroidUpdate(-3, config), false);
  assert.equal(shouldOfferAndroidUpdate(Number.NaN, config), false);
});

test('no config (endpoint unavailable / rejected payload) never prompts', () => {
  assert.equal(shouldOfferAndroidUpdate(1, null), false);
  assert.equal(shouldOfferAndroidUpdate(1, undefined), false);
  assert.equal(shouldOfferAndroidUpdate(1, parseAndroidUpdateConfig(null)), false);
});
