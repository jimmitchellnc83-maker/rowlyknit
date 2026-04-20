/**
 * Projects import service — fetches one page of a user's Ravelry projects
 * and persists new entries to the `projects` table. Re-imports skip any
 * rows that already exist (dedup on `(user_id, ravelry_id)`) so local
 * edits stay intact.
 *
 * Client-driven pagination: one page per HTTP call. Mirrors the stash
 * import pattern.
 */

import db from '../config/database';
import logger from '../config/logger';
import ravelryService, { RavelryOAuthRequiredError } from './ravelryService';

interface ImportProjectsPageResult {
  imported: number;
  skipped: number;
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
}

/** Map Ravelry's project status strings to Rowly's status vocabulary. */
function mapStatus(ravelryStatus: string | null): string {
  switch (ravelryStatus) {
    case 'finished': return 'completed';
    case 'hibernating': return 'paused';
    case 'frogged': return 'archived';
    case 'in_progress': return 'active';
    default: return 'active';
  }
}

export async function importProjectsPage(
  userId: string,
  page: number,
  pageSize: number
): Promise<ImportProjectsPageResult> {
  const result = await ravelryService.listProjects(userId, page, pageSize);
  if (!result) {
    throw new Error('Failed to fetch projects page from Ravelry');
  }

  const { projects, pagination } = result;

  const projectIds = projects
    .map((p: any) => p.ravelryProjectId)
    .filter((id: any) => typeof id === 'number');

  let existingIds = new Set<number>();
  if (projectIds.length > 0) {
    const existing: Array<{ ravelry_id: number }> = await db('projects')
      .select('ravelry_id')
      .where({ user_id: userId })
      .whereIn('ravelry_id', projectIds);
    existingIds = new Set(existing.map((r) => r.ravelry_id));
  }

  const toInsert = projects
    .filter(
      (p: any) => typeof p.ravelryProjectId === 'number' && !existingIds.has(p.ravelryProjectId)
    )
    .map((p: any) => ({
      user_id: userId,
      name: p.name ?? 'Untitled project',
      status: mapStatus(p.status),
      start_date: p.startedDate || null,
      actual_completion_date: p.completedDate || null,
      progress_percentage: typeof p.progressPercentage === 'number' ? p.progressPercentage : 0,
      thumbnail_url: p.photoUrl ?? null,
      notes: p.notes ?? null,
      ravelry_id: p.ravelryProjectId,
      metadata: '{}',
      tags: '[]',
      created_at: new Date(),
      updated_at: new Date(),
    }));

  if (toInsert.length > 0) {
    await db('projects').insert(toInsert);
  }

  logger.info('Ravelry projects import page complete', {
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
