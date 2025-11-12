import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';

/**
 * Get all projects for current user
 */
export async function getProjects(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { status, search, page = 1, limit = 20 } = req.query;

  let query = db('projects')
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (status) {
    query = query.where({ status });
  }

  if (search) {
    query = query.where((builder) => {
      builder
        .where('name', 'ilike', `%${search}%`)
        .orWhere('description', 'ilike', `%${search}%`);
    });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const [{ count }] = await query.clone().count('* as count');
  const projects = await query
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .offset(offset);

  res.json({
    success: true,
    data: {
      projects,
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
 * Get single project by ID
 */
export async function getProject(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const project = await db('projects')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get related data
  const [photos, counters, patterns, yarn, tools] = await Promise.all([
    db('project_photos').where({ project_id: id }).orderBy('sort_order'),
    db('counters').where({ project_id: id }).orderBy('sort_order'),
    db('project_patterns as pp')
      .join('patterns as p', 'pp.pattern_id', 'p.id')
      .where({ 'pp.project_id': id })
      .select('p.*', 'pp.modifications'),
    db('project_yarn as py')
      .join('yarn as y', 'py.yarn_id', 'y.id')
      .where({ 'py.project_id': id })
      .select('y.*', 'py.yards_used', 'py.skeins_used'),
    db('project_tools as pt')
      .join('tools as t', 'pt.tool_id', 't.id')
      .where({ 'pt.project_id': id })
      .select('t.*'),
  ]);

  res.json({
    success: true,
    data: {
      project: {
        ...project,
        photos,
        counters,
        patterns,
        yarn,
        tools,
      },
    },
  });
}

/**
 * Create new project
 */
export async function createProject(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const {
    name,
    description,
    projectType,
    startDate,
    targetCompletionDate,
    notes,
    metadata,
    tags,
  } = req.body;

  if (!name) {
    throw new ValidationError('Project name is required');
  }

  const [project] = await db('projects')
    .insert({
      user_id: userId,
      name,
      description,
      project_type: projectType,
      start_date: startDate,
      target_completion_date: targetCompletionDate,
      notes,
      metadata: metadata ? JSON.stringify(metadata) : '{}',
      tags: tags ? JSON.stringify(tags) : '[]',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'project_created',
    entityType: 'project',
    entityId: project.id,
    newValues: project,
  });

  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: { project },
  });
}

/**
 * Update project
 */
export async function updateProject(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;
  const updates = req.body;

  const project = await db('projects')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const [updatedProject] = await db('projects')
    .where({ id })
    .update({
      ...updates,
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'project_updated',
    entityType: 'project',
    entityId: id,
    oldValues: project,
    newValues: updatedProject,
  });

  res.json({
    success: true,
    message: 'Project updated successfully',
    data: { project: updatedProject },
  });
}

/**
 * Delete project (soft delete)
 */
export async function deleteProject(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const project = await db('projects')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  await db('projects')
    .where({ id })
    .update({
      deleted_at: new Date(),
      updated_at: new Date(),
    });

  await createAuditLog(req, {
    userId,
    action: 'project_deleted',
    entityType: 'project',
    entityId: id,
    oldValues: project,
  });

  res.json({
    success: true,
    message: 'Project deleted successfully',
  });
}

/**
 * Get project statistics
 */
export async function getProjectStats(req: Request, res: Response) {
  const userId = (req as any).user.userId;

  const stats = await db('projects')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      db.raw("COUNT(*) FILTER (WHERE status = 'active') as active_count"),
      db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed_count"),
      db.raw("COUNT(*) FILTER (WHERE status = 'paused') as paused_count"),
      db.raw('COUNT(*) as total_count')
    )
    .first();

  res.json({
    success: true,
    data: { stats },
  });
}
