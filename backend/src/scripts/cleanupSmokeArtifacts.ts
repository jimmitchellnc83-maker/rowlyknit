/**
 * One-off cleanup: soft-delete known smoke-test artifacts left on prod by
 * recent PR smoke runs. Designed to be idempotent (re-running is a no-op
 * once everything is already soft-deleted) and conservative — only removes
 * records that match an explicit allow-list of known smoke artifacts, so
 * real owner/demo data stays intact.
 *
 * Safety contract for `pattern_models` (PR378 — Bugfix Sprint 2A):
 * the previous version broad-matched names across ALL users, which would
 * have hard-deleted any real user's model literally named "Smoke Sweater"
 * or "PR377 Real Pattern". The cleanup now NEVER name-matches alone:
 *
 *   - candidate set = (id ∈ SMOKE_PATTERN_MODEL_IDS allow-list)
 *                       UNION
 *                     (owner.email LIKE '%@rowly.test' AND name LIKE prefix)
 *   - hard-delete is allowed ONLY when EVERY matched row is in the explicit
 *     ID allow-list. Otherwise we soft-delete via `deleted_at` (the column
 *     exists per migration #062 — the previous "no soft-delete column"
 *     comment was wrong) so a misclassified row stays recoverable.
 *
 * What this cleans:
 *   - source_files: the `smoke-test.pdf` fixture (ab395474-...) on demo user
 *     PLUS every pattern_crops row attached to it
 *   - charts: name = "PR376 smoke chart" or "Smoke Magic Marker chart"
 *   - join_layouts: id-allowlisted OR (smoke `@rowly.test` user AND name LIKE
 *     prefix). Same safety contract as `pattern_models`: NEVER name-only.
 *   - pattern_models: id-allowlisted OR (smoke account AND name LIKE prefix)
 *   - patterns: name LIKE 'PR3%' on smoke (`*@rowly.test`) accounts only
 *   - projects: name LIKE 'PR3%' on smoke accounts only
 *
 * What is NEVER touched (preserved owner/demo data):
 *   - The demo user itself
 *   - "Miu Top" pattern (real demo content per memory)
 *   - "Cotton baby blanket" + "Cotton baby blanket (copy)" projects
 *   - Any pattern_model owned by a non-`@rowly.test` user, regardless of name
 *   - Anything not matching one of the rules above
 *
 * Soft delete (sets `deleted_at`/`archived_at`) over hard delete so the
 * action is reversible if we get a name match wrong. Charts only have
 * `archived_at`, so we use that. Smoke user accounts themselves are left
 * alone — they're already empty after their files are pruned.
 *
 * Usage (run inside the prod backend container):
 *   docker exec rowly_backend node dist/src/scripts/cleanupSmokeArtifacts.js --dry-run
 *   docker exec rowly_backend node dist/src/scripts/cleanupSmokeArtifacts.js
 */

import type { Knex } from 'knex';
import db from '../config/database';

const DRY_RUN = process.argv.includes('--dry-run');

const SMOKE_SOURCE_FILE_IDS = [
  'ab395474-33a8-45f2-b9dc-0f6c9d75c46c', // smoke-test.pdf on demo user
];

const SMOKE_CHART_IDS = [
  '54212736-5879-4517-b4f8-de83d96da07f', // "PR376 smoke chart"
  'dd53b6bf-afb0-48c0-a1b3-fa082a9d4b63', // "Smoke Magic Marker chart"
];

/**
 * Explicit pattern_model IDs known to be smoke-only. Empty by default —
 * operator pastes IDs here from a previous dry-run when they're confident
 * the rows are smoke artifacts. Hard delete is ONLY allowed when every
 * matched row is in this list; otherwise the script falls back to soft
 * delete via `deleted_at`.
 */
const SMOKE_PATTERN_MODEL_IDS: string[] = [];

const SMOKE_PATTERN_MODEL_NAME_PREFIXES = [
  'PR3',
  'Hardening Smoke',
  'Smoke ',
  'Miu Top — canonical twin',
];

