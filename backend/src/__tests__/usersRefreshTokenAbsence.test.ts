/**
 * Regression test for the Auth Hygiene Follow-up — `users.refresh_token`
 * column drop (migration #079).
 *
 * Background: the original users migration added a `refresh_token` column
 * that was never read or written by any service, controller, or middleware.
 * PR #379 hashed the live session token onto `sessions.refresh_token_hash`,
 * leaving `users.refresh_token` as dead schema. Migration #079 drops it.
 *
 * After the drop, attempting to read or write that column anywhere in
 * the app would surface as a Postgres "column does not exist" 500. To
 * prevent regressions that re-introduce the reference, we statically
 * scan the backend source tree and assert no production code path
 * references the bare `refresh_token` identifier.
 *
 * Allowed exceptions:
 *   - `refresh_token_hash` — the new sessions column.
 *   - `ravelryOAuthService.ts` — references the OAuth body field /
 *     `ravelry_tokens.refresh_token` column, which is a different
 *     table (encrypted, untouched by this migration).
 *   - `gdprService.ts` — keeps `'refresh_token'` in the SENSITIVE_COLUMNS
 *     scrub list as defense-in-depth so the encrypted Ravelry refresh
 *     token never lands in a GDPR data export.
 *   - The migration files themselves (#001 / #009 / #035 / #078 / #079).
 *
 * The scan deliberately includes test files so that future tests cannot
 * silently re-introduce a write of the dropped column.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const BACKEND_SRC = join(REPO_ROOT, 'backend', 'src');

// Files allowed to mention the bare `refresh_token` identifier.
// Paths are relative to repo root.
const ALLOWED_FILES = new Set<string>([
  // Ravelry OAuth lives on a separate table (encrypted) and uses
  // `refresh_token` as both the column name and the OAuth body field.
  'backend/src/services/ravelryOAuthService.ts',
  'backend/src/services/__tests__/ravelryOAuthService.test.ts',
  // GDPR scrub list — defensive blocklist applied to every dumped row.
  'backend/src/services/gdprService.ts',
  // Auth controller hash regression test — it asserts the absence of
  // `refresh_token` writes (so the literal appears in expectation strings).
  'backend/src/controllers/__tests__/authController.tokenHash.test.ts',
  // This file (test asserts the literal does not appear elsewhere).
  'backend/src/__tests__/usersRefreshTokenAbsence.test.ts',
]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, acc);
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

// Match `refresh_token` only when not followed by `_hash` and not preceded
// by an alphanumeric (so `my_refresh_token` doesn't trigger). This is the
// same shape the auth controller uses when writing to the dropped column.
const FORBIDDEN_RE = /(?<![A-Za-z0-9_])refresh_token(?!_hash)/;

describe('users.refresh_token column has no live code references', () => {
  it('finds no bare `refresh_token` outside the documented allowlist', () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];

    for (const abs of walk(BACKEND_SRC)) {
      const rel = relative(REPO_ROOT, abs).replace(/\\/g, '/');
      if (ALLOWED_FILES.has(rel)) continue;

      const lines = readFileSync(abs, 'utf8').split('\n');
      lines.forEach((text, i) => {
        if (FORBIDDEN_RE.test(text)) {
          offenders.push({ file: rel, line: i + 1, text: text.trim() });
        }
      });
    }

    if (offenders.length > 0) {
      const formatted = offenders
        .map((o) => `  ${o.file}:${o.line}  ${o.text}`)
        .join('\n');
      throw new Error(
        `Forbidden \`refresh_token\` reference outside the allowlist. ` +
          `Either use \`refresh_token_hash\` (sessions table) or, if this ` +
          `is a deliberate Ravelry/GDPR mention, add the file to ALLOWED_FILES ` +
          `in \`backend/src/__tests__/usersRefreshTokenAbsence.test.ts\`.\n${formatted}`,
      );
    }
  });
});

describe('migration #079 drops users.refresh_token cleanly', () => {
  it('calls dropColumn(refresh_token) on the users table and nothing else', async () => {
    const calls: Array<{ table: string; op: string; col: string }> = [];

    const fakeBuilder: any = {
      dropColumn: (col: string) => calls.push({ table: '__pending', op: 'drop', col }),
      string: (col: string) => {
        calls.push({ table: '__pending', op: 'add', col });
        return { nullable: () => undefined };
      },
    };

    const fakeKnex: any = {
      schema: {
        alterTable: async (table: string, cb: (b: any) => void) => {
          const before = calls.length;
          cb(fakeBuilder);
          for (let i = before; i < calls.length; i++) calls[i].table = table;
        },
      },
    };

    const mod = await import('../../migrations/20240101000079_drop_users_refresh_token');
    await mod.up(fakeKnex);
    expect(calls).toEqual([{ table: 'users', op: 'drop', col: 'refresh_token' }]);

    calls.length = 0;
    await mod.down(fakeKnex);
    expect(calls).toEqual([{ table: 'users', op: 'add', col: 'refresh_token' }]);
  });
});
