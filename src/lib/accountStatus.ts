// Admin account-status rules (Suspend / Block) for Lovemeetly.
//
// Kept as a pure, side-effect-free module so server.ts, the PostgreSQL/SQLite
// synchronization layer and the focused tests in accountStatus.test.ts all share
// exactly one implementation of the status rules. Nothing here touches a database,
// the network or Express: every function is a plain transformation.

/** Account status assignable by an administrator from the Admin Panel. */
export type UserAccountStatus = 'active' | 'suspended' | 'blocked';

/** All assignable statuses, in display order. */
export const USER_ACCOUNT_STATUSES: UserAccountStatus[] = ['active', 'suspended', 'blocked'];

/**
 * Bounds for a temporary suspension, in days. A suspension is always temporary by
 * nature: `suspended_until` is what makes it expire on its own, while a permanent
 * restriction is the separate 'blocked' status.
 */
export const SUSPEND_MIN_DAYS = 1;
export const SUSPEND_MAX_DAYS = 3650;
export const DEFAULT_SUSPEND_DAYS = 7;

/** Phrase the permanent-delete endpoint requires in the request body. */
export const DELETE_CONFIRMATION_PHRASE = 'DELETE';

/** Upper bound for a stored status reason / note. */
export const MAX_STATUS_REASON_LENGTH = 500;

function isUserAccountStatus(value: unknown): value is UserAccountStatus {
  return value === 'active' || value === 'suspended' || value === 'blocked';
}

/**
 * Only a real string is accepted as a comparison input. Using `String(value)`
 * instead would silently coerce an array (`['a@b.com']` becomes `'a@b.com'`), which
 * must never be able to satisfy a destructive-action confirmation.
 */
function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Resolves the *stored* account status of a `users` row.
 *
 * Rows written before the Suspend/Block feature have `account_status = NULL`:
 * the legacy `is_banned` column is then the source of truth, so every historical
 * ban keeps working after this feature ships. Keeping that fallback in one place
 * is what keeps login, the REST auth middleware, the Socket.IO handshake, the
 * admin API and the sync engine consistent with each other.
 */
export function resolveStoredAccountStatus(row: any): UserAccountStatus {
  const raw = String(row?.account_status ?? '').trim().toLowerCase();
  if (isUserAccountStatus(raw)) {
    return raw;
  }
  return Number(row?.is_banned) ? 'blocked' : 'active';
}

/** True when a temporary suspension's end date has already passed. */
export function isSuspensionExpired(row: any, now: number = Date.now()): boolean {
  if (resolveStoredAccountStatus(row) !== 'suspended') return false;
  const raw = row?.suspended_until ?? row?.suspendedUntil;
  if (!raw) return false; // No end date means "until an admin reactivates it".
  const until = Date.parse(String(raw));
  return Number.isFinite(until) && until <= now;
}

/**
 * Effective status used by every authorization check: an expired temporary
 * suspension counts as active again, so "Suspend for 24 hours" can never lock an
 * account out permanently.
 */
export function resolveEffectiveAccountStatus(row: any, now: number = Date.now()): UserAccountStatus {
  return isSuspensionExpired(row, now) ? 'active' : resolveStoredAccountStatus(row);
}

/** True when the account must not sign in or open a realtime socket. */
export function isAccountAccessRestricted(row: any, now: number = Date.now()): boolean {
  return resolveEffectiveAccountStatus(row, now) !== 'active';
}

/**
 * Legacy `is_banned` value that mirrors a status, so the pre-existing checks that
 * only understood `is_banned` stay correct.
 */
export function toLegacyBannedFlag(row: any, now: number = Date.now()): 0 | 1 {
  return isAccountAccessRestricted(row, now) ? 1 : 0;
}

/** Clamps a requested suspension length into the supported range. */
export function clampSuspensionDays(value: unknown): number {
  // Only a real number, or a non-blank numeric string, counts as a request.
  // Everything else (missing, blank, boolean, array, "abc", Infinity, NaN) falls
  // back to the default — note that plain `Number('')` is 0, which would otherwise
  // silently turn a blank form field into a one-day suspension.
  const normalized =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;

  if (!Number.isFinite(normalized)) return DEFAULT_SUSPEND_DAYS;
  return Math.min(Math.max(Math.round(normalized), SUSPEND_MIN_DAYS), SUSPEND_MAX_DAYS);
}

/** ISO timestamp at which a suspension started now would end. */
export function resolveSuspensionEnd(days: unknown, now: number = Date.now()): string {
  return new Date(now + clampSuspensionDays(days) * 86400000).toISOString();
}

/** Normalizes an admin-supplied free-text reason/note. */
export function normalizeStatusReason(value: unknown, maxLength = MAX_STATUS_REASON_LENGTH): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

/**
 * Validates the `status` query parameter of the admin user list.
 * Returns null for "no filter" so a malformed value can never hide accounts.
 */
export function normalizeStatusFilter(value: unknown): UserAccountStatus | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw === 'all') return null;
  return isUserAccountStatus(raw) ? raw : null;
}

/** Human-readable remaining time of a suspension, e.g. "expires in 6 days". */
export function describeSuspensionRemaining(
  suspendedUntil: unknown,
  now: number = Date.now()
): string {
  const raw = suspendedUntil ? Date.parse(String(suspendedUntil)) : NaN;
  if (!Number.isFinite(raw)) return 'until reactivated';
  const diffMs = raw - now;
  if (diffMs <= 0) return 'expiring now';
  const days = Math.floor(diffMs / 86400000);
  if (days >= 1) return `expires in ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.round(diffMs / 3600000));
  return `expires in ${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Server-side delete confirmation check. Permanent deletion is only accepted when
 * the caller echoes the "DELETE" phrase or the exact account email, independently
 * of whatever the Admin Panel did in the browser.
 */
export function isDeleteConfirmationValid(input: {
  confirm?: unknown;
  confirmation?: unknown;
  confirmEmail?: unknown;
  targetEmail?: unknown;
}): boolean {
  const phrase = toTrimmedString(input?.confirm ?? input?.confirmation).toUpperCase();
  if (phrase === DELETE_CONFIRMATION_PHRASE) return true;
  const email = toTrimmedString(input?.confirmEmail).toLowerCase();
  const target = toTrimmedString(input?.targetEmail).toLowerCase();
  return Boolean(email) && email === target;
}