import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';

export async function getRecipients(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { search, page = 1, limit = 20 } = req.query;

  let query = db('recipients')
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (search) {
    query = query.where((builder) => {
      builder
        .where('first_name', 'ilike', `%${search}%`)
        .orWhere('last_name', 'ilike', `%${search}%`)
        .orWhere('relationship', 'ilike', `%${search}%`);
    });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const [{ count }] = await query.clone().count('* as count');
  const recipients = await query
    .orderBy('first_name', 'asc')
    .limit(Number(limit))
    .offset(offset);

  res.json({
    success: true,
    data: {
      recipients,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(count),
        totalPages: Math.ceil(Number(count) / Number(limit)),
      },
    },
  });
}

export async function getRecipient(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const recipient = await db('recipients')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!recipient) {
    throw new NotFoundError('Recipient not found');
  }

  const gifts = await db('gifts')
    .where({ recipient_id: id })
    .orderBy('date_given', 'desc');

  res.json({
    success: true,
    data: {
      recipient: {
        ...recipient,
        gifts,
      },
    },
  });
}

export async function createRecipient(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const {
    firstName,
    lastName,
    relationship,
    birthday,
    measurements,
    preferences,
    clothingSize,
    shoeSize,
    notes,
  } = req.body;

  if (!firstName) {
    throw new ValidationError('First name is required');
  }

  const [recipient] = await db('recipients')
    .insert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      relationship,
      birthday,
      measurements: measurements ? JSON.stringify(measurements) : '{}',
      preferences: preferences ? JSON.stringify(preferences) : '{}',
      clothing_size: clothingSize,
      shoe_size: shoeSize,
      notes,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'recipient_created',
    entityType: 'recipient',
    entityId: recipient.id,
    newValues: recipient,
  });

  res.status(201).json({
    success: true,
    message: 'Recipient created successfully',
    data: { recipient },
  });
}

export async function updateRecipient(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;
  const updates = req.body;

  const recipient = await db('recipients')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!recipient) {
    throw new NotFoundError('Recipient not found');
  }

  const [updatedRecipient] = await db('recipients')
    .where({ id })
    .update({
      ...updates,
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'recipient_updated',
    entityType: 'recipient',
    entityId: id,
    oldValues: recipient,
    newValues: updatedRecipient,
  });

  res.json({
    success: true,
    message: 'Recipient updated successfully',
    data: { recipient: updatedRecipient },
  });
}

export async function deleteRecipient(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const recipient = await db('recipients')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!recipient) {
    throw new NotFoundError('Recipient not found');
  }

  await db('recipients')
    .where({ id })
    .update({
      deleted_at: new Date(),
      updated_at: new Date(),
    });

  await createAuditLog(req, {
    userId,
    action: 'recipient_deleted',
    entityType: 'recipient',
    entityId: id,
    oldValues: recipient,
  });

  res.json({
    success: true,
    message: 'Recipient deleted successfully',
  });
}

export async function getRecipientStats(req: Request, res: Response) {
  const userId = (req as any).user.userId;

  const stats = await db('recipients')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      db.raw('COUNT(*) as total_count')
    )
    .first();

  res.json({
    success: true,
    data: { stats },
  });
}
