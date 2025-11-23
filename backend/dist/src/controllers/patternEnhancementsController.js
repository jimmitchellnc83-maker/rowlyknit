"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatternSections = getPatternSections;
exports.createPatternSection = createPatternSection;
exports.updatePatternSection = updatePatternSection;
exports.deletePatternSection = deletePatternSection;
exports.getPatternBookmarks = getPatternBookmarks;
exports.createPatternBookmark = createPatternBookmark;
exports.updatePatternBookmark = updatePatternBookmark;
exports.deletePatternBookmark = deletePatternBookmark;
exports.getPatternHighlights = getPatternHighlights;
exports.createPatternHighlight = createPatternHighlight;
exports.updatePatternHighlight = updatePatternHighlight;
exports.deletePatternHighlight = deletePatternHighlight;
exports.getPatternAnnotations = getPatternAnnotations;
exports.createPatternAnnotation = createPatternAnnotation;
exports.updatePatternAnnotation = updatePatternAnnotation;
exports.deletePatternAnnotation = deletePatternAnnotation;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
/**
 * Pattern Sections
 */
/**
 * Get all sections for a pattern
 */
async function getPatternSections(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const sections = await (0, database_1.default)('pattern_sections')
        .where({ pattern_id: patternId })
        .orderBy('sort_order', 'asc');
    res.json({
        success: true,
        data: { sections },
    });
}
/**
 * Create a pattern section
 */
async function createPatternSection(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { name, pageNumber, yPosition, sortOrder } = req.body;
    if (!name) {
        throw new errorHandler_1.ValidationError('Section name is required');
    }
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const [section] = await (0, database_1.default)('pattern_sections')
        .insert({
        pattern_id: patternId,
        name,
        page_number: pageNumber,
        y_position: yPosition,
        sort_order: sortOrder,
        created_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_section_created',
        entityType: 'pattern_section',
        entityId: section.id,
        newValues: section,
    });
    res.status(201).json({
        success: true,
        message: 'Pattern section created successfully',
        data: { section },
    });
}
/**
 * Update a pattern section
 */
async function updatePatternSection(req, res) {
    const userId = req.user.userId;
    const { patternId, sectionId } = req.params;
    const updates = req.body;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const section = await (0, database_1.default)('pattern_sections')
        .where({ id: sectionId, pattern_id: patternId })
        .first();
    if (!section) {
        throw new errorHandler_1.NotFoundError('Pattern section not found');
    }
    const updateData = {};
    if (updates.name !== undefined)
        updateData.name = updates.name;
    if (updates.pageNumber !== undefined)
        updateData.page_number = updates.pageNumber;
    if (updates.yPosition !== undefined)
        updateData.y_position = updates.yPosition;
    if (updates.sortOrder !== undefined)
        updateData.sort_order = updates.sortOrder;
    const [updatedSection] = await (0, database_1.default)('pattern_sections')
        .where({ id: sectionId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_section_updated',
        entityType: 'pattern_section',
        entityId: sectionId,
        oldValues: section,
        newValues: updatedSection,
    });
    res.json({
        success: true,
        message: 'Pattern section updated successfully',
        data: { section: updatedSection },
    });
}
/**
 * Delete a pattern section
 */
async function deletePatternSection(req, res) {
    const userId = req.user.userId;
    const { patternId, sectionId } = req.params;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const section = await (0, database_1.default)('pattern_sections')
        .where({ id: sectionId, pattern_id: patternId })
        .first();
    if (!section) {
        throw new errorHandler_1.NotFoundError('Pattern section not found');
    }
    await (0, database_1.default)('pattern_sections').where({ id: sectionId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_section_deleted',
        entityType: 'pattern_section',
        entityId: sectionId,
        oldValues: section,
    });
    res.json({
        success: true,
        message: 'Pattern section deleted successfully',
    });
}
/**
 * Pattern Bookmarks
 */
/**
 * Get all bookmarks for a pattern/project
 */
async function getPatternBookmarks(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { projectId } = req.query;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    let query = (0, database_1.default)('pattern_bookmarks')
        .where({ pattern_id: patternId });
    if (projectId) {
        query = query.where({ project_id: projectId });
    }
    const bookmarks = await query.orderBy('created_at', 'desc');
    res.json({
        success: true,
        data: { bookmarks },
    });
}
/**
 * Create a pattern bookmark
 */