/**
 * Same shape as SMOKE_PATTERN_MODEL_IDS but for join_layouts. Operator
 * pastes IDs here from a previous dry-run when they're confident the
 * matched rows are smoke artifacts. Empty by default; the email-gated
 * smoke-prefix branch is the normal path.
 */
const SMOKE_JOIN_LAYOUT_IDS: string[] = [];

const SMOKE_JOIN_LAYOUT_NAME_PREFIXES = [
  'Smoke ',
  'Smoke layout PR',
  'PR3',
  'Hardening Smoke',
];

const SMOKE_USER_EMAIL_GLOB = '%@rowly.test';

interface Counts {
  sourceFiles: number;
  crops: number;
  charts: number;
  joinLayouts: number;
  patternModels: number;
  patternModelsHardDeleted: number;
  patterns: number;
  projects: number;
}

export interface PatternModelCandidate {
  id: string;
  name: string;
  user_id: string;
  email: string;
}

export interface JoinLayoutCandidate {
  id: string;
  name: string;
  user_id: string;
  project_id: string;
  email: string;
}

/**
 * Pattern_model candidates for cleanup. Joins users so the email gate
 * actually fires — the previous version didn't join, so a name-only
 * match was a real-data risk. Two safe sources combined:
 *
 *   1. id ∈ SMOKE_PATTERN_MODEL_IDS (operator-curated)
 *   2. owner.email LIKE '%@rowly.test' AND name LIKE smoke prefix
 *
 * NEVER name-match alone. Exported so a unit test can prove the filter
 * holds on a fixture set that includes a real-user "Smoke Sweater".
 */
export async function selectPatternModelCandidates(
  conn: Knex = db,
): Promise<PatternModelCandidate[]> {
  const query = conn('pattern_models as pm')
    .innerJoin('users as u', 'u.id', 'pm.user_id')
    .whereNull('pm.deleted_at')
    .where(function () {
      // Branch 1: id allow-list (operator-curated, always safe).
      if (SMOKE_PATTERN_MODEL_IDS.length > 0) {
        this.whereIn('pm.id', SMOKE_PATTERN_MODEL_IDS);
      }
      // Branch 2: smoke-account email AND smoke-prefix name.
      this.orWhere(function () {
        this.where('u.email', 'like', SMOKE_USER_EMAIL_GLOB).andWhere(
          function () {
            for (const prefix of SMOKE_PATTERN_MODEL_NAME_PREFIXES) {
              this.orWhere('pm.name', 'ilike', `${prefix}%`);
            }
          },
        );
      });
    })
    .select<PatternModelCandidate[]>(
      'pm.id',
      'pm.name',
      'pm.user_id',
      'u.email',
    );
  return query;
}

/**
 * Join_layout candidates for cleanup. Same safety contract as
 * `selectPatternModelCandidates` — NEVER name-only. Two safe sources:
 *
 *   1. id ∈ SMOKE_JOIN_LAYOUT_IDS (operator-curated)
 *   2. owner.email LIKE '%@rowly.test' AND name LIKE smoke prefix
 *
 * Previously this script ran a global `where name ilike 'Smoke%'` with
 * no user-scope filter, which would soft-delete a real user's join
 * layout literally named "Smoke" or "Smoke fade" — a plausible knitter
 * name for a colorwork project. Exported so a test can pin the gate.
 */
export async function selectJoinLayoutCandidates(
  conn: Knex = db,
): Promise<JoinLayoutCandidate[]> {
  const query = conn('join_layouts as jl')
    .innerJoin('users as u', 'u.id', 'jl.user_id')
    .whereNull('jl.deleted_at')
    .where(function () {
      // Branch 1: id allow-list (operator-curated, always safe).
      if (SMOKE_JOIN_LAYOUT_IDS.length > 0) {
        this.whereIn('jl.id', SMOKE_JOIN_LAYOUT_IDS);
      }
      // Branch 2: smoke-account email AND smoke-prefix name.
      this.orWhere(function () {
        this.where('u.email', 'like', SMOKE_USER_EMAIL_GLOB).andWhere(
          function () {
            for (const prefix of SMOKE_JOIN_LAYOUT_NAME_PREFIXES) {
              this.orWhere('jl.name', 'ilike', `${prefix}%`);
            }
          },
        );
      });
    })
    .select<JoinLayoutCandidate[]>(
      'jl.id',
      'jl.name',
      'jl.user_id',
      'jl.project_id',
      'u.email',
    );
  return query;
}

