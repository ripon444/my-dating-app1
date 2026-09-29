// Focused tests for the Admin Panel account-status rules (src/lib/accountStatus.ts),
// i.e. exactly the logic behind the User Management "Suspend / Block / Delete" actions
// in server.ts.
//
// Run with:  npm run test:account-status
//            (node --import tsx --test src/lib/accountStatus.test.ts)
//
// No network, no database, no Express and no credentials are involved: only the pure
// status-resolution, clamping, validation and display rules are exercised. In
// particular these tests pin down the behaviour that must never regress:
//   * a legacy `is_banned` row is still treated as restricted,
//   * an expired temporary suspension releases itself,
//   * a permanent delete is impossible without an explicit confirmation,
//   * a bad "days" value can never produce an unbounded or zero-length suspension.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SUSPEND_DAYS,
  DELETE_CONFIRMATION_PHRASE,
  MAX_STATUS_REASON_LENGTH,
  SUSPEND_MAX_DAYS,
  SUSPEND_MIN_DAYS,
  USER_ACCOUNT_STATUSES,
  clampSuspensionDays,
  describeSuspensionRemaining,
  isAccountAccessRestricted,
  isDeleteConfirmationValid,
  isSuspensionExpired,
  normalizeStatusFilter,
  normalizeStatusReason,
  resolveEffectiveAccountStatus,
  resolveStoredAccountStatus,
  resolveSuspensionEnd,
  toLegacyBannedFlag,
} from './accountStatus.ts';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const SUSPENDED_ROW = {
  account_status: 'suspended',
  is_banned: 1,
  suspended_until: '2026-10-06T12:00:00.000Z',
};

test('the assignable statuses are exactly active, suspended and blocked', () => {
  assert.deepEqual(USER_ACCOUNT_STATUSES, ['active', 'suspended', 'blocked']);
});

// -------------------------------------------------------------
// Legacy compatibility: rows written before this feature
// -------------------------------------------------------------

test('a legacy banned row with no explicit status is still restricted', () => {
  const legacyBanned = { is_banned: 1 };

  assert.equal(resolveStoredAccountStatus(legacyBanned), 'blocked');
  assert.equal(resolveEffectiveAccountStatus(legacyBanned, NOW), 'blocked');
  assert.equal(isAccountAccessRestricted(legacyBanned, NOW), true);
  assert.equal(toLegacyBannedFlag(legacyBanned, NOW), 1);
});

test('a legacy unbanned row is active', () => {
  const legacy = { is_banned: 0 };

  assert.equal(resolveStoredAccountStatus(legacy), 'active');
  assert.equal(isAccountAccessRestricted(legacy, NOW), false);
  assert.equal(toLegacyBannedFlag(legacy, NOW), 0);
});

test('an explicit status always wins over the legacy flag', () => {
  // An admin reactivated the account, so is_banned must not keep it locked.
  const reactivated = { account_status: 'active', is_banned: 1 };
  assert.equal(resolveStoredAccountStatus(reactivated), 'active');
  assert.equal(isAccountAccessRestricted(reactivated, NOW), false);

  // A suspended account always gets is_banned = 1 written alongside it.
  const suspended = { account_status: 'suspended', is_banned: 1 };
  assert.equal(resolveStoredAccountStatus(suspended), 'suspended');
  assert.equal(isAccountAccessRestricted(suspended, NOW), true);
});

test('missing, empty and unknown status values fall back safely', () => {
  assert.equal(resolveStoredAccountStatus({}), 'active');
  assert.equal(resolveStoredAccountStatus({ account_status: null, is_banned: 0 }), 'active');
  assert.equal(resolveStoredAccountStatus({ account_status: '   ' }), 'active');
  assert.equal(resolveStoredAccountStatus({ account_status: 'DELETED' }), 'active');
  assert.equal(resolveStoredAccountStatus({ account_status: 'ACTIVE', is_banned: 1 }), 'active');
  assert.equal(resolveStoredAccountStatus(null), 'active');
  assert.equal(resolveStoredAccountStatus(undefined), 'active');
});
// -------------------------------------------------------------
// Temporary suspension lifetime
// -------------------------------------------------------------

test('a suspension in the future keeps the account restricted', () => {
  assert.equal(isSuspensionExpired(SUSPENDED_ROW, NOW), false);
  assert.equal(resolveEffectiveAccountStatus(SUSPENDED_ROW, NOW), 'suspended');
  assert.equal(isAccountAccessRestricted(SUSPENDED_ROW, NOW), true);
});

test('a suspension whose end date has passed releases itself', () => {
  const expired = { ...SUSPENDED_ROW, suspended_until: '2026-09-28T12:00:00.000Z' };

  assert.equal(isSuspensionExpired(expired, NOW), true);
  // The stored status is still 'suspended'; only the *effective* status changes,
  // which is what login and the socket handshake consult.
  assert.equal(resolveStoredAccountStatus(expired), 'suspended');
  assert.equal(resolveEffectiveAccountStatus(expired, NOW), 'active');
  assert.equal(isAccountAccessRestricted(expired, NOW), false);
  assert.equal(toLegacyBannedFlag(expired, NOW), 0);
});

