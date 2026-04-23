/**
 * One-off backfill: seed showcase example data for every existing user
 * who registered before PR #182 (2026-04-23) and so has
 * `examples_seeded_at IS NULL`.
 *
 * Idempotent — seedExampleDataForUser gates on `examples_seeded_at`, so
 * running this twice is a no-op. Users who have manually cleared examples
 * also have `examples_seeded_at = NULL` after the clear, so they WOULD be
 * re-seeded. We skip them by ALSO excluding `examples_cleared_at IS NOT NULL`.
 *
 * Usage:
 *   # Dry run — lists what would be done, no writes
 *   docker compose exec -T backend node dist/src/scripts/backfillExampleSeeds.js --dry-run
 *
 *   # For real
 *   docker compose exec -T backend node dist/src/scripts/backfillExampleSeeds.js
 */

import db from '../config/database';
import { seedExampleDataForUser } from '../services/seedExampleData';

const DRY_RUN = process.argv.includes('--dry-run');

interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

async function main() {
  console.log(`[backfill] mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);

  // Candidates:
  // - have no examples_seeded_at (never seeded)
  // - AND no examples_cleared_at (haven't actively opted out)
  // - AND not soft-deleted
  const candidates: UserRow[] = await db('users')
    .whereNull('examples_seeded_at')
    .whereNull('examples_cleared_at')
    .whereNull('deleted_at')
    .select('id', 'email', 'created_at')
    .orderBy('created_at', 'asc');

  console.log(`[backfill] ${candidates.length} user${candidates.length === 1 ? '' : 's'} to backfill`);

  if (candidates.length === 0) {
    console.log('[backfill] nothing to do');
    await db.destroy();
    return;
  }

  if (DRY_RUN) {
    for (const u of candidates) {
      console.log(`  would seed: ${u.email} (id=${u.id}, registered=${new Date(u.created_at).toISOString()})`);
    }
    console.log(`[backfill] DRY RUN complete — no writes made`);
    await db.destroy();
    return;
  }

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const u = candidates[i];
    const prefix = `[${i + 1}/${candidates.length}]`;
    try {
      const result = await seedExampleDataForUser(u.id);
      if (result === null) {
        skipped += 1;
        console.log(`  ${prefix} skipped ${u.email} (already seeded or user missing)`);
      } else {
        succeeded += 1;
        console.log(
          `  ${prefix} seeded ${u.email} → ${result.projects}p ${result.yarns}y ${result.patterns}P ${result.tools}t ${result.recipients}r`,
        );
      }
    } catch (err) {
      failed += 1;
      console.error(`  ${prefix} FAILED ${u.email}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `[backfill] done: ${succeeded} seeded, ${skipped} skipped, ${failed} failed (of ${candidates.length})`,
  );
  await db.destroy();
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
