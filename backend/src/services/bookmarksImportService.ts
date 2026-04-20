/**
 * Ravelry bookmarks import service — mirrors the user's Ravelry queue
 * (to-knit list) and library (purchased patterns + books) into Rowly's
 * `ravelry_bookmarks` table. The table uses a `type` discriminator
 * (`'queue'` vs `'library'`) so both lists share storage with a unique
 * constraint on `(user_id, type, ravelry_id)`.
 *
 * Display-only mirrors — no edits round-trip to Ravelry. Re-imports skip
 * rows already present (idempotent). Same client-driven pagination
 * contract as stash / projects / favorited-yarns imports.
 */

import db from '../config/database';
import logger from '../config/logger';
import ravelryService, { RavelryOAuthRequiredError } from './ravelryService';

interface ImportBookmarksPageResult {
  imported: number;
  skipped: number;
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
}

export async function importQueuePage(
  userId: string,
  page: number,
  pageSize: number
): Promise<ImportBookmarksPageResult> {
  const result = await ravelryService.listQueue(userId, page, pageSize);
  if (!result) {
    throw new Error('Failed to fetch queue page from Ravelry');
  }

  const { queue, pagination } = result;

  const queueIds = queue
    .map((q: any) => q.ravelryQueueId)
    .filter((id: any) => typeof id === 'number');

  let existingIds = new Set<number>();
  if (queueIds.length > 0) {
    const existing: Array<{ ravelry_id: number }> = await db('ravelry_bookmarks')
      .select('ravelry_id')
      .where({ user_id: userId, type: 'queue' })
      .whereNull('deleted_at')
      .whereIn('ravelry_id', queueIds);
    existingIds = new Set(existing.map((r) => r.ravelry_id));
  }

  const toInsert = queue
    .filter(
      (q: any) => typeof q.ravelryQueueId === 'number' && !existingIds.has(q.ravelryQueueId)
    )
    .map((q: any) => ({
      user_id: userId,
      type: 'queue',
      ravelry_id: q.ravelryQueueId,
      pattern_ravelry_id: q.patternRavelryId ?? null,
      title: q.patternName || q.name || 'Untitled',
      author: q.patternAuthor ?? null,
      photo_url: q.photoUrl ?? null,
      source_type: null,
      position: q.position ?? null,
      notes: q.notes ?? null,
      data: JSON.stringify({
        yarnRavelryId: q.yarnRavelryId ?? null,
        yarnName: q.yarnName ?? null,
        skeins: q.skeins ?? null,
      }),
      created_at: new Date(),
      updated_at: new Date(),
    }));

  if (toInsert.length > 0) {
    await db('ravelry_bookmarks').insert(toInsert);
  }

  logger.info('Ravelry queue import page complete', {
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

export async function importLibraryPage(
  userId: string,
  page: number,
  pageSize: number
): Promise<ImportBookmarksPageResult> {
  const result = await ravelryService.listLibrary(userId, page, pageSize);
  if (!result) {
    throw new Error('Failed to fetch library page from Ravelry');
  }

  const { library, pagination } = result;

  const libraryIds = library
    .map((v: any) => v.ravelryLibraryId)
    .filter((id: any) => typeof id === 'number');

  let existingIds = new Set<number>();
  if (libraryIds.length > 0) {
    const existing: Array<{ ravelry_id: number }> = await db('ravelry_bookmarks')
      .select('ravelry_id')
      .where({ user_id: userId, type: 'library' })
      .whereNull('deleted_at')
      .whereIn('ravelry_id', libraryIds);
    existingIds = new Set(existing.map((r) => r.ravelry_id));
  }

  const toInsert = library
    .filter(
      (v: any) => typeof v.ravelryLibraryId === 'number' && !existingIds.has(v.ravelryLibraryId)
    )
    .map((v: any) => {
      // Library volume maps to a pattern in most cases; when the volume is a
      // book, its patternIds[] can hold many pattern_ravelry_ids. We store
      // the first in the dedicated column and keep the full list in `data`.
      const patternRavelryId = Array.isArray(v.patternIds) && v.patternIds.length > 0
        ? v.patternIds[0]
        : null;

      return {
        user_id: userId,
        type: 'library',
        ravelry_id: v.ravelryLibraryId,
        pattern_ravelry_id: patternRavelryId,
        title: v.title || 'Untitled',
        author: v.author ?? null,
        photo_url: v.photoUrl ?? null,
        source_type: v.type ?? null,
        position: null,
        notes: null,
        data: JSON.stringify({
          patternIds: v.patternIds || [],
          addedAt: v.addedAt || null,
        }),
        created_at: new Date(),
        updated_at: new Date(),
      };
    });

  if (toInsert.length > 0) {
    await db('ravelry_bookmarks').insert(toInsert);
  }

  logger.info('Ravelry library import page complete', {
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
