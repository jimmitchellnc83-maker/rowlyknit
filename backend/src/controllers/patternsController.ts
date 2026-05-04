import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import logger from '../config/logger';
import { PDFDocument, rgb } from 'pdf-lib';
import { safeAxios } from '../utils/safeFetch';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { streamSafeUpload } from '../utils/uploadStorage';
import { sanitizeSearchQuery } from '../utils/inputSanitizer';
import { intOrNull } from '../utils/numericInput';
import { assertPublicUrl } from '../utils/ssrfGuard';
import { getFeasibility } from '../services/feasibilityService';
import { calculatePatternComplexity } from '../services/patternComplexityService';
import { countMakersForPattern } from '../services/ratingsService';
import { normalizeSkillLevel } from '../types/skillLevel';

/**
 * Serialize pattern fields for frontend.
 * After migration 37, needle_sizes/gauge/sizes_available/yarn_requirements are TEXT.
 * Only tags is still JSONB.
 */
function serializePattern(pattern: any) {
  return {
    ...pattern,
    tags: pattern.tags ? (typeof pattern.tags === 'string' ? pattern.tags : JSON.stringify(pattern.tags)) : null,
  };
}

/**
 * Coerce structured Ravelry data into a clean display string.
 * Handles every object shape we know about:
 *  - {name}                                           → "name"
 *  - {yarnName, yarnCompany, quantity}                → "yarnName — yarnCompany — quantity"
 *  - {fiber, weight, yardage}                         → "worsted wool, 400 yds"
 *  - {stitches, rows, unit}                           → "20 sts × 28 rows over 4 inches"
 *  - arrays of any of the above (joined with ", ")
 */
function objectToString(x: any): string | null {
  if (x == null) return null;
  if (typeof x === 'string') return x.trim() || null;
  if (typeof x === 'number') return String(x);
  if (typeof x !== 'object') return null;

  // Named entity (needles, sizes, simple things)
  if (x.name) return String(x.name);

  // Ravelry yarn pack
  if (x.yarnName || x.yarnCompany) {
    return [x.yarnName, x.yarnCompany, x.quantity]
      .filter((v) => v != null && v !== '')
      .join(' — ') || null;
  }

  // Yarn requirement (fiber/weight/yardage)
  if (x.fiber || x.weight || x.yardage) {
    const yardage = x.yardage ? `${x.yardage} yds` : null;
    const composition = [x.weight, x.fiber].filter(Boolean).join(' ');
    return [composition, yardage].filter(Boolean).join(', ') || null;
  }

  // Gauge (stitches/rows/unit)
  if (x.stitches || x.rows) {
    const parts: string[] = [];
    if (x.stitches) parts.push(`${x.stitches} sts`);
    if (x.rows) parts.push(`${x.rows} rows`);
    let result = parts.join(' × ');
    if (x.unit) result += ` over ${x.unit}`;
    return result || null;
  }

  return null;
}

function toDisplayString(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string') return val.trim() || null;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return null;
    const parts = val.map(objectToString).filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof val === 'object') {
    return objectToString(val);
  }
  return null;
}

/**
 * Get all patterns for current user
 */
export async function getPatterns(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { category, difficulty, search, favorite, page = 1, limit = 20 } = req.query;

  let query = db('patterns')
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (category) {
    query = query.where({ category });
  }

  if (difficulty) {
    query = query.where({ difficulty });
  }

  if (favorite === 'true') {
    query = query.where({ is_favorite: true });
  }

  if (search) {
    const sanitizedSearch = sanitizeSearchQuery(search as string);
    query = query.where((builder) => {
      builder
        .where('name', 'ilike', `%${sanitizedSearch}%`)
        .orWhere('description', 'ilike', `%${sanitizedSearch}%`)
        .orWhere('designer', 'ilike', `%${sanitizedSearch}%`);
    });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const [{ count }] = await query.clone().count('* as count');
  const patterns = await query
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .offset(offset);

  // Serialize JSONB fields to strings for frontend
  const serializedPatterns = patterns.map(serializePattern);

  res.json({
    success: true,
    data: {
      patterns: serializedPatterns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(count),
        totalPages: Math.ceil(Number(count) / Number(limit)),
      },
    },
  });
}

/**
 * Get single pattern by ID
 */