async function listSmokeRows(): Promise<{
  sourceFiles: Array<{ id: string; original_filename: string | null; user_id: string }>;
  crops: Array<{ id: string; label: string | null; source_file_id: string }>;
  charts: Array<{ id: string; name: string; user_id: string }>;
  joinLayouts: JoinLayoutCandidate[];
  patternModels: PatternModelCandidate[];
  patterns: Array<{ id: string; name: string; user_id: string; email: string }>;
  projects: Array<{ id: string; name: string; user_id: string; email: string }>;
}> {
  const sourceFiles = await db('source_files')
    .whereIn('id', SMOKE_SOURCE_FILE_IDS)
    .whereNull('deleted_at')
    .select('id', 'original_filename', 'user_id');

  const crops = await db('pattern_crops')
    .whereIn('source_file_id', SMOKE_SOURCE_FILE_IDS)
    .whereNull('deleted_at')
    .select('id', 'label', 'source_file_id');

  const charts = await db('charts')
    .whereIn('id', SMOKE_CHART_IDS)
    .whereNull('archived_at')
    .select('id', 'name', 'user_id');

  // join_layouts — only ever cleaned via the safe filter (id allow-list
  // OR smoke-account-scoped). Previously a global `name ilike 'Smoke%'`
  // would have caught a real knitter's "Smoke fade cardigan" layout.
  const joinLayouts = await selectJoinLayoutCandidates(db);

  // Pattern_models are only ever cleaned via the safe filter (id allow-list
  // OR smoke-account-scoped); see `selectPatternModelCandidates`.
  const patternModels = await selectPatternModelCandidates(db);

  // Legacy patterns scoped to smoke accounts (*@rowly.test) only — keeps
  // any real owner pattern that happens to start with "PR3" safe.
  const patterns = await db('patterns as p')
    .innerJoin('users as u', 'u.id', 'p.user_id')
    .where('u.email', 'like', SMOKE_USER_EMAIL_GLOB)
    .whereNull('p.deleted_at')
    .where('p.name', 'ilike', 'PR3%')
    .select('p.id', 'p.name', 'p.user_id', 'u.email');

  // Same scoping for projects: smoke accounts only, name starts with PR3.
  const projects = await db('projects as p')
    .innerJoin('users as u', 'u.id', 'p.user_id')
    .where('u.email', 'like', SMOKE_USER_EMAIL_GLOB)
    .whereNull('p.deleted_at')
    .where('p.name', 'ilike', 'PR3%')
    .select('p.id', 'p.name', 'p.user_id', 'u.email');

  return { sourceFiles, crops, charts, joinLayouts, patternModels, patterns, projects };
}

