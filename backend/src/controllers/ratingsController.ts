import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';

/**
 * Get the current user's rating for a project (or null).
 */
export async function getProjectRating(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const rating = await db('project_ratings')
    .where({ project_id: projectId, user_id: userId })
    .first();

  res.json({
    success: true,
    data: { rating: rating ?? null },
  });
}

/**
 * Upsert the current user's rating for a project.
 *
 * Single endpoint for create + update because the unique constraint
 * (user_id, project_id) enforces at-most-one; a PUT-with-idempotency
 * semantic is cleaner than maintaining separate POST/PATCH.
 */
export async function upsertProjectRating(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const { rating, notes, isPublic } = req.body;

  if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new ValidationError('rating must be an integer between 1 and 5');
  }

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const existing = await db('project_ratings')
    .where({ project_id: projectId, user_id: userId })
    .first();

  const row = {
    user_id: userId,
    project_id: projectId,
    rating,
    notes: notes ?? null,
    is_public: isPublic === true,
    updated_at: new Date(),
  };

  let saved;
  if (existing) {
    [saved] = await db('project_ratings')
      .where({ id: existing.id })
      .update(row)
      .returning('*');
  } else {
    [saved] = await db('project_ratings')
      .insert({ ...row, created_at: new Date() })
      .returning('*');
  }

  await createAuditLog(req, {
    userId,
    action: existing ? 'project_rating_updated' : 'project_rating_created',
    entityType: 'project_rating',
    entityId: saved.id,
    oldValues: existing,
    newValues: saved,
  });

  res.json({
    success: true,
    data: { rating: saved },
  });
}

/**
 * Delete the current user's rating for a project.
 */
export async function deleteProjectRating(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;

  const existing = await db('project_ratings')
    .where({ project_id: projectId, user_id: userId })
    .first();

  if (!existing) {
    throw new NotFoundError('Rating not found');
  }

  await db('project_ratings').where({ id: existing.id }).delete();

  await createAuditLog(req, {
    userId,
    action: 'project_rating_deleted',
    entityType: 'project_rating',
    entityId: existing.id,
    oldValues: existing,
  });

  res.json({
    success: true,
    data: { deleted: true },
  });
}
