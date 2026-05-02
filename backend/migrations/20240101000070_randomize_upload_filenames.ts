import { Knex } from 'knex';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Migration 070: randomize upload filenames + retire `/uploads` static mount.
 *
 * Pre-2026-05-02 every uploaded asset got a guessable filename like
 * `pattern-<uuid>-<timestamp>.<ext>` and was served from an unauthenticated
 * `/uploads` static mount. This migration is half of the kill-switch:
 *
 *   1. Add `storage_filename` columns to audio_notes / handwritten_notes
 *      so the auth endpoint can resolve a row to a disk file without
 *      parsing the public URL we emit.
 *   2. Generate a 16-byte random hex token per row across every uploads
 *      table that wrote pattern-* / project-* / yarn-* / audio-* /
 *      handwritten-* names. Preserve the original extension so the
 *      streaming endpoint can set Content-Type without sniffing.
 *   3. Rename the file on disk in lockstep. If the file is missing
 *      (deleted, never persisted), update the DB anyway — the new auth
 *      endpoint returns 404 for unknown filenames, which is what we want.
 *   4. Rewrite `file_path` / `thumbnail_path` / `audio_url` / `image_url`
 *      to point at the new auth-streaming endpoints (callers still read
 *      these as response shape).
 *
 * The matching code change (same PR) drops `app.use('/uploads', static)`,
 * so guessing an old filename gets a 404 instead of bytes.
 */

interface FileRename {
  subdir: string;
  oldFilename: string;
  newFilename: string;
}

function randomToken(extension: string): string {
  const cleanExt = (extension ?? '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  const ext = cleanExt
    ? cleanExt.startsWith('.') ? cleanExt : `.${cleanExt}`
    : '';
  return `${crypto.randomBytes(16).toString('hex')}${ext}`;
}

function extOf(filename: string | null | undefined, fallback: string): string {
  if (!filename) return fallback;
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return fallback;
  return filename.slice(dot);
}

async function renameOnDisk(
  uploadRoot: string,
  rename: FileRename
): Promise<void> {
  const oldPath = path.join(uploadRoot, rename.subdir, rename.oldFilename);
  const newPath = path.join(uploadRoot, rename.subdir, rename.newFilename);
  try {
    await fs.promises.rename(oldPath, newPath);
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.warn(
        `[070] Rename failed for ${rename.subdir}/${rename.oldFilename}: ${err?.message}`
      );
    }
    // ENOENT is expected on dev boxes / when source files were deleted
    // but DB rows weren't. The DB still gets the new name and the
    // streaming endpoint returns 404 cleanly.
  }
}

