import crypto from 'crypto';

// -------------------------------------------------------------
// Password Hashing Utilities
//
// Passwords are stored using Node's built-in scrypt KDF (no external
// dependency, strong by design). The stored value NEVER contains the
// plaintext password and has this shape:
//
//   scrypt$N=16384,r=8,p=1$<saltBase64>$<derivedKeyBase64>
//
// Any stored value WITHOUT the `scrypt$` prefix is treated as a legacy
// plaintext password. Such a value is only ever compared during login and
// then upgraded in-place to a secure hash (gradual migration) — never
// returned to the client, logged, or written back as plaintext.
// -------------------------------------------------------------

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SCRYPT_KEYLEN = 64;

function scryptKey(salt: Buffer, password: string): Buffer {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = scryptKey(salt, password);
  const saltB64 = salt.toString('base64');
  const keyB64 = key.toString('base64');
  return `scrypt$${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${saltB64}$${keyB64}`;
}

/**
 * Returns true if the stored value is a scrypt hash produced by hashPassword.
 */
export function isHashedPassword(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}

/**
 * Securely compares a plaintext candidate against a stored value that is
 * either a scrypt hash or a legacy plaintext value.
 */
export function verifyPassword(candidate: string, stored: string): boolean {
  if (typeof stored !== 'string' || stored.length === 0) return false;
  if (!isHashedPassword(stored)) {
    // Legacy plaintext value: constant-time comparison to avoid leaking
    // length information via early-exit string comparisons.
    const a = Buffer.from(candidate);
    const b = Buffer.from(stored);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const salt = Buffer.from(parts[2], 'base64');
  const expected = Buffer.from(parts[3], 'base64');
  const actual = scryptKey(salt, candidate);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}