/**
 * Wave 2 PR 2 — HTTP layer over `sourceFileService`.
 *
 * Endpoints expose:
 *   - SourceFile CRUD (`POST/GET/DELETE /api/source-files`,
 *     `GET /api/source-files/:id/file` for the auth-streamed bytes)
 *   - PatternCrop CRUD nested under each source file
 *   - `pinSourceFileToProjectPattern` for project-pattern linkage
 *
 * Cross-craft: every list endpoint round-trips `craft` via query
 * filter; every create accepts `craft` from the caller.
 *
 * Storage layer reuses Wave 1 #1's contract — random hex filenames,
 * `streamSafeUpload` for bytes-out, no file_path stored verbatim.
 */

import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import db from '../config/database';
import logger from '../config/logger';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import {
  generateStorageFilename,
  streamSafeUpload,
  uploadRoot,
} from '../utils/uploadStorage';
import {
  createCrop,
  createSourceFile,
  getCropById,
  getSourceFileById,
  listCropsForPattern,
  listCropsForSourceFile,
  listSourceFilesForUser,
  pinSourceFileToProjectPattern,
  softDeleteCrop,
  softDeleteSourceFile,
  updateSourceFileParseResult,
} from '../services/sourceFileService';
import type { Craft } from '../types/pattern';
import type {
  PageDimension,
  SourceFileKind,
} from '../types/sourceFile';

const sourceFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — pattern PDFs run big
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/x-pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    const isPdfByExt = file.originalname.toLowerCase().endsWith('.pdf');
    if (allowed.includes(file.mimetype) || isPdfByExt) cb(null, true);
    else cb(new Error(`Invalid file type: ${file.mimetype}`));
  },
});

export const uploadSourceFileMiddleware = sourceFileUpload.single('file');

const VALID_CRAFTS: Craft[] = ['knit', 'crochet'];
const VALID_KINDS: SourceFileKind[] = [
  'pattern_pdf',
  'chart_image',
  'reference_doc',
];

function parseCraft(input: unknown, fallback: Craft = 'knit'): Craft {
  if (typeof input === 'string' && (VALID_CRAFTS as string[]).includes(input)) {
    return input as Craft;
  }
  return fallback;
}

function parseKind(input: unknown, fallback: SourceFileKind = 'pattern_pdf'): SourceFileKind {
  if (typeof input === 'string' && (VALID_KINDS as string[]).includes(input)) {
    return input as SourceFileKind;
  }
  return fallback;
}

async function parsePdfMetadata(
  buffer: Buffer
): Promise<{ pageCount: number; pageDimensions: PageDimension[] }> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pageCount = doc.getPageCount();
  const pageDimensions: PageDimension[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    pageDimensions.push({ w: width, h: height, unit: 'pt' });
  }
  return { pageCount, pageDimensions };
}

// POST /api/source-files
export async function uploadSourceFile(req: Request, res: Response): Promise<void> {
  req.socket.setTimeout(180_000);
  const userId = req.user!.userId;
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    throw new ValidationError('file is required');
  }

  const craft = parseCraft(req.body.craft, 'knit');
  const kind = parseKind(req.body.kind, 'pattern_pdf');

  // Pick a subdir per kind so disk layout matches the file class.
  const subdir =
    kind === 'chart_image'
      ? 'charts'
      : kind === 'reference_doc'
        ? 'reference'
        : 'patterns';

  const ext = path.extname(file.originalname).toLowerCase() || (kind === 'pattern_pdf' ? '.pdf' : '');
  const storageFilename = generateStorageFilename(ext);
  const targetDir = path.join(uploadRoot(), subdir);
  await fs.promises.mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, storageFilename);
  await fs.promises.writeFile(targetPath, file.buffer);

  let pageCount: number | null = null;
  let pageDimensions: PageDimension[] | null = null;
  let parseStatus: 'pending' | 'parsed' | 'failed' | 'skipped' = 'skipped';
  let parseError: string | null = null;

  if (kind === 'pattern_pdf' && (file.mimetype.includes('pdf') || ext === '.pdf')) {
    try {
      const meta = await parsePdfMetadata(file.buffer);
      pageCount = meta.pageCount;
      pageDimensions = meta.pageDimensions;
      parseStatus = 'parsed';
    } catch (err) {
      parseStatus = 'failed';
      parseError = err instanceof Error ? err.message : String(err);
      logger.warn('PDF parse failed', { userId, error: parseError });
    }
  }

  // Capture upload-context patternId so the file appears in that
  // pattern's Sources tab immediately, before any crops are drawn.
  const uploadPatternId =
    typeof req.body.patternId === 'string' && req.body.patternId.length > 0
      ? req.body.patternId
      : null;

  const sf = await createSourceFile({
    userId,
    craft,
    kind,
    storageFilename,
    storageSubdir: subdir,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    pageCount,
    pageDimensions,
    intendedPatternId: uploadPatternId,
  });

  // updateSourceFileParseResult sets the parse status; we already wrote
  // page metadata above via createSourceFile, so this just flips the
  // status flag (and stashes an error if the parse failed).
  if (parseStatus !== 'skipped') {
    await updateSourceFileParseResult(sf.id, { parseStatus, parseError });
    sf.parseStatus = parseStatus;
    sf.parseError = parseError;
  }

  // Optional: link to a project_patterns row if the caller passed one.
  const projectId = typeof req.body.projectId === 'string' ? req.body.projectId : null;
  const patternId = typeof req.body.patternId === 'string' ? req.body.patternId : null;
  if (projectId && patternId) {
    await pinSourceFileToProjectPattern({
      projectId,
      patternId,
      sourceFileId: sf.id,
      userId,
    });
  }

  res.status(201).json({ success: true, data: { sourceFile: sf } });
}