async function createPatternBookmark(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { projectId, name, pageNumber, yPosition, zoomLevel, color } = req.body;
    if (!name) {
        throw new errorHandler_1.ValidationError('Bookmark name is required');
    }
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    // Verify project ownership if projectId is provided
    if (projectId) {
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!project) {
            throw new errorHandler_1.NotFoundError('Project not found');
        }
    }
    const [bookmark] = await (0, database_1.default)('pattern_bookmarks')
        .insert({
        pattern_id: patternId,
        project_id: projectId || null,
        name,
        page_number: pageNumber,
        y_position: yPosition,
        zoom_level: zoomLevel,
        color,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_bookmark_created',
        entityType: 'pattern_bookmark',
        entityId: bookmark.id,
        newValues: bookmark,
    });
    res.status(201).json({
        success: true,
        message: 'Pattern bookmark created successfully',
        data: { bookmark },
    });
}
/**
 * Update a pattern bookmark
 */
async function updatePatternBookmark(req, res) {
    const userId = req.user.userId;
    const { patternId, bookmarkId } = req.params;
    const updates = req.body;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const bookmark = await (0, database_1.default)('pattern_bookmarks')
        .where({ id: bookmarkId, pattern_id: patternId })
        .first();
    if (!bookmark) {
        throw new errorHandler_1.NotFoundError('Pattern bookmark not found');
    }
    const updateData = { updated_at: new Date() };
    if (updates.name !== undefined)
        updateData.name = updates.name;
    if (updates.pageNumber !== undefined)
        updateData.page_number = updates.pageNumber;
    if (updates.yPosition !== undefined)
        updateData.y_position = updates.yPosition;
    if (updates.zoomLevel !== undefined)
        updateData.zoom_level = updates.zoomLevel;
    if (updates.color !== undefined)
        updateData.color = updates.color;
    const [updatedBookmark] = await (0, database_1.default)('pattern_bookmarks')
        .where({ id: bookmarkId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_bookmark_updated',
        entityType: 'pattern_bookmark',
        entityId: bookmarkId,
        oldValues: bookmark,
        newValues: updatedBookmark,
    });
    res.json({
        success: true,
        message: 'Pattern bookmark updated successfully',
        data: { bookmark: updatedBookmark },
    });
}
/**
 * Delete a pattern bookmark
 */
async function deletePatternBookmark(req, res) {
    const userId = req.user.userId;
    const { patternId, bookmarkId } = req.params;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const bookmark = await (0, database_1.default)('pattern_bookmarks')
        .where({ id: bookmarkId, pattern_id: patternId })
        .first();
    if (!bookmark) {
        throw new errorHandler_1.NotFoundError('Pattern bookmark not found');
    }
    await (0, database_1.default)('pattern_bookmarks').where({ id: bookmarkId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_bookmark_deleted',
        entityType: 'pattern_bookmark',
        entityId: bookmarkId,
        oldValues: bookmark,
    });
    res.json({
        success: true,
        message: 'Pattern bookmark deleted successfully',
    });
}
/**
 * Pattern Highlights
 */
/**
 * Get all highlights for a pattern/project
 */
async function getPatternHighlights(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { projectId, pageNumber } = req.query;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    let query = (0, database_1.default)('pattern_highlights')
        .where({ pattern_id: patternId });
    if (projectId) {
        query = query.where({ project_id: projectId });
    }
    if (pageNumber) {
        query = query.where({ page_number: pageNumber });
    }
    const highlights = await query.orderBy('created_at', 'desc');
    res.json({
        success: true,
        data: { highlights },
    });
}
/**
 * Create a pattern highlight
 */
async function createPatternHighlight(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { projectId, pageNumber, coordinates, color, opacity } = req.body;
    if (!pageNumber || !coordinates) {
        throw new errorHandler_1.ValidationError('Page number and coordinates are required');
    }
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    // Verify project ownership if projectId is provided
    if (projectId) {
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!project) {
            throw new errorHandler_1.NotFoundError('Project not found');
        }
    }
    const [highlight] = await (0, database_1.default)('pattern_highlights')
        .insert({
        pattern_id: patternId,
        project_id: projectId || null,
        page_number: pageNumber,
        coordinates: JSON.stringify(coordinates),
        color: color || '#FFFF00',
        opacity: opacity || 0.3,
        created_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_highlight_created',
        entityType: 'pattern_highlight',
        entityId: highlight.id,
        newValues: highlight,
    });
    res.status(201).json({
        success: true,
        message: 'Pattern highlight created successfully',
        data: { highlight },
    });
}
/**
 * Update a pattern highlight
 */
