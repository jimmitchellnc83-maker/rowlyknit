/**
 * PR #389 final-pass P3 — static-scan regression guard for the
 * rate-limiter keyGenerator.
 *
 * The previous implementation tried to extract a userId from the
 * Authorization header by base64-decoding the JWT payload segment
 * WITHOUT verifying the signature:
 *
 *     const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
 *     userId = payload.userId;
 *
 * That lets an attacker forge a JWT-looking string with an arbitrary
 * `userId` claim and have the limiter attribute their requests to
 * that user's bucket — either to bypass their own per-user cap or to
 * push another user toward 429. The fix is to trust only
 * `req.user.userId`, which is populated by the `authenticate`
 * middleware AFTER it has cryptographically verified the token.
 *
 * This test reads `middleware/rateLimiter.ts` from disk and asserts
 * the source no longer contains any of the unverified-decode
 * tells: `Buffer.from(token`, JWT-payload `.split('.')[1]`, or a
 * direct `req.headers.authorization` parse inside the limiter
 * keyGenerator.
 *
 * Static rather than runtime because the limiter integrates with the
 * Redis store and express-rate-limit middleware shape — exercising
 * the keyGenerator end-to-end requires a working Redis. The static
 * scan catches the only thing we care about: a regression that
 * re-introduces the unverified decode.
 */

import fs from 'fs';
import path from 'path';

const RATE_LIMITER_FILE = path.resolve(
  __dirname,
  '..',
  'rateLimiter.ts',
);

describe('rateLimiter — apiLimiter keyGenerator does not decode bearer tokens', () => {
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(RATE_LIMITER_FILE, 'utf8');
  });

  it('does not call Buffer.from(token...) anywhere — that would mean an unverified decode is back', () => {
    // The old code did `Buffer.from(token.split('.')[1], 'base64')`. We
    // never need that pattern in this file; if it reappears, the JWT
    // hardening regressed.
    expect(content).not.toMatch(/Buffer\.from\(\s*token/);
  });

  it("does not split a string on '.' to extract a JWT segment", () => {
    // Loose match for `xxx.split('.')[1]` and similar.
    expect(content).not.toMatch(/\.split\s*\(\s*['"`]\.['"`]\s*\)\s*\[\s*1\s*\]/);
  });

  it('does not read req.headers.authorization inside the limiter keyGenerator', () => {
    // We also don't want the rolling-our-own bearer parse to come back
    // in any other shape. The authenticate middleware is the single
    // source of truth for `req.user.userId`.
    expect(content).not.toMatch(/req\.headers\.authorization/);
  });

  it('keyGenerator still references req.user.userId — the verified path remains intact', () => {
    expect(content).toMatch(/req\.user\?\.userId|req\.user\.userId/);
  });
});