export async function getPattern(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const pattern = await db('patterns')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // Get projects using this pattern
  const projects = await db('project_patterns as pp')
    .join('projects as p', 'pp.project_id', 'p.id')
    .where({ 'pp.pattern_id': id, 'p.user_id': userId })
    .whereNull('p.deleted_at')
    .select('p.*', 'pp.modifications');

  // Look up the canonical pattern_models twin (if one exists). PatternDetail
  // uses this id to render an "Open in Make Mode" entry button — only when
  // both this column is non-null AND the frontend Make Mode flag is on.
  // Designer-saved patterns get a twin via maybeMaterializeCanonicalTwin();
  // legacy-only PDFs / Ravelry imports won't have one, and the entry button
  // stays hidden for them.
  const twin = await db('pattern_models')
    .where({ source_pattern_id: id, user_id: userId })
    .whereNull('deleted_at')
    .select('id')
    .first();
  const canonicalPatternModelId: string | null = twin?.id ?? null;

  // Serialize JSONB fields to strings for frontend
  const serializedPattern = serializePattern(pattern);

  const complexity = calculatePatternComplexity({
    notes: serializedPattern.notes,
    sizes_available: serializedPattern.sizes_available,
    gauge: serializedPattern.gauge,
  });
  const madeCount = await countMakersForPattern(db, id, userId);

  res.json({
    success: true,
    data: {
      pattern: {
        ...serializedPattern,
        projects,
        complexity,
        madeCount,
        canonicalPatternModelId,
      },
    },
  });
}

/**
 * Get charts associated with a pattern (direct link or via related projects)
 */
export async function getPatternCharts(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: patternId } = req.params;

  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  const relatedProjects = await db('project_patterns')
    .where({ pattern_id: patternId })
    .pluck('project_id');

  const charts = await db('charts as c')
    .leftJoin('projects as p', 'c.project_id', 'p.id')
    .where('c.user_id', userId)
    .andWhere((builder) => {
      builder.where('c.pattern_id', patternId);

      if (relatedProjects.length > 0) {
        builder.orWhereIn('c.project_id', relatedProjects);
      }
    })
    .select('c.*', db.raw('p.name as project_name'))
    .orderBy('c.updated_at', 'desc');

  res.json({
    success: true,
    data: { charts },
  });
}

/**
 * Create new pattern
 */
export async function createPattern(req: Request, res: Response) {
  const userId = req.user!.userId;
  const {
    name,
    description,
    designer,
    source,
    sourceUrl,
    difficulty,
    category,
    yarnRequirements,
    needleSizes,
    gauge,
    sizesAvailable,
    estimatedYardage,
    notes,
    tags,
    metadata,
  } = req.body;

  if (!name) {
    throw new ValidationError('Pattern name is required');
  }

  const [pattern] = await db('patterns')
    .insert({
      user_id: userId,
      name,
      description,
      designer,
      source,
      source_url: sourceUrl,
      difficulty: normalizeSkillLevel(difficulty),
      category,
      yarn_requirements: toDisplayString(yarnRequirements),
      needle_sizes: toDisplayString(needleSizes),
      gauge: toDisplayString(gauge),
      sizes_available: toDisplayString(sizesAvailable),
      estimated_yardage: intOrNull(estimatedYardage),
      notes,
      tags: tags ? JSON.stringify(tags) : '[]',
      metadata: metadata ? JSON.stringify(metadata) : '{}',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'pattern_created',
    entityType: 'pattern',
    entityId: pattern.id,
    newValues: pattern,
  });

  // Materialize a canonical pattern_models twin when the user saved
  // through the Designer (metadata.designer holds the form snapshot).
  // Best-effort — the legacy save is the user's primary success path;
  // a canonical write failure logs a warning and the response still
  // reports success.
  await maybeMaterializeCanonicalTwin(userId, pattern.id, metadata);

  res.status(201).json({
    success: true,
    message: 'Pattern created successfully',
    data: { pattern },
  });
}

/**
 * If the legacy pattern carries a Designer snapshot under
 * `metadata.designer`, run it through the canonical importer so
 * `/patterns/:id/author` and `/patterns/:id/make` reflect the latest
 * design. Idempotent via `source_pattern_id`: re-imports update the
 * existing twin instead of inserting a duplicate, and never clobber
 * `progress_state` on a re-run.
 */
