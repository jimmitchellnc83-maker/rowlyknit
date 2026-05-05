/**
 * PR #384/#385 follow-up — finding #5.
 *
 * Live PR smoke runs leave behind throwaway user accounts on prod
 * (the smoke flow registers, drives a flow, and never bothers to
 * unwind). Two known patterns:
 *
 *   - `claude-smoke%@rowly.test`               (synthetic smoke domain)
 *   - `jimmitchellnc83+rowly-smoke-pr%@gmail.com`  (Gmail real-inbox runs from #384/#385)
 *
 * Both shapes are explicitly carved out by the test runner — neither
 * shape can match a real user (rowly.test is a reserved domain we
 * own; the plus-tag is operator-specific). The script hard-deletes
 * matched rows inside a single transaction; FK cascades fan out
 * through projects / patterns / yarn / sessions / etc., which is the
 * point — a smoke user that left a project or pattern should leave
 * with it.
 *
 * Safety:
 *   - Two narrow LIKE patterns. NEVER substring-match on partial
 *     usernames; NEVER match email TLD alone.
 *   - Transactional. If any cascade fails the entire delete rolls
 *     back, leaving the prior state untouched.
 *   - Dry-run is the default — operator has to pass `--commit` to
 *     actually delete.
 *
 * Usage (run inside the prod backend container):
 *   docker exec rowly_backend node dist/src/scripts/cleanupSmokeUsers.js
 *   docker exec rowly_backend node dist/src/scripts/cleanupSmokeUsers.js --commit
 */

import type { Knex } from 'knex';
import db from '../config/database';

/**
 * The exact two LIKE shapes the script will match. Anything that
 * doesn't match BOTH a known pattern AND a known reserved domain is
 * skipped. If a future smoke run needs a third shape, add it here.
 */
export const SMOKE_USER_EMAIL_PATTERNS: ReadonlyArray<string> = [
  'claude-smoke%@rowly.test',
  'jimmitchellnc83+rowly-smoke-pr%@gmail.com',
];

export interface SmokeUserCandidate {
  id: string;
  email: string;
  created_at: Date | string;
}

/**
 * Read-only scan: returns every row whose email matches one of the
 * smoke patterns. Exported for the unit test, which feeds in a
 * fixture user list and proves the LIKE shape doesn't accidentally
 * match a real user.
 */
export async function selectSmokeUserCandidates(
  conn: Knex = db,
): Promise<SmokeUserCandidate[]> {
  const builder = conn('users').select<SmokeUserCandidate[]>(
    'id',
    'email',
    'created_at',
  );
  return builder.where(function () {
    for (const pattern of SMOKE_USER_EMAIL_PATTERNS) {
      this.orWhere('email', 'like', pattern);
    }
  });
}

export interface CleanupReport {
  scanned: SmokeUserCandidate[];
  deletedCount: number;
}

/**
 * Hard-delete the smoke users in a single transaction. FK cascades
 * (every user-owned table uses `ON DELETE CASCADE` per the original
 * migrations) clean up downstream rows.
 *
 * If `commit` is false (default) this is a dry-run: the function
 * returns the candidate list with `deletedCount: 0` and does not
 * touch the DB.
 */
export async function cleanupSmokeUsers(
  conn: Knex = db,
  options: { commit?: boolean } = {},
): Promise<CleanupReport> {
  const commit = options.commit === true;
  const candidates = await selectSmokeUserCandidates(conn);

  if (!commit || candidates.length === 0) {
    return { scanned: candidates, deletedCount: 0 };
  }

  const ids = candidates.map((u) => u.id);
  let deletedCount = 0;

  await conn.transaction(async (trx) => {
    // Defense-in-depth: re-issue the LIKE filter inside the DELETE so
    // even if `ids` somehow carried a foreign id (it can't — we just
    // selected by email), the WHERE on email shape would still gate it.
    deletedCount = await trx('users')
      .whereIn('id', ids)
      .where(function () {
        for (const pattern of SMOKE_USER_EMAIL_PATTERNS) {
          this.orWhere('email', 'like', pattern);
        }
      })
      .delete();
  });

  return { scanned: candidates, deletedCount };
}

async function main(): Promise<void> {
  const commit = process.argv.includes('--commit');
  console.log(
    `[cleanup-smoke-users] mode: ${commit ? 'COMMIT (will delete)' : 'DRY RUN (no writes)'}`,
  );
  console.log('[cleanup-smoke-users] patterns:');
  for (const p of SMOKE_USER_EMAIL_PATTERNS) console.log(`  ${p}`);

  const report = await cleanupSmokeUsers(db, { commit });

  console.log(`[cleanup-smoke-users] scanned: ${report.scanned.length}`);
  for (const u of report.scanned) {
    console.log(`  ${u.id}  ${u.email}  created=${u.created_at}`);
  }
  if (commit) {
    console.log(`[cleanup-smoke-users] deleted: ${report.deletedCount}`);
  } else {
    console.log('[cleanup-smoke-users] DRY RUN — no writes made');
  }
  await db.destroy();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[cleanup-smoke-users] fatal:', err);
    process.exit(1);
  });
}
