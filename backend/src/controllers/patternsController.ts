import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import logger from '../config/logger';
import { PDFDocument, rgb } from 'pdf-lib';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { pickFields, ALLOWED_FIELDS, sanitizeSearchQuery } from '../utils/inputSanitizer';

/**
 * Serialize pattern JSONB fields to strings for frontend compatibility
 */
function serializePattern(pattern: any) {
  return {
    ...pattern,
    yarn_requirements: pattern.yarn_requirements ? JSON.stringify(pattern.yarn_requirements) : null,
    gauge: pattern.gauge ? JSON.stringify(pattern.gauge) : null,
    needle_sizes: pattern.needle_sizes ? JSON.stringify(pattern.needle_sizes) : null,
    sizes_available: pattern.sizes_available ? JSON.stringify(pattern.sizes_available) : null,
    tags: pattern.tags ? JSON.stringify(pattern.tags) : null,
  };
}

/**
 * Get all patterns for current user
 */
export async function getPatterns(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { category, difficulty, search, page = 1, limit = 20 } = req.query;

  let query = db('patterns')
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (category) {
    query = query.where({ category });
  }

  if (difficulty) {
    query = query.where({ difficulty });
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
  const userId = (req as any).user.userId;
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

  // Serialize JSONB fields to strings for frontend
  const serializedPattern = serializePattern(pattern);

  res.json({
    success: true,
    data: {
      pattern: {
        ...serializedPattern,
        projects,
      },
    },
  });
}

/**
 * Get charts associated with a pattern (direct link or via related projects)
 */
export async function getPatternCharts(req: Request, res: Response) {
  const userId = (req as any).user.userId;
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
  const userId = (req as any).user.userId;
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
      difficulty,
      category,
      yarn_requirements: yarnRequirements ? JSON.stringify(yarnRequirements) : '[]',
      needle_sizes: needleSizes ? JSON.stringify(needleSizes) : '[]',
      gauge: gauge ? JSON.stringify(gauge) : null,
      sizes_available: sizesAvailable ? JSON.stringify(sizesAvailable) : '[]',
      estimated_yardage: estimatedYardage,
      notes,
      tags: tags ? JSON.stringify(tags) : '[]',
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

  res.status(201).json({
    success: true,
    message: 'Pattern created successfully',
    data: { pattern },
  });
}

/**
 * Update pattern
 */
export async function updatePattern(req: Request, res: Response) {
  const userId = (req as any).user.userId;
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
  } = req.body;

  const updateData: any = {
    updated_at: new Date(),
  };

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (designer !== undefined) updateData.designer = designer;
  if (source !== undefined) updateData.source = source;
  if (sourceUrl !== undefined) updateData.source_url = sourceUrl;
  if (difficulty !== undefined) updateData.difficulty = difficulty;
  if (category !== undefined) updateData.category = category;
  if (yarnRequirements !== undefined) updateData.yarn_requirements = JSON.stringify(yarnRequirements);
  if (needleSizes !== undefined) updateData.needle_sizes = JSON.stringify(needleSizes);
  if (gauge !== undefined) updateData.gauge = gauge ? JSON.stringify(gauge) : null;
  if (sizesAvailable !== undefined) updateData.sizes_available = JSON.stringify(sizesAvailable);
  if (estimatedYardage !== undefined) updateData.estimated_yardage = estimatedYardage;
  if (notes !== undefined) updateData.notes = notes;
  if (tags !== undefined) updateData.tags = JSON.stringify(tags);
  if (isFavorite !== undefined) updateData.is_favorite = isFavorite;

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
  const userId = (req as any).user.userId;
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
  const userId = (req as any).user.userId;

  const stats = await db('patterns')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      db.raw('COUNT(*) as total_count'),
      db.raw("COUNT(*) FILTER (WHERE is_favorite = true) as favorite_count"),
      db.raw("COUNT(*) FILTER (WHERE difficulty = 'beginner') as beginner_count"),
      db.raw("COUNT(*) FILTER (WHERE difficulty = 'intermediate') as intermediate_count"),
      db.raw("COUNT(*) FILTER (WHERE difficulty = 'advanced') as advanced_count")
    )
    .first();

  res.json({
    success: true,
    data: { stats },
  });
}

/**
 * Collate multiple patterns into a single PDF
 */
export async function collatePatterns(req: Request, res: Response) {
  const userId = (req as any).user.userId;
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
        // Remote file
        const response = await axios.get(pdfFile.file_path, {
          responseType: 'arraybuffer',
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

    const timestamp = Date.now();
    const filename = `collated-${timestamp}.pdf`;
    const filePath = path.join(collatedDir, filename);

    fs.writeFileSync(filePath, pdfBytes);

    // Store collation record in database
    const [collation] = await db('pattern_collations')
      .insert({
        user_id: userId,
        pattern_ids: JSON.stringify(patternIds),
        file_path: `collated/${filename}`,
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
          fileUrl: `/uploads/collated/${filename}`,
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
