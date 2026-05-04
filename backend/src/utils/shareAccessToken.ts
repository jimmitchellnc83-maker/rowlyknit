/**
 * Stateless, time-limited access tokens for password-protected shared
 * charts. Replaces the previous "?password=…" query-string flow flagged
 * in the seam audit (2026-05-04): query strings leak through browser
 * history, server / proxy logs, analytics, and Referer headers.
 *
 * The flow is now:
 *   1. POST /shared/chart/:token/access  { password }
 *   2. Server verifies the password (bcrypt + lazy SHA256 rehash) and,
 *      on success, returns + sets an access token tied to that share
 *      token. The token is an HMAC-SHA256 of `${shareToken}.${exp}`
 *      using the same secret as the JWT layer.
 *   3. GET /shared/chart/:token  — and  /download — accept the token
 *      via the `share_access_<token>` cookie (preferred for browsers)
 *      OR the `x-share-access` header (for API clients).
 *
 * Tokens are NOT stored server-side (HMAC + expiry baked in), so there
 * is nothing to clean up if a share is revoked or its password rotated
 * — the share row itself is gone or the password no longer matches.
 */
import crypto from 'crypto';

const DEFAULT_TTL_SEC = 15 * 60; // 15 minutes

function getSigningSecret(): string {
  // Reuse JWT_SECRET so we don't introduce another required env var.
  // The HMAC namespace is disjoint (we sign a different payload shape),
  // so this does not weaken JWT.
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET — required to sign share access tokens');
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
}

export interface IssuedShareAccess {
  token: string;
  expiresAt: Date;
  ttlSeconds: number;
}

/**
 * Issue a short-lived access token bound to a specific share token.
 * The returned `token` is opaque to callers: `${expSeconds}.${hmacHex}`.
 */
export function issueShareAccessToken(
  shareToken: string,
  ttlSeconds: number = DEFAULT_TTL_SEC
): IssuedShareAccess {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign(`${shareToken}.${exp}`);
  return {
    token: `${exp}.${sig}`,
    expiresAt: new Date(exp * 1000),
    ttlSeconds,
  };
}

/**
 * Verify an access token against the share token it claims to authorise.
 * Returns false on missing / malformed / expired / mismatched tokens.
 * Constant-time HMAC compare.
 */
export function verifyShareAccessToken(
  shareToken: string,
  accessToken: string | undefined | null
): boolean {
  if (!accessToken || typeof accessToken !== 'string') return false;
  const dot = accessToken.indexOf('.');
  if (dot <= 0 || dot === accessToken.length - 1) return false;

  const expStr = accessToken.slice(0, dot);
  const sigHex = accessToken.slice(dot + 1);

  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;

  const expectedHex = sign(`${shareToken}.${exp}`);
  // Length check must come before timingSafeEqual — Buffer.from on a
  // shorter hex string truncates without error, which would otherwise
  // mask a malformed token as a constant-time mismatch.
  if (sigHex.length !== expectedHex.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sigHex, 'hex'),
      Buffer.from(expectedHex, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Cookie name for browser-side access. Scoped per share token so that
 * a recipient's browser keeps separate cookies for separate shared
 * charts (no chance of one cookie unlocking the wrong chart).
 */
export function shareAccessCookieName(shareToken: string): string {
  return `share_access_${shareToken}`;
}
