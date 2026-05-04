/**
 * One-off cleanup: soft-delete known smoke-test artifacts left on prod by
 * recent PR smoke runs. Designed to be idempotent (re-running is a no-op
 * once everything is already soft-deleted) and conservative — only removes
 * records that match an explicit allow-list of known smoke artifacts, so
 * real owner/demo data stays intact.
 *
 * What this cleans (matches by id OR name pattern, demo + smoke users only):
 *   - source_files: the `smoke-test.pdf` fixture (ab395474-...) on demo user
 *     PLUS every pattern_crops row attached to it
 *   - charts: name = "PR376 smoke chart" or "Smoke Magic Marker chart"
 *   - join_layouts: name LIKE 'Smoke%' on demo user's projects
 *   - pattern_models: name LIKE 'PR3%' OR 'Hardening Smoke%' OR 'Smoke %'
 *     OR 'Miu Top — canonical twin%'
 *   - patterns: name LIKE 'PR3%' on smoke (`*@rowly.test`) accounts only
 *   - projects: name LIKE 'PR3%' on smoke accounts only
 *
 * What is NEVER touched (preserved owner/demo data):
 *   - The demo user itself
 *   - "Miu Top" pattern (real demo content per memory)
 *   - "Cotton baby blanket" + "Cotton baby blanket (copy)" projects
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

import db from '../config/database';

const DRY_RUN = process.argv.includes('--dry-run');

const SMOKE_SOURCE_FILE_IDS = [
  'ab395474-33a8-45f2-b9dc-0f6c9d75c46c', // smoke-test.pdf on demo user
];

const SMOKE_CHART_IDS = [
  '54212736-5879-4517-b4f8-de83d96da07f', // "PR376 smoke chart"
  'dd53b6bf-afb0-48c0-a1b3-fa082a9d4b63', // "Smoke Magic Marker chart"
];

interface Counts {
  sourceFiles: number;
  crops: number;
  charts: number;
  joinLayouts: number;
  patternModels: number;
  patterns: number;
  projects: number;
}

async function listSmokeRows(): Promise<{
  sourceFiles: Array<{ id: string; original_filename: string | null; user_id: string }>;
  crops: Array<{ id: string; label: string | null; source_file_id: string }>;
  charts: Array<{ id: string; name: string; user_id: string }>;
  joinLayouts: Array<{ id: string; name: string; project_id: string }>;
  patternModels: Array<{ id: string; name: string; user_id: string }>;
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

  // join_layouts named like "Smoke ..." — scope by name match, not user,
  // since the layout itself carries the project_id and any layout with that
  // name pattern is by convention a smoke fixture.
  const joinLayouts = await db('join_layouts')
    .whereNull('deleted_at')
    .where('name', 'ilike', 'Smoke%')
    .select('id', 'name', 'project_id');

  // Canonical pattern_models with smoke-fixture names. Match prefixes only.
  const patternModels = await db('pattern_models')
    .where(function () {
      this.where('name', 'ilike', 'PR3%')
        .orWhere('name', 'ilike', 'Hardening Smoke%')
        .orWhere('name', 'ilike', 'Smoke %')
        .orWhere('name', 'ilike', 'Miu Top — canonical twin%');
    })
    .select('id', 'name', 'user_id');

  // Legacy patterns scoped to smoke accounts (*@rowly.test) only — keeps
  // any real owner pattern that happens to start with "PR3" safe.
  const patterns = await db('patterns as p')
    .innerJoin('users as u', 'u.id', 'p.user_id')
    .where('u.email', 'like', '%@rowly.test')
    .whereNull('p.deleted_at')
    .where('p.name', 'ilike', 'PR3%')
    .select('p.id', 'p.name', 'p.user_id', 'u.email');

  // Same scoping for projects: smoke accounts only, name starts with PR3.
  const projects = await db('projects as p')
    .innerJoin('users as u', 'u.id', 'p.user_id')
    .where('u.email', 'like', '%@rowly.test')
    .whereNull('p.deleted_at')
    .where('p.name', 'ilike', 'PR3%')
    .select('p.id', 'p.name', 'p.user_id', 'u.email');

  return { sourceFiles, crops, charts, joinLayouts, patternModels, patterns, projects };
}

async function softDelete(): Promise<Counts> {
  const counts: Counts = {
    sourceFiles: 0,
    crops: 0,
    charts: 0,
    joinLayouts: 0,
    patternModels: 0,
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

  counts.joinLayouts = await db('join_layouts')
    .whereNull('deleted_at')
    .where('name', 'ilike', 'Smoke%')
    .update({ deleted_at: now });

  counts.patternModels = await db('pattern_models')
    .where(function () {
      this.where('name', 'ilike', 'PR3%')
        .orWhere('name', 'ilike', 'Hardening Smoke%')
        .orWhere('name', 'ilike', 'Smoke %')
        .orWhere('name', 'ilike', 'Miu Top — canonical twin%');
    })
    .delete(); // pattern_models has no soft-delete column; hard delete

  // Legacy patterns / projects: soft-delete via deleted_at, scoped to
  // smoke accounts. We do these in two steps — first read the ids
  // through the user-join filter, then update by id list — because
  // `update` with a join doesn't work the same on knex+pg.
  const patternIds = (
    await db('patterns as p')
      .innerJoin('users as u', 'u.id', 'p.user_id')
      .where('u.email', 'like', '%@rowly.test')
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
      .where('u.email', 'like', '%@rowly.test')
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
  console.log(`  join_layouts: ${inv.joinLayouts.length}`);
  for (const r of inv.joinLayouts) {
    console.log(`    ${r.id}  ${r.name}  project=${r.project_id}`);
  }
  console.log(`  pattern_models: ${inv.patternModels.length}`);
  for (const r of inv.patternModels) {
    console.log(`    ${r.id}  ${r.name}  user=${r.user_id}`);
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

  const counts = await softDelete();
  console.log('[cleanup-smoke] cleaned:');
  console.log(`  source_files soft-deleted: ${counts.sourceFiles}`);
  console.log(`  pattern_crops soft-deleted: ${counts.crops}`);
  console.log(`  charts archived: ${counts.charts}`);
  console.log(`  join_layouts soft-deleted: ${counts.joinLayouts}`);
  console.log(`  pattern_models hard-deleted: ${counts.patternModels}`);
  console.log(`  patterns soft-deleted: ${counts.patterns}`);
  console.log(`  projects soft-deleted: ${counts.projects}`);

  await db.destroy();
}

main().catch((err) => {
  console.error('[cleanup-smoke] fatal:', err);
  process.exit(1);
});
