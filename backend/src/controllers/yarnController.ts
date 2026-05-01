import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import { sanitizeSearchQuery } from '../utils/inputSanitizer';
import { intOrNull, numOrNull } from '../utils/numericInput';
import { findYarnSubstitutions } from '../services/feasibilityService';

export async function getYarn(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { weight, brand, search, favorite, lowStock, page = 1, limit = 20 } = req.query;

  let query = db('yarn')
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (weight) {
    query = query.where({ weight });
  }

  if (brand) {
    query = query.where({ brand });
  }

  if (favorite === 'true') {
    query = query.where({ is_favorite: true });
  }

  // Low-stock filter: alert enabled, threshold set, and remaining at/below it.
  // Lets the dashboard request just the low-stock rows instead of pulling all
  // yarn down and filtering client-side.
  if (lowStock === 'true') {
    query = query
      .where({ low_stock_alert: true })
      .whereNotNull('low_stock_threshold')
      .whereRaw('yards_remaining <= low_stock_threshold');
  }

  if (search) {
    const sanitizedSearch = sanitizeSearchQuery(search as string);
    query = query.where((builder) => {
      builder
        .where('name', 'ilike', `%${sanitizedSearch}%`)
        .orWhere('brand', 'ilike', `%${sanitizedSearch}%`)
        .orWhere('color', 'ilike', `%${sanitizedSearch}%`);
    });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const [{ count }] = await query.clone().count('* as count');
  const yarn = await query
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .offset(offset);

  // Attach primary photo (oldest, or marked is_primary)
  if (yarn.length > 0) {
    const yarnIds = yarn.map((y: any) => y.id);
    const photos = await db('yarn_photos')
      .whereIn('yarn_id', yarnIds)
      .whereNull('deleted_at')
      .orderBy([
        { column: 'is_primary', order: 'desc' },
        { column: 'created_at', order: 'asc' },
      ])
      .select('yarn_id', 'thumbnail_path', 'file_path');

    const photosByYarn: Record<string, any> = {};
    for (const photo of photos) {
      if (!photosByYarn[photo.yarn_id]) {
        photosByYarn[photo.yarn_id] = photo;
      }
    }

    for (const y of yarn as any[]) {
      const photo = photosByYarn[y.id];
      y.thumbnail_path = photo?.thumbnail_path || null;
      y.photo_path = photo?.file_path || null;
    }
  }

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
  const userId = req.user!.userId;
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

export async function getProjectsUsingYarn(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const yarn = await db('yarn')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!yarn) {
    throw new NotFoundError('Yarn not found');
  }

  const projects = await db('project_yarn as py')
    .join('projects as p', 'p.id', 'py.project_id')
    .where('py.yarn_id', id)
    .andWhere('p.user_id', userId)
    .whereNull('p.deleted_at')
    .orderBy('p.created_at', 'desc')
    .select(
      'p.id',
      'p.name',
      'p.status',
      'p.project_type',
      'p.actual_completion_date as completion_date',
      'py.yards_used',
      'py.skeins_used'
    );

  res.json({
    success: true,
    data: { projects },
  });
}

export async function createYarn(req: Request, res: Response) {
  const userId = req.user!.userId;
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
    // Ravelry/structured fields
    gauge,
    needleSizes,
    machineWashable,
    discontinued,
    ravelryId,
    ravelryRating,
    description,
  } = req.body;

  if (!name) {
    throw new ValidationError('Yarn name is required');
  }

  // Coerce HTML-form empty strings to null before they hit integer / numeric
  // columns; without this an unfilled "Yards per skein" field 500s the insert.
  const yardsTotalInt = intOrNull(yardsTotal);
  const gramsTotalInt = intOrNull(gramsTotal);
  const skeinsTotalInt = intOrNull(skeinsTotal) ?? 1;
  const pricePerSkeinNum = numOrNull(pricePerSkein);
  const ravelryIdInt = intOrNull(ravelryId);
  const ravelryRatingNum = numOrNull(ravelryRating);

  // Compute normalized length in meters from yards (1 yd = 0.9144 m)
  const totalLengthM = yardsTotalInt != null ? yardsTotalInt * 0.9144 : null;

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
      yards_total: yardsTotalInt,
      yards_remaining: yardsTotalInt,
      total_length_m: totalLengthM != null ? Math.round(totalLengthM * 100) / 100 : null,
      remaining_length_m: totalLengthM != null ? Math.round(totalLengthM * 100) / 100 : null,
      grams_total: gramsTotalInt,
      grams_remaining: gramsTotalInt,
      skeins_total: skeinsTotalInt,
      skeins_remaining: skeinsTotalInt,
      price_per_skein: pricePerSkeinNum,
      purchase_date: purchaseDate || null,
      purchase_location: purchaseLocation,
      dye_lot: dyeLot,
      notes,
      tags: tags ? JSON.stringify(tags) : '[]',
      gauge,
      needle_sizes: needleSizes,
      machine_washable: machineWashable,
      discontinued: discontinued || false,
      ravelry_id: ravelryIdInt,
      ravelry_rating: ravelryRatingNum,
      description,
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
  const userId = req.user!.userId;
  const { id } = req.params;

  const yarn = await db('yarn')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!yarn) {
    throw new NotFoundError('Yarn not found');
  }

  // Whitelist allowed fields -- use same camelCase names as createYarn
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
    lowStockThreshold,
    lowStockAlert,
    gauge,
    needleSizes,
    machineWashable,
    discontinued,
    ravelryId,
    ravelryRating,
    description,
    isFavorite,
  } = req.body;

  const updateData: any = {
    updated_at: new Date(),
  };

  if (brand !== undefined) updateData.brand = brand;
  if (line !== undefined) updateData.line = line;
  if (name !== undefined) updateData.name = name;
  if (color !== undefined) updateData.color = color;
  if (colorCode !== undefined) updateData.color_code = colorCode;
  if (weight !== undefined) updateData.weight = weight;
  if (fiberContent !== undefined) updateData.fiber_content = fiberContent;
  if (yardsTotal !== undefined) {
    // Adjust remaining by the same delta so usage tracking is preserved
    const yardsTotalInt = intOrNull(yardsTotal);
    const delta = (yardsTotalInt ?? 0) - (yarn.yards_total || 0);
    updateData.yards_total = yardsTotalInt;
    updateData.yards_remaining = yardsTotalInt == null
      ? null
      : Math.max(0, (yarn.yards_remaining || 0) + delta);
    // Keep normalized meter columns in sync
    updateData.total_length_m = yardsTotalInt == null
      ? null
      : Math.round(yardsTotalInt * 0.9144 * 100) / 100;
    updateData.remaining_length_m = yardsTotalInt == null
      ? null
      : Math.max(0, Math.round(
          ((yarn.remaining_length_m || 0) + delta * 0.9144) * 100
        ) / 100);
  }
  if (gramsTotal !== undefined) {
    const gramsTotalInt = intOrNull(gramsTotal);
    const delta = (gramsTotalInt ?? 0) - (yarn.grams_total || 0);
    updateData.grams_total = gramsTotalInt;
    updateData.grams_remaining = gramsTotalInt == null
      ? null
      : Math.max(0, (yarn.grams_remaining || 0) + delta);
  }
  if (skeinsTotal !== undefined) {
    const skeinsTotalInt = intOrNull(skeinsTotal);
    const delta = (skeinsTotalInt ?? 0) - (yarn.skeins_total || 0);
    updateData.skeins_total = skeinsTotalInt;
    updateData.skeins_remaining = skeinsTotalInt == null
      ? null
      : Math.max(0, (yarn.skeins_remaining || 0) + delta);
  }
  if (pricePerSkein !== undefined) updateData.price_per_skein = numOrNull(pricePerSkein);
  if (purchaseDate !== undefined) updateData.purchase_date = purchaseDate || null;
  if (purchaseLocation !== undefined) updateData.purchase_location = purchaseLocation;
  if (dyeLot !== undefined) updateData.dye_lot = dyeLot;
  if (notes !== undefined) updateData.notes = notes;
  if (tags !== undefined) updateData.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
  if (lowStockThreshold !== undefined) updateData.low_stock_threshold = intOrNull(lowStockThreshold);
  if (lowStockAlert !== undefined) updateData.low_stock_alert = lowStockAlert;
  if (gauge !== undefined) updateData.gauge = gauge;
  if (needleSizes !== undefined) updateData.needle_sizes = needleSizes;
  if (machineWashable !== undefined) updateData.machine_washable = machineWashable;
  if (discontinued !== undefined) updateData.discontinued = discontinued;
  if (ravelryId !== undefined) updateData.ravelry_id = intOrNull(ravelryId);
  if (ravelryRating !== undefined) updateData.ravelry_rating = numOrNull(ravelryRating);
  if (description !== undefined) updateData.description = description;
  if (isFavorite !== undefined) updateData.is_favorite = isFavorite;

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
  const userId = req.user!.userId;
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
  const userId = req.user!.userId;

  // Cost aggregates use COALESCE so yarn without a price still counts toward
  // skein / yardage totals; only the money columns drop it. `priced_count`
  // tells the UI how many yarns contributed to the value — useful because
  // users with some unpriced yarn should know the figure is a lower bound.
  const stats = await db('yarn')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      db.raw('COUNT(*) as total_count'),
      db.raw('COALESCE(SUM(skeins_remaining), 0) as total_skeins'),
      db.raw('COALESCE(SUM(yards_remaining), 0) as total_yards'),
      db.raw(
        'COALESCE(SUM(price_per_skein * skeins_remaining), 0) as total_value_current'
      ),
      db.raw('COALESCE(SUM(price_per_skein * skeins_total), 0) as total_value_all_time'),
      db.raw("COUNT(*) FILTER (WHERE price_per_skein IS NOT NULL) as priced_count"),
      db.raw("COUNT(*) FILTER (WHERE price_per_skein IS NULL) as unpriced_count")
    )
    .first();

  res.json({
    success: true,
    data: { stats },
  });
}

/**
 * Score the user's stash against a standalone yarn requirement and return
 * traffic-light-ranked candidates. Shares the matcher semantics used by the
 * pattern feasibility check (#97) so recommendations stay consistent between
 * the two entry points.
 */
export async function getYarnSubstitutions(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { weightName, fiberHints, yardage, skeinCount } = req.body;

  if (weightName != null && typeof weightName !== 'string') {
    throw new ValidationError('weightName must be a string');
  }
  if (fiberHints != null && !Array.isArray(fiberHints)) {
    throw new ValidationError('fiberHints must be an array of strings');
  }

  const result = await findYarnSubstitutions(userId, {
    weightName: weightName ?? null,
    fiberHints: Array.isArray(fiberHints) ? fiberHints : null,
    yardage: yardage != null ? Number(yardage) : null,
    skeinCount: skeinCount != null ? Number(skeinCount) : null,
  });

  res.json({
    success: true,
    data: { substitution: result },
  });
}
