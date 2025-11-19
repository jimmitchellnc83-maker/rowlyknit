import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import { ALLOWED_FIELDS, sanitizeSearchQuery } from '../utils/inputSanitizer';

export async function getTools(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { type, search, page = 1, limit = 20 } = req.query;

  let query = db('tools')
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (type) {
    query = query.where({ type });
  }

  if (search) {
    const sanitizedSearch = sanitizeSearchQuery(search as string);
    query = query.where((builder) => {
      builder
        .where('name', 'ilike', `%${sanitizedSearch}%`)
        .orWhere('brand', 'ilike', `%${sanitizedSearch}%`);
    });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const [{ count }] = await query.clone().count('* as count');
  const tools = await query
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .offset(offset);

  res.json({
    success: true,
    data: {
      tools,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(count),
        totalPages: Math.ceil(Number(count) / Number(limit)),
      },
    },
  });
}

export async function getTool(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const tool = await db('tools')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!tool) {
    throw new NotFoundError('Tool not found');
  }

  res.json({
    success: true,
    data: { tool },
  });
}

export async function createTool(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const {
    type,
    name,
    size,
    sizeMm,
    material,
    length,
    brand,
    quantity,
    notes,
    purchaseDate,
    purchasePrice,
  } = req.body;

  if (!name || !type) {
    throw new ValidationError('Tool name and type are required');
  }

  const [tool] = await db('tools')
    .insert({
      user_id: userId,
      type,
      name,
      size,
      size_mm: sizeMm,
      material,
      length,
      brand,
      quantity: quantity || 1,
      notes,
      purchase_date: purchaseDate,
      purchase_price: purchasePrice,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'tool_created',
    entityType: 'tool',
    entityId: tool.id,
    newValues: tool,
  });

  res.status(201).json({
    success: true,
    message: 'Tool created successfully',
    data: { tool },
  });
}

export async function updateTool(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const tool = await db('tools')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!tool) {
    throw new NotFoundError('Tool not found');
  }

  // Whitelist allowed fields to prevent mass assignment
  const {
    name,
    type,
    size,
    material,
    brand,
    purchaseDate,
    purchaseLocation,
    purchasePrice,
    notes,
  } = req.body;

  const updateData: any = {
    updated_at: new Date(),
  };

  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (size !== undefined) updateData.size = size;
  if (material !== undefined) updateData.material = material;
  if (brand !== undefined) updateData.brand = brand;
  if (purchaseDate !== undefined) updateData.purchase_date = purchaseDate;
  if (purchaseLocation !== undefined) updateData.purchase_location = purchaseLocation;
  if (purchasePrice !== undefined) updateData.purchase_price = purchasePrice;
  if (notes !== undefined) updateData.notes = notes;

  const [updatedTool] = await db('tools')
    .where({ id })
    .update(updateData)
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'tool_updated',
    entityType: 'tool',
    entityId: id,
    oldValues: tool,
    newValues: updatedTool,
  });

  res.json({
    success: true,
    message: 'Tool updated successfully',
    data: { tool: updatedTool },
  });
}

export async function deleteTool(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  const tool = await db('tools')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!tool) {
    throw new NotFoundError('Tool not found');
  }

  await db('tools')
    .where({ id })
    .update({
      deleted_at: new Date(),
      updated_at: new Date(),
    });

  await createAuditLog(req, {
    userId,
    action: 'tool_deleted',
    entityType: 'tool',
    entityId: id,
    oldValues: tool,
  });

  res.json({
    success: true,
    message: 'Tool deleted successfully',
  });
}

export async function getToolStats(req: Request, res: Response) {
  const userId = (req as any).user.userId;

  const stats = await db('tools')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      db.raw('COUNT(*) as total_count'),
      db.raw("COUNT(*) FILTER (WHERE type = 'needle') as needle_count"),
      db.raw("COUNT(*) FILTER (WHERE type = 'hook') as hook_count")
    )
    .first();

  res.json({
    success: true,
    data: { stats },
  });
}