test('a suspension ending exactly now counts as expired', () => {
  const boundary = { ...SUSPENDED_ROW, suspended_until: new Date(NOW).toISOString() };
  assert.equal(isSuspensionExpired(boundary, NOW), true);
});

test('a suspension without an end date stays in force indefinitely', () => {
  const openEnded = { account_status: 'suspended', is_banned: 1, suspended_until: null };

  assert.equal(isSuspensionExpired(openEnded, NOW), false);
  assert.equal(resolveEffectiveAccountStatus(openEnded, NOW), 'suspended');
  assert.equal(isAccountAccessRestricted(openEnded, NOW), true);
});

test('an unparseable suspension date does not release the account', () => {
  const corrupted = { account_status: 'suspended', is_banned: 1, suspended_until: 'not-a-date' };

  assert.equal(isSuspensionExpired(corrupted, NOW), false);
  assert.equal(resolveEffectiveAccountStatus(corrupted, NOW), 'suspended');
});

test('an expiry is only meaningful for the suspended status', () => {
  // A block never expires, even if a stale date is present.
  const blocked = { account_status: 'blocked', is_banned: 1, suspended_until: '2020-01-01T00:00:00.000Z' };
  assert.equal(isSuspensionExpired(blocked, NOW), false);
  assert.equal(resolveEffectiveAccountStatus(blocked, NOW), 'blocked');

  // An active account is unaffected by a stale date too.
  const active = { account_status: 'active', is_banned: 0, suspended_until: '2020-01-01T00:00:00.000Z' };
  assert.equal(isSuspensionExpired(active, NOW), false);
  assert.equal(resolveEffectiveAccountStatus(active, NOW), 'active');
});
// -------------------------------------------------------------
// Suspension length clamping
// -------------------------------------------------------------

test('a suspension length is clamped into the supported range', () => {
  assert.equal(clampSuspensionDays(7), 7);
  assert.equal(clampSuspensionDays('30'), 30);
  assert.equal(clampSuspensionDays(0), SUSPEND_MIN_DAYS);
  assert.equal(clampSuspensionDays(-5), SUSPEND_MIN_DAYS);
  assert.equal(clampSuspensionDays(0.4), SUSPEND_MIN_DAYS);
  assert.equal(clampSuspensionDays(999999), SUSPEND_MAX_DAYS);
  assert.equal(clampSuspensionDays(2.6), 3);
});

test('a missing or malformed suspension length falls back to the default', () => {
  assert.equal(clampSuspensionDays(undefined), DEFAULT_SUSPEND_DAYS);
  assert.equal(clampSuspensionDays(null), DEFAULT_SUSPEND_DAYS);
  assert.equal(clampSuspensionDays(''), DEFAULT_SUSPEND_DAYS);
  assert.equal(clampSuspensionDays('abc'), DEFAULT_SUSPEND_DAYS);
  assert.equal(clampSuspensionDays(NaN), DEFAULT_SUSPEND_DAYS);
  assert.equal(clampSuspensionDays(Infinity), DEFAULT_SUSPEND_DAYS);
});

test('the computed suspension end matches the clamped length', () => {
  assert.equal(resolveSuspensionEnd(7, NOW), new Date(NOW + 7 * 86400000).toISOString());
  // A clamped (not a raw) value is what gets persisted.
  assert.equal(
    resolveSuspensionEnd(999999, NOW),
    new Date(NOW + SUSPEND_MAX_DAYS * 86400000).toISOString()
  );
  assert.equal(
    resolveSuspensionEnd(-10, NOW),
    new Date(NOW + SUSPEND_MIN_DAYS * 86400000).toISOString()
  );
});

test('a clamped suspension end is always in the future, never immediate', () => {
  const end = Date.parse(resolveSuspensionEnd('garbage', NOW));
  assert.ok(end > NOW, 'a malformed duration must still produce a future expiry');
});

test('the round trip clamp -> persist -> resolve keeps the account suspended', () => {
  const suspendedUntil = resolveSuspensionEnd(3, NOW);
  const row = { account_status: 'suspended', is_banned: 1, suspended_until: suspendedUntil };

  assert.equal(isSuspensionExpired(row, NOW + 2 * 86400000), false);
  assert.equal(isAccountAccessRestricted(row, NOW + 2 * 86400000), true);
  assert.equal(isSuspensionExpired(row, NOW + 4 * 86400000), true);
  assert.equal(isAccountAccessRestricted(row, NOW + 4 * 86400000), false);
});

// -------------------------------------------------------------
// Status filter (GET /api/admin/users?status=...)
// -------------------------------------------------------------

