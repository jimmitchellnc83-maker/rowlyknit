"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBookmarks = getBookmarks;
exports.getBookmark = getBookmark;
exports.createBookmark = createBookmark;
exports.updateBookmark = updateBookmark;
exports.deleteBookmark = deleteBookmark;
exports.reorderBookmarks = reorderBookmarks;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
/**
 * Get all bookmarks for a pattern (optionally filtered by project)
 */
async function getBookmarks(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { projectId } = req.query;
    // Verify pattern access (user owns pattern or has access via project)
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    let query = (0, database_1.default)('pattern_bookmarks')
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
async function getBookmark(req, res) {
    const userId = req.user.userId;
    const { patternId, bookmarkId } = req.params;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const bookmark = await (0, database_1.default)('pattern_bookmarks')
        .where({ id: bookmarkId, pattern_id: patternId })
        .first();
    if (!bookmark) {
        throw new errorHandler_1.NotFoundError('Bookmark not found');
    }
    res.json({
        success: true,
        data: { bookmark },
    });
}
/**
 * Create a new bookmark
 */
async function createBookmark(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { name, pageNumber, yPosition, zoomLevel = 1.0, notes, color = '#FBBF24', projectId, sortOrder, } = req.body;
    if (!name || !pageNumber) {
        throw new errorHandler_1.ValidationError('Bookmark name and page number are required');
    }
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    // If projectId provided, verify ownership
    if (projectId) {
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!project) {
            throw new errorHandler_1.NotFoundError('Project not found');
        }
    }
    // Get next sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
        const result = await (0, database_1.default)('pattern_bookmarks')
            .where({ pattern_id: patternId })
            .max('sort_order as maxOrder')
            .first();
        finalSortOrder = (result?.maxOrder ?? -1) + 1;
    }
    const [bookmark] = await (0, database_1.default)('pattern_bookmarks')
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
async function updateBookmark(req, res) {
    const userId = req.user.userId;
    const { patternId, bookmarkId } = req.params;
    const updates = req.body;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const bookmark = await (0, database_1.default)('pattern_bookmarks')
        .where({ id: bookmarkId, pattern_id: patternId })
        .first();
    if (!bookmark) {
        throw new errorHandler_1.NotFoundError('Bookmark not found');
    }
    // Prepare update data
    const updateData = {};
    if (updates.name !== undefined)
        updateData.name = updates.name;
    if (updates.pageNumber !== undefined)
        updateData.page_number = updates.pageNumber;
    if (updates.yPosition !== undefined)
        updateData.y_position = updates.yPosition;
    if (updates.zoomLevel !== undefined)
        updateData.zoom_level = updates.zoomLevel;
    if (updates.notes !== undefined)
        updateData.notes = updates.notes;
    if (updates.color !== undefined)
        updateData.color = updates.color;
    if (updates.sortOrder !== undefined)
        updateData.sort_order = updates.sortOrder;
    if (updates.projectId !== undefined)
        updateData.project_id = updates.projectId;
    const [updatedBookmark] = await (0, database_1.default)('pattern_bookmarks')
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
async function deleteBookmark(req, res) {
    const userId = req.user.userId;
    const { patternId, bookmarkId } = req.params;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const bookmark = await (0, database_1.default)('pattern_bookmarks')
        .where({ id: bookmarkId, pattern_id: patternId })
        .first();
    if (!bookmark) {
        throw new errorHandler_1.NotFoundError('Bookmark not found');
    }
    await (0, database_1.default)('pattern_bookmarks').where({ id: bookmarkId }).del();
    res.json({
        success: true,
        message: 'Bookmark deleted successfully',
    });
}
/**
 * Reorder bookmarks
 */
async function reorderBookmarks(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { bookmarks } = req.body;
    if (!Array.isArray(bookmarks)) {
        throw new errorHandler_1.ValidationError('Bookmarks must be an array');
    }
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    // Update sort order for each bookmark
    await database_1.default.transaction(async (trx) => {
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
