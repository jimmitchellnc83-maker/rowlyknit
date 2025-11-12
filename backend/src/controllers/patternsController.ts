import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';

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
    query = query.where((builder) => {
      builder
        .where('name', 'ilike', `%${search}%`)
        .orWhere('description', 'ilike', `%${search}%`)
        .orWhere('designer', 'ilike', `%${search}%`);
    });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const [{ count }] = await query.clone().count('* as count');
  const patterns = await query
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .offset(offset);

  res.json({
    success: true,
    data: {
      patterns,
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

  res.json({
    success: true,
    data: {
      pattern: {
        ...pattern,
        projects,
      },
    },
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
  const updates = req.body;

  const pattern = await db('patterns')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  const [updatedPattern] = await db('patterns')
    .where({ id })
    .update({
      ...updates,
      updated_at: new Date(),
    })
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
