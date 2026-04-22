import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';

const ALLOWED_STATUS = ['not_started', 'in_progress', 'completed', 'blocked'] as const;
type PieceStatus = (typeof ALLOWED_STATUS)[number];

async function assertProjectOwned(projectId: string, userId: string) {
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();
  if (!project) {
    throw new NotFoundError('Project not found');
  }
}

export async function getPieces(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  await assertProjectOwned(projectId, userId);

  const pieces = await db('project_pieces')
    .where({ project_id: projectId })
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'asc');

  res.json({ success: true, data: { pieces } });
}

export async function getPiece(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, pieceId } = req.params;
  await assertProjectOwned(projectId, userId);

  const piece = await db('project_pieces')
    .where({ id: pieceId, project_id: projectId })
    .first();
  if (!piece) {
    throw new NotFoundError('Piece not found');
  }
  res.json({ success: true, data: { piece } });
}

export async function createPiece(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const { name, type, status, notes, sortOrder } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Piece name is required');
  }
  if (status && !ALLOWED_STATUS.includes(status as PieceStatus)) {
    throw new ValidationError(`status must be one of ${ALLOWED_STATUS.join(', ')}`);
  }
  await assertProjectOwned(projectId, userId);

  let finalSortOrder = sortOrder;
  if (finalSortOrder === undefined || finalSortOrder === null) {
    const result = await db('project_pieces')
      .where({ project_id: projectId })
      .max('sort_order as maxOrder')
      .first();
    finalSortOrder = ((result?.maxOrder as number | null) ?? -1) + 1;
  }

  const [piece] = await db('project_pieces')
    .insert({
      project_id: projectId,
      name: name.trim(),
      type: (type || 'other').trim(),
      status: status || 'not_started',
      notes: notes || null,
      sort_order: finalSortOrder,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'piece_created',
    entityType: 'project_piece',
    entityId: piece.id,
    newValues: piece,
  });

  res.status(201).json({ success: true, data: { piece } });
}

export async function updatePiece(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, pieceId } = req.params;
  const { name, type, status, notes } = req.body;

  if (status && !ALLOWED_STATUS.includes(status as PieceStatus)) {
    throw new ValidationError(`status must be one of ${ALLOWED_STATUS.join(', ')}`);
  }
  await assertProjectOwned(projectId, userId);

  const existing = await db('project_pieces')
    .where({ id: pieceId, project_id: projectId })
    .first();
  if (!existing) {
    throw new NotFoundError('Piece not found');
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('Piece name cannot be empty');
    }
    updates.name = name.trim();
  }
  if (type !== undefined) updates.type = (type || 'other').toString().trim();
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) {
    updates.status = status;
    if (status === 'in_progress' && !existing.started_at) {
      updates.started_at = new Date();
    }
    if (status === 'completed') {
      updates.completed_at = new Date();
      if (!existing.started_at) updates.started_at = new Date();
    }
    if (status !== 'completed' && existing.completed_at) {
      updates.completed_at = null;
    }
  }

  const [piece] = await db('project_pieces')
    .where({ id: pieceId, project_id: projectId })
    .update(updates)
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'piece_updated',
    entityType: 'project_piece',
    entityId: pieceId,
    oldValues: existing,
    newValues: piece,
  });

  res.json({ success: true, data: { piece } });
}

export async function deletePiece(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, pieceId } = req.params;
  await assertProjectOwned(projectId, userId);

  const existing = await db('project_pieces')
    .where({ id: pieceId, project_id: projectId })
    .first();
  if (!existing) {
    throw new NotFoundError('Piece not found');
  }

  await db('project_pieces').where({ id: pieceId, project_id: projectId }).del();

  await createAuditLog(req, {
    userId,
    action: 'piece_deleted',
    entityType: 'project_piece',
    entityId: pieceId,
    oldValues: existing,
  });

  res.json({ success: true });
}

export async function reorderPieces(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const { order } = req.body;

  if (!Array.isArray(order) || order.length === 0) {
    throw new ValidationError('order must be a non-empty array of piece IDs');
  }
  await assertProjectOwned(projectId, userId);

  await db.transaction(async (trx) => {
    for (let i = 0; i < order.length; i++) {
      const pieceId = order[i];
      await trx('project_pieces')
        .where({ id: pieceId, project_id: projectId })
        .update({ sort_order: i, updated_at: new Date() });
    }
  });

  const pieces = await db('project_pieces')
    .where({ project_id: projectId })
    .orderBy('sort_order', 'asc');

  res.json({ success: true, data: { pieces } });
}