async function softDelete(
  patternModelCandidates: PatternModelCandidate[],
  joinLayoutCandidates: JoinLayoutCandidate[],
): Promise<Counts> {
  const counts: Counts = {
    sourceFiles: 0,
    crops: 0,
    charts: 0,
    joinLayouts: 0,
    patternModels: 0,
    patternModelsHardDeleted: 0,
    patterns: 0,
    projects: 0,
  };

  const now = new Date();

  // pattern_crops first so they're already gone before we soft-delete
  // the parent source file (semantic order; the queries are idempotent).
  counts.crops = await db('pattern_crops')
    .whereIn('source_file_id', SMOKE_SOURCE_FILE_IDS)
    .whereNull('deleted_at')
    .update({ deleted_at: now });

  counts.sourceFiles = await db('source_files')
    .whereIn('id', SMOKE_SOURCE_FILE_IDS)
    .whereNull('deleted_at')
    .update({ deleted_at: now });

  counts.charts = await db('charts')
    .whereIn('id', SMOKE_CHART_IDS)
    .whereNull('archived_at')
    .update({ archived_at: now });

  // join_layouts — soft-delete only the rows already gated by
  // `selectJoinLayoutCandidates` (id allow-list OR smoke-email + name
  // prefix). Update by ID list, not by name match, so a real-user row
  // that shares a "Smoke …" prefix is never touched.
  if (joinLayoutCandidates.length > 0) {
    const joinLayoutIds = joinLayoutCandidates.map((r) => r.id);
    counts.joinLayouts = await db('join_layouts')
      .whereIn('id', joinLayoutIds)
      .whereNull('deleted_at')
      .update({ deleted_at: now });
  }

  // Pattern_models — safe path. Take the candidate set already filtered
  // by the (id allow-list) ∪ (smoke-email + name-prefix) gate, and:
  //   - Hard-delete ONLY when every row is in the explicit ID allow-list
  //     (operator opt-in; default empty).
  //   - Otherwise soft-delete via `deleted_at`. The column exists per
  //     migration #062; the previous comment claiming it didn't was wrong.
  if (patternModelCandidates.length > 0) {
    const candidateIds = patternModelCandidates.map((r) => r.id);
    const everyIdAllowlisted = candidateIds.every((id) =>
      SMOKE_PATTERN_MODEL_IDS.includes(id),
    );
    if (everyIdAllowlisted) {
      counts.patternModelsHardDeleted = await db('pattern_models')
        .whereIn('id', candidateIds)
        .delete();
      counts.patternModels = counts.patternModelsHardDeleted;
    } else {
      counts.patternModels = await db('pattern_models')
        .whereIn('id', candidateIds)
        .whereNull('deleted_at')
        .update({ deleted_at: now, updated_at: now });
    }
  }

  // Legacy patterns / projects: soft-delete via deleted_at, scoped to
  // smoke accounts. We do these in two steps — first read the ids
  // through the user-join filter, then update by id list — because
  // `update` with a join doesn't work the same on knex+pg.
  const patternIds = (
    await db('patterns as p')
      .innerJoin('users as u', 'u.id', 'p.user_id')
      .where('u.email', 'like', SMOKE_USER_EMAIL_GLOB)
      .whereNull('p.deleted_at')
      .where('p.name', 'ilike', 'PR3%')
      .select('p.id')
  ).map((r) => r.id as string);
  if (patternIds.length > 0) {
    counts.patterns = await db('patterns')
      .whereIn('id', patternIds)
      .update({ deleted_at: now });
  }

  const projectIds = (
    await db('projects as p')
      .innerJoin('users as u', 'u.id', 'p.user_id')
      .where('u.email', 'like', SMOKE_USER_EMAIL_GLOB)
      .whereNull('p.deleted_at')
      .where('p.name', 'ilike', 'PR3%')
      .select('p.id')
  ).map((r) => r.id as string);
  if (projectIds.length > 0) {
    counts.projects = await db('projects')
      .whereIn('id', projectIds)
      .update({ deleted_at: now });
  }

  return counts;
}

