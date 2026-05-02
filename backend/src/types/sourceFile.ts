/**
 * Wave 2 PDF-first execution model — type layer.
 *
 * Mirrors `source_files` and `pattern_crops` (migration #072). Service
 * code converts between the snake_case row shape and the camelCase
 * domain shape; controllers only ever see the camelCase form.
 *
 * Cross-craft: `craft` is first-class on every source file. The crop
 * coord system itself is craft-neutral (just (page, x, y, w, h)
 * floats), so it'll cover crochet diagrams as well as knit charts.
 */

import type { Craft } from './pattern';

export type SourceFileKind = 'pattern_pdf' | 'chart_image' | 'reference_doc';

export type SourceFileParseStatus = 'pending' | 'parsed' | 'failed' | 'skipped';

export interface PageDimension {
  /** Page width in `unit`. */
  w: number;
  /** Page height in `unit`. */
  h: number;
  /** Unit the page dimensions are measured in. PDFs default to 'pt'. */
  unit: 'pt' | 'in' | 'cm';
}

export interface SourceFile {
  id: string;
  userId: string;
  craft: Craft;
  kind: SourceFileKind;

  // Storage layer — random hex name + sanctioned subdir; resolves to
  // `<UPLOAD_DIR>/<storageSubdir>/<storageFilename>` on disk.
  storageFilename: string;
  storageSubdir: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;

  // Parser output — populated lazily.
  pageCount: number | null;
  pageDimensions: PageDimension[] | null;
  parseStatus: SourceFileParseStatus;
  parseError: string | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Optional, populated by `listSourceFilesForUser` so the UI can render
  // a "Shared" badge when the same file is referenced by crops on more
  // than one pattern. Distinct count of pattern_ids on this file's
  // pattern_crops rows; absent on direct lookups (`getSourceFileById`).
  attachmentCount?: number;
}

export interface SourceFileRow {
  id: string;
  user_id: string;
  craft: Craft;
  kind: SourceFileKind;
  storage_filename: string;
  storage_subdir: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  page_count: number | null;
  page_dimensions: PageDimension[] | string | null;
  parse_status: SourceFileParseStatus;
  parse_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface PatternCrop {
  id: string;
  sourceFileId: string;
  userId: string;
  patternId: string | null;
  /** Free-form id pointing at a section in the canonical pattern model. */
  patternSectionId: string | null;
  /** 1-indexed page number. */
  pageNumber: number;
  /** Normalized 0..1 coords, top-left origin. */
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  label: string | null;
  /** Wave 4: when this crop encloses a chart, the canonical chart id. */
  chartId: string | null;
  /** Wave 3 QuickKey fields. */
  isQuickKey: boolean;
  quickKeyPosition: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PatternCropRow {
  id: string;
  source_file_id: string;
  user_id: string;
  pattern_id: string | null;
  pattern_section_id: string | null;
  page_number: number;
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
  label: string | null;
  chart_id: string | null;
  /** Optional — present after migration #073 (Wave 3). */
  is_quickkey?: boolean;
  quickkey_position?: number | null;
  metadata: Record<string, unknown> | string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface CreateSourceFileInput {
  userId: string;
  craft: Craft;
  kind: SourceFileKind;
  storageFilename: string;
  storageSubdir?: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  pageCount?: number | null;
  pageDimensions?: PageDimension[] | null;
}

export interface CreateCropInput {
  sourceFileId: string;
  userId: string;
  patternId?: string | null;
  patternSectionId?: string | null;
  pageNumber: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  label?: string | null;
  chartId?: string | null;
  metadata?: Record<string, unknown>;
}
