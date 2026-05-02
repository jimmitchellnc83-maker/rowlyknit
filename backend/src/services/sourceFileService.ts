/**
 * Wave 2 PDF-first execution model — service layer.
 *
 * Storage / ownership boundary for `source_files` + `pattern_crops`.
 * Controllers (Wave 2 PR 2) call into this; nobody should hit the
 * tables directly so the validation in `assertCropWithinUnitSquare`
 * stays the single source of truth.
 *
 * Cross-craft: every read accepts a `craft` filter; every write either
 * trusts the caller's `craft` or inherits it from the parent source
 * file. We never assume `'knit'` and never embed knitting-specific
 * terminology in field names.
 */

import db from '../config/database';
import type {
  CreateCropInput,
  CreateSourceFileInput,
  PageDimension,
  PatternCrop,
  PatternCropRow,
  SourceFile,
  SourceFileRow,
} from '../types/sourceFile';
import { ValidationError } from '../utils/errorHandler';

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoNonNull(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function parseJsonOrPassthrough<T>(value: T | string | null): T | null {
  if (value === null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value;
}

function mapSourceFileRow(
  row: SourceFileRow & { attachment_count?: number | string },
): SourceFile {
  const out: SourceFile = {
    id: row.id,
    userId: row.user_id,
    craft: row.craft,
    kind: row.kind,
    storageFilename: row.storage_filename,
    storageSubdir: row.storage_subdir,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    pageCount: row.page_count,
    pageDimensions: parseJsonOrPassthrough<PageDimension[]>(row.page_dimensions),
    parseStatus: row.parse_status,
    parseError: row.parse_error,
    createdAt: toIsoNonNull(row.created_at),
    updatedAt: toIsoNonNull(row.updated_at),
    deletedAt: toIso(row.deleted_at),
  };
  if (row.attachment_count !== undefined && row.attachment_count !== null) {
    out.attachmentCount = Number(row.attachment_count);
  }
  return out;
}

function mapCropRow(row: PatternCropRow): PatternCrop {
  return {
    id: row.id,
    sourceFileId: row.source_file_id,
    userId: row.user_id,
    patternId: row.pattern_id,
    patternSectionId: row.pattern_section_id,
    pageNumber: row.page_number,
    cropX: Number(row.crop_x),
    cropY: Number(row.crop_y),
    cropWidth: Number(row.crop_width),
    cropHeight: Number(row.crop_height),
    label: row.label,
    chartId: row.chart_id,
    isQuickKey: !!row.is_quickkey,
    quickKeyPosition:
      row.quickkey_position === undefined || row.quickkey_position === null
        ? null
        : Number(row.quickkey_position),
    metadata:
      (parseJsonOrPassthrough<Record<string, unknown>>(row.metadata) as
        | Record<string, unknown>
        | null) ?? {},
    createdAt: toIsoNonNull(row.created_at),
    updatedAt: toIsoNonNull(row.updated_at),
    deletedAt: toIso(row.deleted_at),
  };
}

/**
 * Validates a crop rectangle stays inside the unit square, with a
 * positive non-zero area and an integer page number. Mirrors the DB
 * CHECK constraints so we fail fast in the service layer instead of
 * round-tripping a 500.
 */
export function assertCropWithinUnitSquare(input: {
  pageNumber: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}): void {
  const { pageNumber, cropX, cropY, cropWidth, cropHeight } = input;
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new ValidationError('pageNumber must be a positive integer');
  }
  if (!Number.isFinite(cropX) || cropX < 0 || cropX > 1) {
    throw new ValidationError('cropX must be between 0 and 1');
  }
  if (!Number.isFinite(cropY) || cropY < 0 || cropY > 1) {
    throw new ValidationError('cropY must be between 0 and 1');
  }
  if (!Number.isFinite(cropWidth) || cropWidth <= 0 || cropWidth > 1) {
    throw new ValidationError('cropWidth must be between 0 (exclusive) and 1');
  }
  if (!Number.isFinite(cropHeight) || cropHeight <= 0 || cropHeight > 1) {
    throw new ValidationError('cropHeight must be between 0 (exclusive) and 1');
  }
  if (cropX + cropWidth > 1 + 1e-9 || cropY + cropHeight > 1 + 1e-9) {
    throw new ValidationError('crop rectangle must stay inside the unit square');
  }
}

export async function createSourceFile(
  input: CreateSourceFileInput
): Promise<SourceFile> {
  const [row] = await db('source_files')
    .insert({
      user_id: input.userId,
      craft: input.craft,
      kind: input.kind,
      storage_filename: input.storageFilename,
      storage_subdir: input.storageSubdir ?? 'patterns',
      original_filename: input.originalFilename ?? null,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? null,
      page_count: input.pageCount ?? null,
      page_dimensions:
        input.pageDimensions === undefined || input.pageDimensions === null
          ? null
          : JSON.stringify(input.pageDimensions),
    })
    .returning('*');
  return mapSourceFileRow(row as SourceFileRow);
}

export async function getSourceFileById(
  sourceFileId: string,
  userId: string
): Promise<SourceFile | null> {
  const row = await db('source_files')
    .where({ id: sourceFileId, user_id: userId })
    .whereNull('deleted_at')
    .first();
  return row ? mapSourceFileRow(row as SourceFileRow) : null;
}

export async function listSourceFilesForUser(
  userId: string,
  filters?: {
    craft?: SourceFile['craft'];
    kind?: SourceFile['kind'];
    /** Restricts results to source files that have at least one crop
     *  attached to this pattern. Default behavior (when omitted) returns
     *  all files for the user — meant for global search; pattern + project
     *  surfaces should always pass this so the list isn't a global file
     *  dump (PRD doc 03 release anti-pattern). */
    patternId?: string;
  },
): Promise<SourceFile[]> {
  let q = db('source_files as sf')
    .where('sf.user_id', userId)
    .whereNull('sf.deleted_at')
    .leftJoin('pattern_crops as pc_count', function joinCount() {
      this.on('pc_count.source_file_id', '=', 'sf.id')
        .andOnNotNull('pc_count.pattern_id')
        .andOnNull('pc_count.deleted_at');
    })
    .groupBy('sf.id')
    .select('sf.*')
    .select(db.raw('COUNT(DISTINCT pc_count.pattern_id)::int AS attachment_count'));

  if (filters?.craft) q = q.where('sf.craft', filters.craft);
  if (filters?.kind) q = q.where('sf.kind', filters.kind);

  if (filters?.patternId) {
    const patternId = filters.patternId;
    q = q.whereExists(function existsScopedCrop() {
      this.select(db.raw('1'))
        .from('pattern_crops as pc_filter')
        .whereRaw('pc_filter.source_file_id = sf.id')
        .andWhere('pc_filter.pattern_id', patternId)
        .whereNull('pc_filter.deleted_at');
    });
  }

  const rows = await q.orderBy('sf.created_at', 'desc');
  return rows.map((r) => mapSourceFileRow(r as SourceFileRow & { attachment_count: number }));
}

export async function updateSourceFileParseResult(
  sourceFileId: string,
  result: {
    parseStatus: SourceFile['parseStatus'];
    pageCount?: number | null;
    pageDimensions?: PageDimension[] | null;
    parseError?: string | null;
  }
): Promise<void> {
  const update: Record<string, unknown> = {
    parse_status: result.parseStatus,
    updated_at: new Date(),
  };
  if (result.pageCount !== undefined) update.page_count = result.pageCount;
  if (result.pageDimensions !== undefined) {
    update.page_dimensions =
      result.pageDimensions === null ? null : JSON.stringify(result.pageDimensions);
  }
  if (result.parseError !== undefined) update.parse_error = result.parseError;
  await db('source_files').where({ id: sourceFileId }).update(update);
}

export async function softDeleteSourceFile(
  sourceFileId: string,
  userId: string
): Promise<boolean> {
  const updated = await db('source_files')
    .where({ id: sourceFileId, user_id: userId })
    .whereNull('deleted_at')
    .update({ deleted_at: new Date() });
  return updated > 0;
}

// ============================================
// pattern_crops
// ============================================

export async function createCrop(input: CreateCropInput): Promise<PatternCrop> {
  assertCropWithinUnitSquare(input);

  // Verify the source file belongs to this user. Cross-checks the
  // user_id on the crop row matches the user_id on the source file —
  // controllers should have enforced this already, but we double-up
  // because the unit-square checks run anyway.
  const source = await db('source_files')
    .where({ id: input.sourceFileId, user_id: input.userId })
    .whereNull('deleted_at')
    .first('id');
  if (!source) {
    throw new ValidationError('source file not found for user');
  }

  const [row] = await db('pattern_crops')
    .insert({
      source_file_id: input.sourceFileId,
      user_id: input.userId,
      pattern_id: input.patternId ?? null,
      pattern_section_id: input.patternSectionId ?? null,
      page_number: input.pageNumber,
      crop_x: input.cropX,
      crop_y: input.cropY,
      crop_width: input.cropWidth,
      crop_height: input.cropHeight,
      label: input.label ?? null,
      chart_id: input.chartId ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
    })
    .returning('*');
  return mapCropRow(row as PatternCropRow);
}

export async function getCropById(
  cropId: string,
  userId: string
): Promise<PatternCrop | null> {
  const row = await db('pattern_crops')
    .where({ id: cropId, user_id: userId })
    .whereNull('deleted_at')
    .first();
  return row ? mapCropRow(row as PatternCropRow) : null;
}

export async function listCropsForSourceFile(
  sourceFileId: string,
  userId: string
): Promise<PatternCrop[]> {
  // Ownership of the source file is the gate; we re-check via user_id
  // on the crop row so a crop that somehow ended up under a foreign
  // source file doesn't leak.
  const rows = await db('pattern_crops')
    .where({ source_file_id: sourceFileId, user_id: userId })
    .whereNull('deleted_at')
    .orderBy([{ column: 'page_number', order: 'asc' }, { column: 'created_at', order: 'asc' }]);
  return rows.map((r) => mapCropRow(r as PatternCropRow));
}

export async function listCropsForPattern(
  patternId: string,
  userId: string
): Promise<PatternCrop[]> {
  const rows = await db('pattern_crops')
    .where({ pattern_id: patternId, user_id: userId })
    .whereNull('deleted_at')
    .orderBy([{ column: 'page_number', order: 'asc' }, { column: 'created_at', order: 'asc' }]);
  return rows.map((r) => mapCropRow(r as PatternCropRow));
}

export async function softDeleteCrop(
  cropId: string,
  userId: string
): Promise<boolean> {
  const updated = await db('pattern_crops')
    .where({ id: cropId, user_id: userId })
    .whereNull('deleted_at')
    .update({ deleted_at: new Date() });
  return updated > 0;
}

// ============================================
// project_patterns linkage helper
// ============================================

/**
 * Pin a project's instance of a pattern to a specific source file. The
 * row has to exist already (it's created when the pattern is added to
 * the project); this just updates the pointer.
 */
export async function pinSourceFileToProjectPattern(args: {
  projectId: string;
  patternId: string;
  sourceFileId: string | null;
  userId: string;
}): Promise<boolean> {
  // Membership: confirm both the project and the source file are
  // owned by the user before we touch project_patterns.
  const project = await db('projects')
    .where({ id: args.projectId, user_id: args.userId })
    .whereNull('deleted_at')
    .first('id');
  if (!project) return false;
  if (args.sourceFileId !== null) {
    const sf = await db('source_files')
      .where({ id: args.sourceFileId, user_id: args.userId })
      .whereNull('deleted_at')
      .first('id');
    if (!sf) return false;
  }
  const updated = await db('project_patterns')
    .where({ project_id: args.projectId, pattern_id: args.patternId })
    .update({ source_file_id: args.sourceFileId });
  return updated > 0;
}
