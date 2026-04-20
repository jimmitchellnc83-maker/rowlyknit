/**
 * Favorite-yarns import service — fetches one page of the authenticated
 * user's favorited yarns from Ravelry and mirrors them into Rowly's `yarn`
 * table as wishlist rows (`is_favorite = true`, `is_stash = false`).
 *
 * Dedup key: `(user_id, ravelry_id = yarn model id)`. This is a different
 * ID space from stash import, which stores the stash-entry id in the same
 * column — yarn model ids and stash ids don't overlap on Ravelry, so the
 * two importers coexist without collision.
 *
 * Re-imports skip any rows that already exist so users' local edits (e.g.
 * setting skeins_total once they actually buy the yarn) stay intact.
 */

import db from '../config/database';
import logger from '../config/logger';
import ravelryService, { RavelryOAuthRequiredError } from './ravelryService';

interface ImportFavoriteYarnsPageResult {
  imported: number;
  skipped: number;
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
}

export async function importFavoriteYarnsPage(
  userId: string,
  page: number,
  pageSize: number
): Promise<ImportFavoriteYarnsPageResult> {
  const result = await ravelryService.getFavoriteYarns(userId, page, pageSize);
  if (!result) {
    throw new Error('Failed to fetch favorite yarns page from Ravelry');
  }

  const { yarns, pagination } = result;

  const yarnIds = yarns
    .map((y: any) => y.id)
    .filter((id: any) => typeof id === 'number');

  let existingIds = new Set<number>();
  if (yarnIds.length > 0) {
    const existing: Array<{ ravelry_id: number }> = await db('yarn')
      .select('ravelry_id')
      .where({ user_id: userId })
      .whereIn('ravelry_id', yarnIds);
    existingIds = new Set(existing.map((r) => r.ravelry_id));
  }

  const toInsert = yarns
    .filter((y: any) => typeof y.id === 'number' && !existingIds.has(y.id))
    .map((y: any) => ({
      user_id: userId,
      brand: y.brand ?? null,
      name: y.name ?? 'Unnamed yarn',
      weight: y.weight ?? null,
      fiber_content: y.fiberContent ?? null,
      photo_url: y.photoUrl ?? null,
      description: y.description ?? null,
      gauge: y.gauge ?? null,
      needle_sizes: y.needleSizes ?? null,
      machine_washable: typeof y.machineWashable === 'boolean' ? y.machineWashable : null,
      discontinued: y.discontinued ?? false,
      ravelry_id: y.id,
      ravelry_rating: typeof y.ratingAverage === 'number' ? y.ratingAverage : null,
      skeins_total: 0,
      skeins_remaining: 0,
      is_favorite: true,
      is_stash: false,
      tags: '[]',
      created_at: new Date(),
      updated_at: new Date(),
    }));

  if (toInsert.length > 0) {
    await db('yarn').insert(toInsert);
  }

  logger.info('Ravelry favorite yarns import page complete', {
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