async function updatePatternHighlight(req, res) {
    const userId = req.user.userId;
    const { patternId, highlightId } = req.params;
    const updates = req.body;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const highlight = await (0, database_1.default)('pattern_highlights')
        .where({ id: highlightId, pattern_id: patternId })
        .first();
    if (!highlight) {
        throw new errorHandler_1.NotFoundError('Pattern highlight not found');
    }
    const updateData = {};
    if (updates.coordinates !== undefined)
        updateData.coordinates = JSON.stringify(updates.coordinates);
    if (updates.color !== undefined)
        updateData.color = updates.color;
    if (updates.opacity !== undefined)
        updateData.opacity = updates.opacity;
    const [updatedHighlight] = await (0, database_1.default)('pattern_highlights')
        .where({ id: highlightId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_highlight_updated',
        entityType: 'pattern_highlight',
        entityId: highlightId,
        oldValues: highlight,
        newValues: updatedHighlight,
    });
    res.json({
        success: true,
        message: 'Pattern highlight updated successfully',
        data: { highlight: updatedHighlight },
    });
}
/**
 * Delete a pattern highlight
 */
async function deletePatternHighlight(req, res) {
    const userId = req.user.userId;
    const { patternId, highlightId } = req.params;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const highlight = await (0, database_1.default)('pattern_highlights')
        .where({ id: highlightId, pattern_id: patternId })
        .first();
    if (!highlight) {
        throw new errorHandler_1.NotFoundError('Pattern highlight not found');
    }
    await (0, database_1.default)('pattern_highlights').where({ id: highlightId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_highlight_deleted',
        entityType: 'pattern_highlight',
        entityId: highlightId,
        oldValues: highlight,
    });
    res.json({
        success: true,
        message: 'Pattern highlight deleted successfully',
    });
}
/**
 * Pattern Annotations
 */
/**
 * Get all annotations for a pattern/project
 */
async function getPatternAnnotations(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { projectId, pageNumber } = req.query;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    let query = (0, database_1.default)('pattern_annotations')
        .where({ pattern_id: patternId });
    if (projectId) {
        query = query.where({ project_id: projectId });
    }
    if (pageNumber) {
        query = query.where({ page_number: pageNumber });
    }
    const annotations = await query.orderBy('created_at', 'desc');
    res.json({
        success: true,
        data: { annotations },
    });
}
/**
 * Create a pattern annotation
 */
async function createPatternAnnotation(req, res) {
    const userId = req.user.userId;
    const { patternId } = req.params;
    const { projectId, pageNumber, annotationType, data, imageUrl } = req.body;
    if (!pageNumber || !annotationType) {
        throw new errorHandler_1.ValidationError('Page number and annotation type are required');
    }
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    // Verify project ownership if projectId is provided
    if (projectId) {
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!project) {
            throw new errorHandler_1.NotFoundError('Project not found');
        }
    }
    const [annotation] = await (0, database_1.default)('pattern_annotations')
        .insert({
        pattern_id: patternId,
        project_id: projectId || null,
        page_number: pageNumber,
        annotation_type: annotationType,
        data: data ? JSON.stringify(data) : null,
        image_url: imageUrl,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_annotation_created',
        entityType: 'pattern_annotation',
        entityId: annotation.id,
        newValues: annotation,
    });
    res.status(201).json({
        success: true,
        message: 'Pattern annotation created successfully',
        data: { annotation },
    });
}
/**
 * Update a pattern annotation
 */
async function updatePatternAnnotation(req, res) {
    const userId = req.user.userId;
    const { patternId, annotationId } = req.params;
    const updates = req.body;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const annotation = await (0, database_1.default)('pattern_annotations')
        .where({ id: annotationId, pattern_id: patternId })
        .first();
    if (!annotation) {
        throw new errorHandler_1.NotFoundError('Pattern annotation not found');
    }
    const updateData = { updated_at: new Date() };
    if (updates.data !== undefined)
        updateData.data = JSON.stringify(updates.data);
    if (updates.imageUrl !== undefined)
        updateData.image_url = updates.imageUrl;
    const [updatedAnnotation] = await (0, database_1.default)('pattern_annotations')
        .where({ id: annotationId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_annotation_updated',
        entityType: 'pattern_annotation',
        entityId: annotationId,
        oldValues: annotation,
        newValues: updatedAnnotation,
    });
    res.json({
        success: true,
        message: 'Pattern annotation updated successfully',
        data: { annotation: updatedAnnotation },
    });
}
/**
 * Delete a pattern annotation
 */
async function deletePatternAnnotation(req, res) {
    const userId = req.user.userId;
    const { patternId, annotationId } = req.params;
    // Verify pattern ownership
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const annotation = await (0, database_1.default)('pattern_annotations')
        .where({ id: annotationId, pattern_id: patternId })
        .first();
    if (!annotation) {
        throw new errorHandler_1.NotFoundError('Pattern annotation not found');
    }
    await (0, database_1.default)('pattern_annotations').where({ id: annotationId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_annotation_deleted',
        entityType: 'pattern_annotation',
        entityId: annotationId,
        oldValues: annotation,
    });
    res.json({
        success: true,
        message: 'Pattern annotation deleted successfully',
    });
}