async function maybeMaterializeCanonicalTwin(
  userId: string,
  legacyPatternId: string,
  metadata: unknown,
): Promise<void> {
  if (!metadata || typeof metadata !== 'object') return;
  const designer = (metadata as Record<string, unknown>).designer;
  if (!designer || typeof designer !== 'object') return;
  try {
    const { importDesignerSnapshot } = await import('../services/patternService');
    await importDesignerSnapshot({
      userId,
      sourcePatternId: legacyPatternId,
      snapshot: designer as Record<string, unknown>,
    });
  } catch (err) {
    logger.warn('Canonical twin materialization failed for legacy pattern', {
      userId,
      legacyPatternId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Update pattern
 */
export async function updatePattern(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const pattern = await db('patterns')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // Whitelist allowed fields to prevent mass assignment
  const {
    name,
    description,
    designer,
    source,
    sourceUrl,
    difficulty,
    category,
    yarnRequirements,
    needleSizes,
    gauge,
    sizesAvailable,
    estimatedYardage,
    notes,
    tags,
    isFavorite,
    metadata,
  } = req.body;

  const updateData: any = {
    updated_at: new Date(),
  };

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (designer !== undefined) updateData.designer = designer;
  if (source !== undefined) updateData.source = source;
  if (sourceUrl !== undefined) updateData.source_url = sourceUrl;
  if (difficulty !== undefined) updateData.difficulty = normalizeSkillLevel(difficulty);
  if (category !== undefined) updateData.category = category;
  if (yarnRequirements !== undefined) updateData.yarn_requirements = toDisplayString(yarnRequirements);
  if (needleSizes !== undefined) updateData.needle_sizes = toDisplayString(needleSizes);
  if (gauge !== undefined) updateData.gauge = toDisplayString(gauge);
  if (sizesAvailable !== undefined) updateData.sizes_available = toDisplayString(sizesAvailable);
  if (estimatedYardage !== undefined) updateData.estimated_yardage = intOrNull(estimatedYardage);
  if (notes !== undefined) updateData.notes = notes;
  if (tags !== undefined) updateData.tags = JSON.stringify(tags);
  if (isFavorite !== undefined) updateData.is_favorite = isFavorite;
  if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);

  const [updatedPattern] = await db('patterns')
    .where({ id })
    .update(updateData)
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'pattern_updated',
    entityType: 'pattern',
    entityId: id,
    oldValues: pattern,
    newValues: updatedPattern,
  });

  // Re-materialize the canonical twin when the Designer snapshot was
  // touched on this update. The importer is idempotent so this just
  // refreshes the canonical row's design fields.
  if (metadata !== undefined) {
    await maybeMaterializeCanonicalTwin(userId, id, metadata);
  }

  res.json({
    success: true,
    message: 'Pattern updated successfully',
    data: { pattern: updatedPattern },
  });
}

/**
 * Delete pattern (soft delete)
 */
export async function deletePattern(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const pattern = await db('patterns')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  await db('patterns')
    .where({ id })
    .update({
      deleted_at: new Date(),
      updated_at: new Date(),
    });

  await createAuditLog(req, {
    userId,
    action: 'pattern_deleted',
    entityType: 'pattern',
    entityId: id,
    oldValues: pattern,
  });

  res.json({
    success: true,
    message: 'Pattern deleted successfully',
  });
}

/**
 * Get pattern statistics
 */
export async function getPatternStats(req: Request, res: Response) {
  const userId = req.user!.userId;

  const stats = await db('patterns')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      db.raw('COUNT(*) as total_count'),
      db.raw("COUNT(*) FILTER (WHERE is_favorite = true) as favorite_count"),
      db.raw("COUNT(*) FILTER (WHERE difficulty = 'basic') as basic_count"),
      db.raw("COUNT(*) FILTER (WHERE difficulty = 'easy') as easy_count"),
      db.raw("COUNT(*) FILTER (WHERE difficulty = 'intermediate') as intermediate_count"),
      db.raw("COUNT(*) FILTER (WHERE difficulty = 'complex') as complex_count")
    )
    .first();

  res.json({
    success: true,
    data: { stats },
  });
}

/**
 * Get a feasibility report for a pattern against the user's stash + tools.
 * Returns traffic-light verdicts per requirement and an aggregate shopping
 * list for missing items.
 */
export async function getPatternFeasibility(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const report = await getFeasibility(userId, id);

  res.json({
    success: true,
    data: { feasibility: report },
  });
}

/**
 * Collate multiple patterns into a single PDF
 */