export async function up(knex: Knex): Promise<void> {
  const uploadRoot = path.resolve(
    process.env.UPLOAD_DIR ?? path.join(__dirname, '..', 'uploads')
  );

  // 1. Add columns first so the data loops can populate them inline.
  if (!(await knex.schema.hasColumn('audio_notes', 'storage_filename'))) {
    await knex.schema.alterTable('audio_notes', (t) => {
      t.string('storage_filename', 64).nullable();
    });
  }
  if (!(await knex.schema.hasColumn('handwritten_notes', 'storage_filename'))) {
    await knex.schema.alterTable('handwritten_notes', (t) => {
      t.string('storage_filename', 64).nullable();
    });
  }
  // patterns.thumbnail_url already exists; add storage_filename for the
  // local-file case so the auth endpoint can resolve.
  if (!(await knex.schema.hasColumn('patterns', 'thumbnail_storage_filename'))) {
    await knex.schema.alterTable('patterns', (t) => {
      t.string('thumbnail_storage_filename', 64).nullable();
    });
  }
  // detected_charts.storage_filename for the auth endpoint to resolve.
  if (!(await knex.schema.hasColumn('detected_charts', 'storage_filename'))) {
    await knex.schema.alterTable('detected_charts', (t) => {
      t.string('storage_filename', 64).nullable();
    });
  }

  const renames: FileRename[] = [];

  // 2a. project_photos
  const projectPhotos = await knex('project_photos').select(
    'id',
    'project_id',
    'filename',
    'thumbnail_filename'
  );
  for (const row of projectPhotos) {
    const newFilename = randomToken(extOf(row.filename, '.webp'));
    const newThumb = row.thumbnail_filename
      ? randomToken(extOf(row.thumbnail_filename, '.webp'))
      : null;
    if (row.filename) {
      renames.push({ subdir: 'projects', oldFilename: row.filename, newFilename });
    }
    if (row.thumbnail_filename && newThumb) {
      renames.push({
        subdir: 'projects/thumbnails',
        oldFilename: row.thumbnail_filename,
        newFilename: newThumb,
      });
    }
    await knex('project_photos')
      .where({ id: row.id })
      .update({
        filename: newFilename,
        thumbnail_filename: newThumb,
        file_path: `/api/uploads/projects/${row.project_id}/photos/${row.id}`,
        thumbnail_path: `/api/uploads/projects/${row.project_id}/photos/${row.id}/thumbnail`,
      });
  }

  // 2b. yarn_photos
  const yarnPhotos = await knex('yarn_photos').select(
    'id',
    'yarn_id',
    'filename',
    'thumbnail_filename'
  );
  for (const row of yarnPhotos) {
    const newFilename = randomToken(extOf(row.filename, '.webp'));
    const newThumb = row.thumbnail_filename
      ? randomToken(extOf(row.thumbnail_filename, '.webp'))
      : null;
    if (row.filename) {
      renames.push({ subdir: 'yarn', oldFilename: row.filename, newFilename });
    }
    if (row.thumbnail_filename && newThumb) {
      renames.push({
        subdir: 'yarn/thumbnails',
        oldFilename: row.thumbnail_filename,
        newFilename: newThumb,
      });
    }
    await knex('yarn_photos')
      .where({ id: row.id })
      .update({
        filename: newFilename,
        thumbnail_filename: newThumb,
        file_path: `/api/uploads/yarn/${row.yarn_id}/photos/${row.id}`,
        thumbnail_path: `/api/uploads/yarn/${row.yarn_id}/photos/${row.id}/thumbnail`,
      });
  }

  // 2c. pattern_files (PDFs)
  const patternFiles = await knex('pattern_files').select(
    'id',
    'pattern_id',
    'filename'
  );
  for (const row of patternFiles) {
    const newFilename = randomToken(extOf(row.filename, '.pdf'));
    if (row.filename) {
      renames.push({ subdir: 'patterns', oldFilename: row.filename, newFilename });
    }
    await knex('pattern_files')
      .where({ id: row.id })
      .update({
        filename: newFilename,
        file_path: `/api/uploads/patterns/${row.pattern_id}/files/${row.id}/download`,
      });
  }

  // 2d. patterns.thumbnail_url — only retarget local /uploads/patterns/...
  // entries; external URLs (rare; defaulted to a local copy as of #198) stay.
  const patterns = await knex('patterns')
    .whereNotNull('thumbnail_url')
    .select('id', 'thumbnail_url');
  for (const row of patterns) {
    const url = String(row.thumbnail_url ?? '');
    if (!url.startsWith('/uploads/patterns/')) continue;
    const oldFilename = url.replace('/uploads/patterns/', '');
    const newFilename = randomToken(extOf(oldFilename, '.webp'));
    renames.push({ subdir: 'patterns', oldFilename, newFilename });
    await knex('patterns')
      .where({ id: row.id })
      .update({
        thumbnail_url: `/api/uploads/patterns/${row.id}/thumbnail`,
        thumbnail_storage_filename: newFilename,
      });
  }

  // 2e. audio_notes
  const audioNotes = await knex('audio_notes')
    .whereNotNull('audio_url')
    .select('id', 'project_id', 'audio_url');
  for (const row of audioNotes) {
    const url = String(row.audio_url ?? '');
    if (!url.startsWith('/uploads/audio/')) continue;
    const oldFilename = url.replace('/uploads/audio/', '');
    const newFilename = randomToken(extOf(oldFilename, '.webm'));
    renames.push({ subdir: 'audio', oldFilename, newFilename });
    await knex('audio_notes')
      .where({ id: row.id })
      .update({
        storage_filename: newFilename,
        audio_url: `/api/projects/${row.project_id}/audio-notes/${row.id}/stream`,
      });
  }

  // 2f. handwritten_notes
  const handwrittenNotes = await knex('handwritten_notes')
    .whereNotNull('image_url')
    .select('id', 'project_id', 'image_url');
  for (const row of handwrittenNotes) {
    const url = String(row.image_url ?? '');
    if (!url.startsWith('/uploads/handwritten/')) continue;
    const oldFilename = url.replace('/uploads/handwritten/', '');
    const newFilename = randomToken(extOf(oldFilename, '.png'));
    renames.push({ subdir: 'handwritten', oldFilename, newFilename });
    await knex('handwritten_notes')
      .where({ id: row.id })
      .update({
        storage_filename: newFilename,
        image_url: `/api/projects/${row.project_id}/handwritten-notes/${row.id}/image`,
      });
  }

  // 2g. detected_charts
  const detectedCharts = await knex('detected_charts')
    .whereNotNull('original_image_url')
    .select('id', 'original_image_url');
  for (const row of detectedCharts) {
    const url = String(row.original_image_url ?? '');
    if (!url.startsWith('/uploads/charts/')) continue;
    const oldFilename = url.replace('/uploads/charts/', '');
    const newFilename = randomToken(extOf(oldFilename, '.png'));
    renames.push({ subdir: 'charts', oldFilename, newFilename });
    await knex('detected_charts')
      .where({ id: row.id })
      .update({
        storage_filename: newFilename,
        original_image_url: `/api/charts/detection/${row.id}/image`,
      });
  }

  // 2h. pattern_collations — file_path was `collated/<filename>`. Move to
  // storing just the filename + auth-streaming via /api/patterns/collations/...
  const collations = await knex('pattern_collations')
    .whereNotNull('file_path')
    .select('id', 'file_path');
  for (const row of collations) {
    const filePath = String(row.file_path ?? '');
    const oldFilename = filePath.startsWith('collated/')
      ? filePath.slice('collated/'.length)
      : filePath;
    if (!oldFilename) continue;
    const newFilename = randomToken(extOf(oldFilename, '.pdf'));
    renames.push({ subdir: 'collated', oldFilename, newFilename });
    await knex('pattern_collations')
      .where({ id: row.id })
      .update({ file_path: newFilename });
  }

  // 3. Rename files on disk last, after the DB is consistent.
  for (const rename of renames) {
    await renameOnDisk(uploadRoot, rename);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Best-effort revert: drop the columns we added. Filenames stay
  // randomized — the matching app.ts change in the same PR removes the
  // /uploads static mount, so a rollback also needs to put that back.
  if (await knex.schema.hasColumn('audio_notes', 'storage_filename')) {
    await knex.schema.alterTable('audio_notes', (t) => {
      t.dropColumn('storage_filename');
    });
  }
  if (await knex.schema.hasColumn('handwritten_notes', 'storage_filename')) {
    await knex.schema.alterTable('handwritten_notes', (t) => {
      t.dropColumn('storage_filename');
    });
  }
  if (await knex.schema.hasColumn('patterns', 'thumbnail_storage_filename')) {
    await knex.schema.alterTable('patterns', (t) => {
      t.dropColumn('thumbnail_storage_filename');
    });
  }
  if (await knex.schema.hasColumn('detected_charts', 'storage_filename')) {
    await knex.schema.alterTable('detected_charts', (t) => {
      t.dropColumn('storage_filename');
    });
  }
}