test('only the three known statuses are accepted as a filter', () => {
  assert.equal(normalizeStatusFilter('active'), 'active');
  assert.equal(normalizeStatusFilter('suspended'), 'suspended');
  assert.equal(normalizeStatusFilter('blocked'), 'blocked');
  assert.equal(normalizeStatusFilter('  BLOCKED '), 'blocked');
});

test('an absent or blanket filter means "no filter"', () => {
  assert.equal(normalizeStatusFilter(undefined), null);
  assert.equal(normalizeStatusFilter(''), null);
  assert.equal(normalizeStatusFilter('all'), null);
  assert.equal(normalizeStatusFilter('ALL'), null);
});

test('an unknown filter is ignored rather than hiding every account', () => {
  assert.equal(normalizeStatusFilter('deleted'), null);
  assert.equal(normalizeStatusFilter('1 OR 1=1'), null);
  assert.equal(normalizeStatusFilter(['active', 'blocked']), null);
});

// -------------------------------------------------------------
// Reason normalization
// -------------------------------------------------------------

test('a status reason is trimmed and bounded', () => {
  assert.equal(normalizeStatusReason('  Spam reports  '), 'Spam reports');
  assert.equal(normalizeStatusReason(undefined), '');
  assert.equal(normalizeStatusReason(null), '');
  assert.equal(normalizeStatusReason(12345 as unknown), '');
  assert.equal(normalizeStatusReason({ a: 1 } as unknown), '');
  assert.equal(normalizeStatusReason('x'.repeat(900)).length, MAX_STATUS_REASON_LENGTH);
});
// -------------------------------------------------------------
// Permanent-delete confirmation
// -------------------------------------------------------------

test('the delete confirmation phrase is the exact expected token', () => {
  assert.equal(DELETE_CONFIRMATION_PHRASE, 'DELETE');
});

test('the DELETE phrase confirms a permanent deletion', () => {
  assert.equal(isDeleteConfirmationValid({ confirm: 'DELETE', targetEmail: 'a@b.com' }), true);
  assert.equal(isDeleteConfirmationValid({ confirm: ' delete ', targetEmail: 'a@b.com' }), true);
  assert.equal(isDeleteConfirmationValid({ confirmation: 'Delete', targetEmail: 'a@b.com' }), true);
});

test('the exact account email confirms a permanent deletion', () => {
  assert.equal(
    isDeleteConfirmationValid({ confirmEmail: 'member@example.com', targetEmail: 'member@example.com' }),
    true
  );
  assert.equal(
    isDeleteConfirmationValid({ confirmEmail: ' MEMBER@Example.com ', targetEmail: 'member@example.com' }),
    true
  );
});

test('a permanent deletion is rejected without an explicit confirmation', () => {
  const rejected = [
    {},
    { confirm: '' },
    { confirm: 'yes' },
    { confirm: 'deletee' },
    { confirm: 'DELETED' },
    { confirmEmail: '' },
    { confirmEmail: 'member@example.com' }, // no target email to compare against
    { confirmEmail: 'member@example.com', targetEmail: 'other@example.com' },
    { confirmEmail: 'member@example.co', targetEmail: 'member@example.com' },
    { confirmEmail: 'member@example.com', targetEmail: '' },
  ];

  for (const input of rejected) {
    assert.equal(
      isDeleteConfirmationValid(input),
      false,
      `expected rejection for ${JSON.stringify(input)}`
    );
  }
});

test('confirmation inputs are never treated as truthy objects', () => {
  assert.equal(isDeleteConfirmationValid({ confirm: true, targetEmail: 'a@b.com' }), false);
  assert.equal(isDeleteConfirmationValid({ confirmEmail: ['a@b.com'], targetEmail: 'a@b.com' }), false);
  assert.equal(isDeleteConfirmationValid(null as unknown as Record<string, unknown>), false);
});

// -------------------------------------------------------------
// Display helper
// -------------------------------------------------------------

test('the remaining suspension time is described in days and hours', () => {
  const in6Days = new Date(NOW + 6 * 86400000).toISOString();
  const in1Day = new Date(NOW + 86400000).toISOString();
  const in5Hours = new Date(NOW + 5 * 3600000).toISOString();

  assert.equal(describeSuspensionRemaining(in6Days, NOW), 'expires in 6 days');
  assert.equal(describeSuspensionRemaining(in1Day, NOW), 'expires in 1 day');
  assert.equal(describeSuspensionRemaining(in5Hours, NOW), 'expires in 5 hours');
});

test('an open-ended or already-elapsed suspension is described clearly', () => {
  assert.equal(describeSuspensionRemaining(null, NOW), 'until reactivated');
  assert.equal(describeSuspensionRemaining('', NOW), 'until reactivated');
  assert.equal(describeSuspensionRemaining('not-a-date', NOW), 'until reactivated');
  assert.equal(describeSuspensionRemaining(new Date(NOW - 1000).toISOString(), NOW), 'expiring now');
});