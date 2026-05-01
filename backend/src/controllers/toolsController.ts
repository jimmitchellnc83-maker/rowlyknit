import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import { sanitizeSearchQuery } from '../utils/inputSanitizer';
import { intOrNull, numOrNull } from '../utils/numericInput';

export async function getTools(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { type, category, search, page = 1, limit = 20 } = req.query;

  let query = db('tools')
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (category) {
    query = query.where({ category });
  }

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
  const userId = req.user!.userId;
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
  const userId = req.user!.userId;
  const {
    type,
    category,
    name,
    size,
    sizeMm,
    material,
    length,
    brand,
    quantity,
    craftType,
    toolCategory,
    cableLengthMm,
    notes,
    purchaseDate,
    purchasePrice,
    taxonomyTypeId,
    taxonomyLabel,
    taxonomyCategoryLabel,
    taxonomySubcategoryLabel,
  } = req.body;

  if (!name || !type) {
    throw new ValidationError('Tool name and type are required');
  }

  const [tool] = await db('tools')
    .insert({
      user_id: userId,
      type,
      category: category || 'other',
      craft_type: craftType || 'knitting',
      tool_category: toolCategory || 'accessory',
      name,
      size,
      size_mm: numOrNull(sizeMm),
      cable_length_mm: numOrNull(cableLengthMm),
      material,
      length: intOrNull(length),
      brand,
      quantity: intOrNull(quantity) ?? 1,
      notes,
      purchase_date: purchaseDate || null,
      purchase_price: numOrNull(purchasePrice),
      taxonomy_type_id: taxonomyTypeId || null,
      taxonomy_label: taxonomyLabel || null,
      taxonomy_category_label: taxonomyCategoryLabel || null,
      taxonomy_subcategory_label: taxonomySubcategoryLabel || null,
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
  const userId = req.user!.userId;
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
    category,
    size,
    sizeMm,
    material,
    brand,
    quantity,
    craftType,
    toolCategory,
    cableLengthMm,
    purchaseDate,
    purchasePrice,
    notes,
    taxonomyTypeId,
    taxonomyLabel,
    taxonomyCategoryLabel,
    taxonomySubcategoryLabel,
  } = req.body;

  const updateData: any = {
    updated_at: new Date(),
  };

  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (category !== undefined) updateData.category = category;
  if (size !== undefined) updateData.size = size;
  if (sizeMm !== undefined) updateData.size_mm = numOrNull(sizeMm);
  if (material !== undefined) updateData.material = material;
  if (brand !== undefined) updateData.brand = brand;
  if (quantity !== undefined) updateData.quantity = intOrNull(quantity);
  if (craftType !== undefined) updateData.craft_type = craftType;
  if (toolCategory !== undefined) updateData.tool_category = toolCategory;
  if (cableLengthMm !== undefined) updateData.cable_length_mm = numOrNull(cableLengthMm);
  if (purchaseDate !== undefined) updateData.purchase_date = purchaseDate || null;
  if (purchasePrice !== undefined) updateData.purchase_price = numOrNull(purchasePrice);
  if (notes !== undefined) updateData.notes = notes;
  if (taxonomyTypeId !== undefined) updateData.taxonomy_type_id = taxonomyTypeId || null;
  if (taxonomyLabel !== undefined) updateData.taxonomy_label = taxonomyLabel || null;
  if (taxonomyCategoryLabel !== undefined) updateData.taxonomy_category_label = taxonomyCategoryLabel || null;
  if (taxonomySubcategoryLabel !== undefined) updateData.taxonomy_subcategory_label = taxonomySubcategoryLabel || null;

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
  const userId = req.user!.userId;
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
  const userId = req.user!.userId;

  const stats = await db('tools')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      db.raw('COUNT(*) as total_count'),
      db.raw("COUNT(*) FILTER (WHERE category = 'knitting_needles') as knitting_needles_count"),
      db.raw("COUNT(*) FILTER (WHERE category = 'crochet_hooks') as crochet_hooks_count"),
      db.raw("COUNT(*) FILTER (WHERE category = 'measuring') as measuring_count"),
      db.raw("COUNT(*) FILTER (WHERE category = 'markers_holders') as markers_holders_count"),
      db.raw("COUNT(*) FILTER (WHERE category = 'cutting_finishing') as cutting_finishing_count"),
      db.raw("COUNT(*) FILTER (WHERE category = 'blocking') as blocking_count"),
      db.raw("COUNT(*) FILTER (WHERE category = 'yarn_handling') as yarn_handling_count"),
      db.raw("COUNT(*) FILTER (WHERE category = 'comfort') as comfort_count"),
      db.raw("COUNT(*) FILTER (WHERE category = 'specialty') as specialty_count"),
      db.raw("COUNT(*) FILTER (WHERE category = 'other') as other_count")
    )
    .first();

  res.json({
    success: true,
    data: { stats },
  });
}
