import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import { ALLOWED_FIELDS } from '../utils/inputSanitizer';

export async function getYarn(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { weight, brand, search, page = 1, limit = 20 } = req.query;

  let query = db('yarn')
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (weight) {
    query = query.where({ weight });
  }

  if (brand) {
    query = query.where({ brand });
  }

  if (search) {
    query = query.where((builder) => {
      builder
        .where('name', 'ilike', `%${search}%`)
        .orWhere('brand', 'ilike', `%${search}%`)
        .orWhere('color', 'ilike', `%${search}%`);
    });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const [{ count }] = await query.clone().count('* as count');
  const yarn = await query
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .offset(offset);

  res.json({
    success: true,
    data: {
      yarn,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(count),
        totalPages: Math.ceil(Number(count) / Number(limit)),
      },
    },
  });
}

export async function getYarnById(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const yarn = await db('yarn')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!yarn) {
    throw new NotFoundError('Yarn not found');
  }

  res.json({
    success: true,
    data: { yarn },
  });
}

export async function createYarn(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const {
    brand,
    line,
    name,
    color,
    colorCode,
    weight,
    fiberContent,
    yardsTotal,
    gramsTotal,
    skeinsTotal,
    pricePerSkein,
    purchaseDate,
    purchaseLocation,
    dyeLot,
    notes,
    tags,
  } = req.body;

  if (!name) {
    throw new ValidationError('Yarn name is required');
  }

  const [yarn] = await db('yarn')
    .insert({
      user_id: userId,
      brand,
      line,
      name,
      color,
      color_code: colorCode,
      weight,
      fiber_content: fiberContent,
      yards_total: yardsTotal,
      yards_remaining: yardsTotal,
      grams_total: gramsTotal,
      grams_remaining: gramsTotal,
      skeins_total: skeinsTotal || 1,
      skeins_remaining: skeinsTotal || 1,
      price_per_skein: pricePerSkein,
      purchase_date: purchaseDate,
      purchase_location: purchaseLocation,
      dye_lot: dyeLot,
      notes,
      tags: tags ? JSON.stringify(tags) : '[]',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'yarn_created',
    entityType: 'yarn',
    entityId: yarn.id,
    newValues: yarn,
  });

  res.status(201).json({
    success: true,
    message: 'Yarn created successfully',
    data: { yarn },
  });
}

export async function updateYarn(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const yarn = await db('yarn')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!yarn) {
    throw new NotFoundError('Yarn not found');
  }

  // Whitelist allowed fields to prevent mass assignment
  const {
    brand,
    name,
    weight,
    fiber,
    colorName,
    colorCode,
    yardage,
    gramsPerSkein,
    purchaseDate,
    purchaseLocation,
    purchasePrice,
    quantity,
    notes,
  } = req.body;

  const updateData: any = {
    updated_at: new Date(),
  };

  if (brand !== undefined) updateData.brand = brand;
  if (name !== undefined) updateData.name = name;
  if (weight !== undefined) updateData.weight = weight;
  if (fiber !== undefined) updateData.fiber_content = fiber;
  if (colorName !== undefined) updateData.color = colorName;
  if (colorCode !== undefined) updateData.color_code = colorCode;
  if (yardage !== undefined) {
    updateData.yards_total = yardage;
    updateData.yards_remaining = yardage;
  }
  if (gramsPerSkein !== undefined) {
    updateData.grams_total = gramsPerSkein;
    updateData.grams_remaining = gramsPerSkein;
  }
  if (purchaseDate !== undefined) updateData.purchase_date = purchaseDate;
  if (purchaseLocation !== undefined) updateData.purchase_location = purchaseLocation;
  if (purchasePrice !== undefined) updateData.price_per_skein = purchasePrice;
  if (quantity !== undefined) {
    updateData.skeins_total = quantity;
    updateData.skeins_remaining = quantity;
  }
  if (notes !== undefined) updateData.notes = notes;

  const [updatedYarn] = await db('yarn')
    .where({ id })
    .update(updateData)
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'yarn_updated',
    entityType: 'yarn',
    entityId: id,
    oldValues: yarn,
    newValues: updatedYarn,
  });

  res.json({
    success: true,
    message: 'Yarn updated successfully',
    data: { yarn: updatedYarn },
  });
}

export async function deleteYarn(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const yarn = await db('yarn')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!yarn) {
    throw new NotFoundError('Yarn not found');
  }

  await db('yarn')
    .where({ id })
    .update({
      deleted_at: new Date(),
      updated_at: new Date(),
    });

  await createAuditLog(req, {
    userId,
    action: 'yarn_deleted',
    entityType: 'yarn',
    entityId: id,
    oldValues: yarn,
  });

  res.json({
    success: true,
    message: 'Yarn deleted successfully',
  });
}

export async function getYarnStats(req: Request, res: Response) {
  const userId = (req as any).user.userId;

  const stats = await db('yarn')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      db.raw('COUNT(*) as total_count'),
      db.raw('SUM(skeins_remaining) as total_skeins'),
      db.raw('SUM(yards_remaining) as total_yards')
    )
    .first();

  res.json({
    success: true,
    data: { stats },
  });
}