// GET /api/source-files
export async function listSourceFiles(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const filters: { craft?: Craft; kind?: SourceFileKind; patternId?: string } = {};
  if (typeof req.query.craft === 'string' && (VALID_CRAFTS as string[]).includes(req.query.craft)) {
    filters.craft = req.query.craft as Craft;
  }
  if (typeof req.query.kind === 'string' && (VALID_KINDS as string[]).includes(req.query.kind)) {
    filters.kind = req.query.kind as SourceFileKind;
  }
  if (typeof req.query.patternId === 'string' && req.query.patternId.length > 0) {
    filters.patternId = req.query.patternId;
  }
  const sourceFiles = await listSourceFilesForUser(userId, filters);
  res.json({ success: true, data: { sourceFiles } });
}

// GET /api/source-files/:id
export async function getSourceFile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const sf = await getSourceFileById(req.params.id, userId);
  if (!sf) throw new NotFoundError('Source file not found');
  res.json({ success: true, data: { sourceFile: sf } });
}

// GET /api/source-files/:id/file — auth-streamed bytes
export async function streamSourceFileBytes(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const sf = await getSourceFileById(req.params.id, userId);
  if (!sf) throw new NotFoundError('Source file not found');
  await streamSafeUpload(res, {
    subdir: sf.storageSubdir,
    filename: sf.storageFilename,
    mimeType: sf.mimeType ?? 'application/octet-stream',
  });
}

// DELETE /api/source-files/:id
export async function deleteSourceFile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const ok = await softDeleteSourceFile(req.params.id, userId);
  if (!ok) throw new NotFoundError('Source file not found');
  res.json({ success: true, message: 'Source file deleted' });
}

// POST /api/source-files/:id/crops
export async function createSourceFileCrop(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const sourceFileId = req.params.id;
  const body = req.body as Record<string, unknown>;
  const crop = await createCrop({
    sourceFileId,
    userId,
    pageNumber: Number(body.pageNumber),
    cropX: Number(body.cropX),
    cropY: Number(body.cropY),
    cropWidth: Number(body.cropWidth),
    cropHeight: Number(body.cropHeight),
    label: typeof body.label === 'string' ? body.label : null,
    patternId: typeof body.patternId === 'string' ? body.patternId : null,
    patternSectionId: typeof body.patternSectionId === 'string' ? body.patternSectionId : null,
    metadata:
      typeof body.metadata === 'object' && body.metadata !== null
        ? (body.metadata as Record<string, unknown>)
        : {},
  });
  res.status(201).json({ success: true, data: { crop } });
}

// GET /api/source-files/:id/crops
export async function listSourceFileCrops(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  // The service join already gates on user_id; we still 404 early if
  // the parent source file isn't owned by the caller so the response
  // shape doesn't reveal the difference between "no crops" and "no
  // permission to see this source file."
  const sf = await getSourceFileById(req.params.id, userId);
  if (!sf) throw new NotFoundError('Source file not found');
  const crops = await listCropsForSourceFile(req.params.id, userId);
  res.json({ success: true, data: { crops } });
}