export async function collatePatterns(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { patternIds, addDividers = false, dividerText = 'Pattern' } = req.body;

  if (!patternIds || !Array.isArray(patternIds) || patternIds.length === 0) {
    throw new ValidationError('Pattern IDs are required');
  }

  // Verify all patterns belong to user and have PDF files
  const patterns = await db('patterns')
    .whereIn('id', patternIds)
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (patterns.length !== patternIds.length) {
    throw new NotFoundError('One or more patterns not found');
  }

  // Get PDF files for patterns
  const pdfFiles = await db('pattern_files')
    .whereIn('pattern_id', patternIds)
    .where({ file_type: 'pdf' });

  if (pdfFiles.length === 0) {
    throw new ValidationError('No PDF files found for the selected patterns');
  }

  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Process each pattern in the order specified
    for (let i = 0; i < patternIds.length; i++) {
      const patternId = patternIds[i];
      const pdfFile = pdfFiles.find((f) => f.pattern_id === patternId);

      if (!pdfFile) {
        logger.warn('No PDF file found for pattern, skipping', { patternId });
        continue;
      }

      // Load the PDF file
      let pdfBytes: Uint8Array;
      if (pdfFile.file_path.startsWith('http')) {
        // Pre-flight URL validation gives the user a clean 4xx if the
        // URL is obviously bad. The actual fetch then runs through
        // safeAxios, whose http(s) Agents re-validate the resolved IP
        // at connect time — closing the DNS-rebinding race.
        await assertPublicUrl(pdfFile.file_path);
        const response = await safeAxios.get(pdfFile.file_path, {
          responseType: 'arraybuffer',
          timeout: 15000,
          maxRedirects: 3,
        });
        pdfBytes = new Uint8Array(response.data);
      } else {
        // Local file
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
        const filePath = path.join(uploadDir, pdfFile.file_path);
        pdfBytes = new Uint8Array(fs.readFileSync(filePath));
      }

      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));

      // Add divider page if requested (except after the last pattern)
      if (addDividers && i < patternIds.length - 1) {
        const dividerPage = mergedPdf.addPage([612, 792]); // Standard letter size
        const pattern = patterns.find((p) => p.id === patternId);
        const text = `${dividerText}: ${pattern?.name || 'Unknown'}`;

        dividerPage.drawText(text, {
          x: 50,
          y: 400,
          size: 24,
          color: rgb(0, 0, 0),
        });
      }
    }

    // Save the merged PDF
    const pdfBytes = await mergedPdf.save();
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    const collatedDir = path.join(uploadDir, 'collated');

    // Create collated directory if it doesn't exist
    if (!fs.existsSync(collatedDir)) {
      fs.mkdirSync(collatedDir, { recursive: true });
    }

    const filename = `${crypto.randomBytes(16).toString('hex')}.pdf`;
    const filePath = path.join(collatedDir, filename);

    fs.writeFileSync(filePath, pdfBytes);

    // Store collation record in database. file_path is the on-disk
    // filename only — the URL exposed to the client routes through an
    // authenticated endpoint that re-checks ownership.
    const [collation] = await db('pattern_collations')
      .insert({
        user_id: userId,
        pattern_ids: JSON.stringify(patternIds),
        file_path: filename,
        file_size: pdfBytes.byteLength,
        page_count: mergedPdf.getPageCount(),
        created_at: new Date(),
      })
      .returning('*');

    await createAuditLog(req, {
      userId,
      action: 'patterns_collated',
      entityType: 'pattern_collation',
      entityId: collation.id,
      newValues: collation,
    });

    res.status(201).json({
      success: true,
      message: 'Patterns collated successfully',
      data: {
        collation: {
          id: collation.id,
          fileUrl: `/api/patterns/collations/${collation.id}/download`,
          pageCount: mergedPdf.getPageCount(),
          fileSize: pdfBytes.byteLength,
          patternCount: patternIds.length,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error collating PDFs', { error: error.message, stack: error.stack });
    throw new Error('Failed to collate PDF files');
  }
}

// Stream a previously-generated pattern-export PDF. Replaces the old
// `/uploads/exports/<userId>/<filename>` static URL. The userId in the
// path must match the requesting user; combined with the random hex
// filename, this means even a logged-in attacker can't enumerate
// another user's exports.
export async function downloadPatternExport(req: Request, res: Response) {
  const { userId: pathUserId, filename } = req.params;
  if (req.user?.userId !== pathUserId) {
    return res.status(404).json({ success: false, message: 'Export not found' });
  }
  await streamSafeUpload(res, {
    subdir: `exports/${pathUserId}`,
    filename,
    mimeType: 'application/pdf',
    disposition: 'attachment',
    downloadFilename: 'rowly-pattern.pdf',
  });
}

// Stream a previously-collated PDF. Replaces the old `/uploads/collated/...`
// static URL — the on-disk filename is a random hex token and the
// streamer enforces ownership.
export async function downloadPatternCollation(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { collationId } = req.params;

  const collation = await db('pattern_collations')
    .where({ id: collationId, user_id: userId })
    .first();

  if (!collation || !collation.file_path) {
    throw new NotFoundError('Collation not found');
  }

  await streamSafeUpload(res, {
    subdir: 'collated',
    filename: collation.file_path,
    mimeType: 'application/pdf',
    disposition: 'attachment',
    downloadFilename: 'rowly-collated.pdf',
  });
}
