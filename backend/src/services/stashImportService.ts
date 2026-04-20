/**
 * Stash import service — fetches one page of a user's Ravelry stash and
 * persists new entries to the `yarn` table. Re-imports skip any rows that
 * already exist (dedup by `(user_id, ravelry_id = stash_entry_id)`) so
 * users' local edits are never overwritten.
 *
 * Client-driven pagination: the controller exposes this as a per-page
 * endpoint the frontend calls in a loop while showing progress.
 */

import db from '../config/database';
import logger from '../config/logger';
import ravelryService, { RavelryOAuthRequiredError } from './ravelryService';

interface ImportStashPageResult {
  imported: number;
  skipped: number;
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
}

const YARDS_PER_METER = 1 / 0.9144;

function toYards(entry: { yards: number | null; meters: number | null }): number | null {
  if (entry.yards != null) return Math.round(entry.yards);
  if (entry.meters != null) return Math.round(entry.meters * YARDS_PER_METER);
  return null;
}

export async function importStashPage(
  userId: string,
  page: number,
  pageSize: number
): Promise<ImportStashPageResult> {
  const result = await ravelryService.listStash(userId, page, pageSize);
  if (!result) {
    // listStash swallows non-OAuth errors and returns null. Surface a generic
    // upstream failure — the controller translates to a 502.
    throw new Error('Failed to fetch stash page from Ravelry');
  }

  const { stash, pagination } = result;

  // Skip entries already imported for this user. Dedup key: (user_id, ravelry_id)
  // where ravelry_id holds the Ravelry stash entry ID (unique per stash line).
  const stashIds = stash
    .map((e: any) => e.ravelryStashId)
    .filter((id: any) => typeof id === 'number');

  let existingIds = new Set<number>();
  if (stashIds.length > 0) {
    const existing: Array<{ ravelry_id: number }> = await db('yarn')
      .select('ravelry_id')
      .where({ user_id: userId })
      .whereIn('ravelry_id', stashIds);
    existingIds = new Set(existing.map((r) => r.ravelry_id));
  }

  const toInsert = stash
    .filter((e: any) => typeof e.ravelryStashId === 'number' && !existingIds.has(e.ravelryStashId))
    .map((e: any) => {
      const yards = toYards({ yards: e.yards, meters: e.meters });
      const totalLengthM =
        e.meters != null ? Math.round(e.meters * 100) / 100 :
        e.yards != null ? Math.round(e.yards * 0.9144 * 100) / 100 :
        null;

      return {
        user_id: userId,
        brand: e.brand ?? null,
        name: e.name ?? 'Unnamed yarn',
        color: e.color ?? null,
        weight: e.weight ?? null,
        fiber_content: e.fiberContent ?? null,
        yards_total: yards,
        yards_remaining: yards,
        total_length_m: totalLengthM,
        remaining_length_m: totalLengthM,
        grams_total: e.grams ?? null,
        grams_remaining: e.grams ?? null,
        skeins_total: e.skeins ?? 1,
        skeins_remaining: e.skeins ?? 1,
        dye_lot: e.dyeLot ?? null,
        photo_url: e.photoUrl ?? null,
        notes: e.notes ?? null,
        ravelry_id: e.ravelryStashId,
        is_stash: true,
        tags: '[]',
        created_at: new Date(),
        updated_at: new Date(),
      };
    });

  if (toInsert.length > 0) {
    await db('yarn').insert(toInsert);
  }

  logger.info('Ravelry stash import page complete', {
    userId,
    page,
    imported: toInsert.length,
    skipped: existingIds.size,
  });

  return {
    imported: toInsert.length,
    skipped: existingIds.size,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalResults: pagination.totalResults,
    totalPages: pagination.totalPages,
  };
}

export { RavelryOAuthRequiredError };