async function main(): Promise<void> {
  console.log(`[cleanup-smoke] mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);

  const inv = await listSmokeRows();

  console.log('[cleanup-smoke] candidates:');
  console.log(`  source_files: ${inv.sourceFiles.length}`);
  for (const r of inv.sourceFiles) {
    console.log(`    ${r.id}  ${r.original_filename}  user=${r.user_id}`);
  }
  console.log(`  pattern_crops (under those source files): ${inv.crops.length}`);
  for (const r of inv.crops) {
    console.log(`    ${r.id}  label=${JSON.stringify(r.label)}`);
  }
  console.log(`  charts: ${inv.charts.length}`);
  for (const r of inv.charts) {
    console.log(`    ${r.id}  ${r.name}  user=${r.user_id}`);
  }
  const idAllowlistedJLs = inv.joinLayouts.filter((r) =>
    SMOKE_JOIN_LAYOUT_IDS.includes(r.id),
  );
  const emailScopedJLs = inv.joinLayouts.filter(
    (r) => !SMOKE_JOIN_LAYOUT_IDS.includes(r.id),
  );
  console.log(
    `  join_layouts: ${inv.joinLayouts.length} (id-allowlisted=${idAllowlistedJLs.length}, smoke-email=${emailScopedJLs.length})`,
  );
  for (const r of inv.joinLayouts) {
    const tag = SMOKE_JOIN_LAYOUT_IDS.includes(r.id) ? 'id-allowlist' : 'smoke-email';
    console.log(
      `    ${r.id}  ${r.name}  project=${r.project_id}  user=${r.user_id}  email=${r.email}  via=${tag}`,
    );
  }
  const idAllowlistedPMs = inv.patternModels.filter((r) =>
    SMOKE_PATTERN_MODEL_IDS.includes(r.id),
  );
  const emailScopedPMs = inv.patternModels.filter(
    (r) => !SMOKE_PATTERN_MODEL_IDS.includes(r.id),
  );
  const willHardDelete =
    inv.patternModels.length > 0 && emailScopedPMs.length === 0;
  console.log(
    `  pattern_models: ${inv.patternModels.length} (id-allowlisted=${idAllowlistedPMs.length}, smoke-email=${emailScopedPMs.length}; ${
      willHardDelete ? 'will HARD-DELETE' : 'will SOFT-DELETE'
    })`,
  );
  for (const r of inv.patternModels) {
    const tag = SMOKE_PATTERN_MODEL_IDS.includes(r.id) ? 'id-allowlist' : 'smoke-email';
    console.log(`    ${r.id}  ${r.name}  user=${r.user_id}  email=${r.email}  via=${tag}`);
  }
  console.log(`  patterns (smoke accounts only): ${inv.patterns.length}`);
  for (const r of inv.patterns) {
    console.log(`    ${r.id}  ${r.name}  ${r.email}`);
  }
  console.log(`  projects (smoke accounts only): ${inv.projects.length}`);
  for (const r of inv.projects) {
    console.log(`    ${r.id}  ${r.name}  ${r.email}`);
  }

  if (DRY_RUN) {
    console.log('[cleanup-smoke] DRY RUN — no writes made');
    await db.destroy();
    return;
  }

  if (
    inv.sourceFiles.length === 0 &&
    inv.crops.length === 0 &&
    inv.charts.length === 0 &&
    inv.joinLayouts.length === 0 &&
    inv.patternModels.length === 0 &&
    inv.patterns.length === 0 &&
    inv.projects.length === 0
  ) {
    console.log('[cleanup-smoke] nothing to do');
    await db.destroy();
    return;
  }

  const counts = await softDelete(inv.patternModels, inv.joinLayouts);
  console.log('[cleanup-smoke] cleaned:');
  console.log(`  source_files soft-deleted: ${counts.sourceFiles}`);
  console.log(`  pattern_crops soft-deleted: ${counts.crops}`);
  console.log(`  charts archived: ${counts.charts}`);
  console.log(`  join_layouts soft-deleted: ${counts.joinLayouts}`);
  console.log(
    `  pattern_models touched: ${counts.patternModels} ` +
      `(hard-deleted: ${counts.patternModelsHardDeleted}, soft-deleted: ${
        counts.patternModels - counts.patternModelsHardDeleted
      })`,
  );
  console.log(`  patterns soft-deleted: ${counts.patterns}`);
  console.log(`  projects soft-deleted: ${counts.projects}`);

  await db.destroy();
}

// Only auto-run when invoked directly (`node dist/.../cleanupSmokeArtifacts.js`).
// When imported as a module by the unit test harness, `main()` must NOT
// fire — it would try to open a real Postgres connection and abort the
// suite. The CommonJS `require.main === module` check is the standard
// guard and works for `node` invocations.
if (require.main === module) {
  main().catch((err) => {
    console.error('[cleanup-smoke] fatal:', err);
    process.exit(1);
  });
}
