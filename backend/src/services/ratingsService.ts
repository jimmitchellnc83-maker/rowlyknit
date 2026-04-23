/**
 * Ratings queries that are reused across controllers.
 *
 * - `countMakersForPattern`: given a pattern, count how many *distinct other
 *   users* have a public rating on a project linked to a pattern with the
 *   same `ravelry_id`. This is the sharper Ravelry-like "X others made this"
 *   signal — it deliberately excludes private work and anyone who hasn't
 *   opted in with `is_public`.
 */

import type { Knex } from 'knex';

export async function countMakersForPattern(
  db: Knex,
  patternId: string,
  viewerUserId: string,
): Promise<number> {
  const source = await db('patterns')
    .where({ id: patternId })
    .whereNull('deleted_at')
    .select('ravelry_id')
    .first();

  if (!source || source.ravelry_id == null) return 0;

  const rows = await db('project_ratings as pr')
    .join('projects as p', 'pr.project_id', 'p.id')
    .join('project_patterns as pp', 'pp.project_id', 'p.id')
    .join('patterns as pat', 'pp.pattern_id', 'pat.id')
    .where('pat.ravelry_id', source.ravelry_id)
    .whereNull('p.deleted_at')
    .whereNull('pat.deleted_at')
    .where('pr.is_public', true)
    .whereNot('pr.user_id', viewerUserId)
    .countDistinct('pr.user_id as n');

  const n = rows[0]?.n;
  return typeof n === 'string' ? parseInt(n, 10) : Number(n ?? 0);
}