// GET /api/patterns/:patternId/crops
export async function listPatternCrops(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const pattern = await db('patterns')
    .where({ id: req.params.patternId, user_id: userId })
    .whereNull('deleted_at')
    .first('id');
  if (!pattern) throw new NotFoundError('Pattern not found');
  const crops = await listCropsForPattern(req.params.patternId, userId);
  res.json({ success: true, data: { crops } });
}

// PATCH /api/source-files/:fileId/crops/:cropId
export async function updateSourceFileCrop(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { cropId } = req.params;

  const existing = await getCropById(cropId, userId);
  if (!existing) throw new NotFoundError('Crop not found');

  const body = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = { updated_at: new Date() };

  if ('label' in body) update.label = typeof body.label === 'string' ? body.label : null;
  if ('chartId' in body)
    update.chart_id = typeof body.chartId === 'string' ? body.chartId : null;
  if ('metadata' in body && typeof body.metadata === 'object' && body.metadata !== null) {
    update.metadata = JSON.stringify(body.metadata as Record<string, unknown>);
  }

  // Geometry — accept partial; re-validate the *resulting* rectangle
  // against the unit square. Lets a caller move + resize independently.
  const nextGeometry = {
    pageNumber:
      typeof body.pageNumber === 'number' ? body.pageNumber : existing.pageNumber,
    cropX: typeof body.cropX === 'number' ? body.cropX : existing.cropX,
    cropY: typeof body.cropY === 'number' ? body.cropY : existing.cropY,
    cropWidth:
      typeof body.cropWidth === 'number' ? body.cropWidth : existing.cropWidth,
    cropHeight:
      typeof body.cropHeight === 'number' ? body.cropHeight : existing.cropHeight,
  };
  const geometryChanged =
    'pageNumber' in body ||
    'cropX' in body ||
    'cropY' in body ||
    'cropWidth' in body ||
    'cropHeight' in body;
  if (geometryChanged) {
    // Mirror the service-layer validation; same ValidationError contract.
    const { pageNumber, cropX, cropY, cropWidth, cropHeight } = nextGeometry;
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new ValidationError('pageNumber must be a positive integer');
    }
    if (!(cropX >= 0 && cropX <= 1 && cropY >= 0 && cropY <= 1)) {
      throw new ValidationError('crop coordinates must be in [0, 1]');
    }
    if (!(cropWidth > 0 && cropWidth <= 1) || !(cropHeight > 0 && cropHeight <= 1)) {
      throw new ValidationError('crop width/height must be in (0, 1]');
    }
    if (cropX + cropWidth > 1 + 1e-9 || cropY + cropHeight > 1 + 1e-9) {
      throw new ValidationError('crop rectangle must stay inside the unit square');
    }
    update.page_number = pageNumber;
    update.crop_x = cropX;
    update.crop_y = cropY;
    update.crop_width = cropWidth;
    update.crop_height = cropHeight;
  }

  await db('pattern_crops').where({ id: cropId, user_id: userId }).update(update);
  const refreshed = await getCropById(cropId, userId);
  res.json({ success: true, data: { crop: refreshed } });
}

// DELETE /api/source-files/:fileId/crops/:cropId
export async function deleteSourceFileCrop(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const ok = await softDeleteCrop(req.params.cropId, userId);
  if (!ok) throw new NotFoundError('Crop not found');
  res.json({ success: true, message: 'Crop deleted' });
}

// PATCH /api/projects/:projectId/patterns/:patternId/source-file
export async function pinSourceFile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { projectId, patternId } = req.params;
  const body = req.body as Record<string, unknown>;
  const sourceFileId =
    body.sourceFileId === null
      ? null
      : typeof body.sourceFileId === 'string'
        ? body.sourceFileId
        : undefined;
  if (sourceFileId === undefined) {
    throw new ValidationError('sourceFileId must be a string or null');
  }
  const ok = await pinSourceFileToProjectPattern({
    projectId,
    patternId,
    sourceFileId,
    userId,
  });
  if (!ok) throw new NotFoundError('Project pattern not found');
  res.json({ success: true, data: { projectId, patternId, sourceFileId } });
}
