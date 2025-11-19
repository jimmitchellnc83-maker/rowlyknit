import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';

/**
 * Get all bookmarks for a pattern (optionally filtered by project)
 */
export async function getBookmarks(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId } = req.params;
  const { projectId } = req.query;

  // Verify pattern access (user owns pattern or has access via project)
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  let query = db('pattern_bookmarks')
    .where({ pattern_id: patternId })
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'asc');

  if (projectId) {
    query = query.where({ project_id: projectId });
  }

  const bookmarks = await query;

  res.json({
    success: true,
    data: { bookmarks },
  });
}

/**
 * Get single bookmark by ID
 */
export async function getBookmark(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId, bookmarkId } = req.params;

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  const bookmark = await db('pattern_bookmarks')
    .where({ id: bookmarkId, pattern_id: patternId })
    .first();

  if (!bookmark) {
    throw new NotFoundError('Bookmark not found');
  }

  res.json({
    success: true,
    data: { bookmark },
  });
}

/**
 * Create a new bookmark
 */
export async function createBookmark(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId } = req.params;
  const {
    name,
    pageNumber,
    yPosition,
    zoomLevel = 1.0,
    notes,
    color = '#FBBF24',
    projectId,
    sortOrder,
  } = req.body;

  if (!name || !pageNumber) {
    throw new ValidationError('Bookmark name and page number are required');
  }

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // If projectId provided, verify ownership
  if (projectId) {
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!project) {
      throw new NotFoundError('Project not found');
    }
  }

  // Get next sort order if not provided
  let finalSortOrder = sortOrder;
  if (finalSortOrder === undefined) {
    const result = await db('pattern_bookmarks')
      .where({ pattern_id: patternId })
      .max('sort_order as maxOrder')
      .first();
    finalSortOrder = (result?.maxOrder ?? -1) + 1;
  }

  const [bookmark] = await db('pattern_bookmarks')
    .insert({
      pattern_id: patternId,
      project_id: projectId || null,
      name,
      page_number: pageNumber,
      y_position: yPosition || null,
      zoom_level: zoomLevel,
      notes: notes || null,
      color,
      sort_order: finalSortOrder,
      created_at: new Date(),
    })
    .returning('*');

  res.status(201).json({
    success: true,
    message: 'Bookmark created successfully',
    data: { bookmark },
  });
}

/**
 * Update a bookmark
 */
export async function updateBookmark(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId, bookmarkId } = req.params;
  const updates = req.body;

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  const bookmark = await db('pattern_bookmarks')
    .where({ id: bookmarkId, pattern_id: patternId })
    .first();

  if (!bookmark) {
    throw new NotFoundError('Bookmark not found');
  }

  // Prepare update data
  const updateData: any = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.pageNumber !== undefined) updateData.page_number = updates.pageNumber;
  if (updates.yPosition !== undefined) updateData.y_position = updates.yPosition;
  if (updates.zoomLevel !== undefined) updateData.zoom_level = updates.zoomLevel;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;
  if (updates.projectId !== undefined) updateData.project_id = updates.projectId;

  const [updatedBookmark] = await db('pattern_bookmarks')
    .where({ id: bookmarkId })
    .update(updateData)
    .returning('*');

  res.json({
    success: true,
    message: 'Bookmark updated successfully',
    data: { bookmark: updatedBookmark },
  });
}

/**
 * Delete a bookmark
 */
export async function deleteBookmark(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId, bookmarkId } = req.params;

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  const bookmark = await db('pattern_bookmarks')
    .where({ id: bookmarkId, pattern_id: patternId })
    .first();

  if (!bookmark) {
    throw new NotFoundError('Bookmark not found');
  }

  await db('pattern_bookmarks').where({ id: bookmarkId }).del();

  res.json({
    success: true,
    message: 'Bookmark deleted successfully',
  });
}

/**
 * Reorder bookmarks
 */
export async function reorderBookmarks(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId } = req.params;
  const { bookmarks } = req.body;

  if (!Array.isArray(bookmarks)) {
    throw new ValidationError('Bookmarks must be an array');
  }

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // Update sort order for each bookmark
  await db.transaction(async (trx) => {
    for (const item of bookmarks) {
      await trx('pattern_bookmarks')
        .where({ id: item.id, pattern_id: patternId })
        .update({ sort_order: item.sortOrder });
    }
  });

  res.json({
    success: true,
    message: 'Bookmarks reordered successfully',
  });
}
