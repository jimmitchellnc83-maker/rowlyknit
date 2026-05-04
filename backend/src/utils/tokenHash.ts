import crypto from 'crypto';

/**
 * One-way hash for high-entropy bearer tokens (refresh tokens, password
 * reset tokens). The DB stores only the hash; we hash the submitted
 * token on every lookup and `WHERE`-match by hash.
 *
 * Why plain SHA-256 (not HMAC-with-pepper or bcrypt):
 *   - The inputs are cryptographically random (256-bit JWT refresh
 *     tokens, paired-UUID reset tokens). They cannot be brute-forced
 *     even with the full hash, so a peppered HMAC adds no real
 *     resistance vs. an attacker who has the DB but not the secret —
 *     and an attacker with both gains nothing from HMAC anyway.
 *   - Variable-cost hashes (bcrypt/argon2) protect *low-entropy*
 *     secrets (user passwords). They're the wrong tool for 256-bit
 *     server-issued tokens — they'd just slow every refresh/reset
 *     down without raising the brute-force floor.
 *   - Plain SHA-256 is also what `chartSharingService` already uses
 *     for its share password (similar threat model, slightly weaker
 *     inputs), so this keeps the hashing surface consistent.
 *
 * The hash output is hex-encoded (64 chars) so it fits cleanly into
 * existing string columns and stays printable in audit logs without
 * leaking the original token.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
