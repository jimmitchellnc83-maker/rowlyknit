"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAudioNotes = getAudioNotes;
exports.getAudioNote = getAudioNote;
exports.createAudioNote = createAudioNote;
exports.updateAudioNote = updateAudioNote;
exports.deleteAudioNote = deleteAudioNote;
exports.getStructuredMemos = getStructuredMemos;
exports.getStructuredMemo = getStructuredMemo;
exports.createStructuredMemo = createStructuredMemo;
exports.updateStructuredMemo = updateStructuredMemo;
exports.deleteStructuredMemo = deleteStructuredMemo;
exports.getTextNotes = getTextNotes;
exports.getTextNote = getTextNote;
exports.createTextNote = createTextNote;
exports.updateTextNote = updateTextNote;
exports.deleteTextNote = deleteTextNote;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const writeFileAsync = (0, util_1.promisify)(fs_1.default.writeFile);
/**
 * Audio Notes
 */
/**
 * Get all audio notes for a project
 */
async function getAudioNotes(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { patternId } = req.query;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    let query = (0, database_1.default)('audio_notes')
        .where({ project_id: projectId });
    if (patternId) {
        query = query.where({ pattern_id: patternId });
    }
    const audioNotes = await query.orderBy('created_at', 'desc');
    res.json({
        success: true,
        data: { audioNotes },
    });
}
/**
 * Get single audio note by ID
 */
async function getAudioNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId, noteId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const audioNote = await (0, database_1.default)('audio_notes')
        .where({ id: noteId, project_id: projectId })
        .first();
    if (!audioNote) {
        throw new errorHandler_1.NotFoundError('Audio note not found');
    }
    res.json({
        success: true,
        data: { audioNote },
    });
}
/**
 * Create an audio note
 */
async function createAudioNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    // Debug logging
    console.log('📥 Audio note request body:', req.body);
    console.log('📥 Audio note file:', req.file?.originalname);
    const { patternId, transcription, durationSeconds } = req.body;
    const file = req.file;
    // Multer will have already uploaded the file if present
    if (!file) {
        throw new errorHandler_1.ValidationError('Audio file is required');
    }
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Verify pattern ownership if patternId is provided
    if (patternId) {
        const pattern = await (0, database_1.default)('patterns')
            .where({ id: patternId, user_id: userId })
            .first();
        if (!pattern) {
            throw new errorHandler_1.NotFoundError('Pattern not found');
        }
    }
    // Generate unique filename
    const timestamp = Date.now();
    const ext = path_1.default.extname(file.originalname) || '.webm';
    const filename = `audio-${projectId}-${timestamp}${ext}`;
    const filepath = path_1.default.join('uploads/audio', filename);
    // Save audio file
    await writeFileAsync(filepath, file.buffer);
    // Create audioUrl (relative path for serving)
    const audioUrl = `/uploads/audio/${filename}`;
    const [audioNote] = await (0, database_1.default)('audio_notes')
        .insert({
        project_id: projectId,
        pattern_id: patternId || null,
        audio_url: audioUrl,
        transcription: transcription || null,
        duration_seconds: durationSeconds || 0,
        created_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'audio_note_created',
        entityType: 'audio_note',
        entityId: audioNote.id,
        newValues: audioNote,
    });
    res.status(201).json({
        success: true,
        message: 'Audio note created successfully',
        data: { audioNote },
    });
}
/**
 * Update an audio note
 */
async function updateAudioNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId, noteId } = req.params;
    const updates = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const audioNote = await (0, database_1.default)('audio_notes')
        .where({ id: noteId, project_id: projectId })
        .first();
    if (!audioNote) {
        throw new errorHandler_1.NotFoundError('Audio note not found');
    }
    const updateData = {};
    if (updates.transcription !== undefined)
        updateData.transcription = updates.transcription;
    const [updatedAudioNote] = await (0, database_1.default)('audio_notes')
        .where({ id: noteId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'audio_note_updated',
        entityType: 'audio_note',
        entityId: noteId,
        oldValues: audioNote,
        newValues: updatedAudioNote,
    });
    res.json({
        success: true,
        message: 'Audio note updated successfully',
        data: { audioNote: updatedAudioNote },
    });
}
/**
 * Delete an audio note
 */
async function deleteAudioNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId, noteId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const audioNote = await (0, database_1.default)('audio_notes')
        .where({ id: noteId, project_id: projectId })
        .first();
    if (!audioNote) {
        throw new errorHandler_1.NotFoundError('Audio note not found');
    }
    await (0, database_1.default)('audio_notes').where({ id: noteId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'audio_note_deleted',
        entityType: 'audio_note',
        entityId: noteId,
        oldValues: audioNote,
    });
    res.json({
        success: true,
        message: 'Audio note deleted successfully',
    });
}
/**
 * Structured Memos
 */
/**
 * Get all structured memos for a project
 */
async function getStructuredMemos(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { templateType } = req.query;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    let query = (0, database_1.default)('structured_memos')
        .where({ project_id: projectId });
    if (templateType) {
        query = query.where({ template_type: templateType });
    }
    const memos = await query.orderBy('created_at', 'desc');
    res.json({
        success: true,
        data: { memos },
    });
}
/**
 * Get single structured memo by ID
 */
async function getStructuredMemo(req, res) {
    const userId = req.user.userId;
    const { id: projectId, memoId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const memo = await (0, database_1.default)('structured_memos')
        .where({ id: memoId, project_id: projectId })
        .first();
    if (!memo) {
        throw new errorHandler_1.NotFoundError('Structured memo not found');
    }
    res.json({
        success: true,
        data: { memo },
    });
}
/**
 * Create a structured memo
 */
async function createStructuredMemo(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { templateType, data } = req.body;
    if (!templateType || !data) {
        throw new errorHandler_1.ValidationError('Template type and data are required');
    }
    const validTemplateTypes = ['gauge_swatch', 'fit_adjustment', 'yarn_substitution', 'finishing'];
    if (!validTemplateTypes.includes(templateType)) {
        throw new errorHandler_1.ValidationError(`Template type must be one of: ${validTemplateTypes.join(', ')}`);
    }
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const [memo] = await (0, database_1.default)('structured_memos')
        .insert({
        project_id: projectId,
        template_type: templateType,
        data: JSON.stringify(data),
        created_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'structured_memo_created',
        entityType: 'structured_memo',
        entityId: memo.id,
        newValues: memo,
    });
    res.status(201).json({
        success: true,
        message: 'Structured memo created successfully',
        data: { memo },
    });
}
/**
 * Update a structured memo
 */
async function updateStructuredMemo(req, res) {
    const userId = req.user.userId;
    const { id: projectId, memoId } = req.params;
    const updates = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const memo = await (0, database_1.default)('structured_memos')
        .where({ id: memoId, project_id: projectId })
        .first();
    if (!memo) {
        throw new errorHandler_1.NotFoundError('Structured memo not found');
    }
    const updateData = {};
    if (updates.data !== undefined)
        updateData.data = JSON.stringify(updates.data);
    const [updatedMemo] = await (0, database_1.default)('structured_memos')
        .where({ id: memoId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'structured_memo_updated',
        entityType: 'structured_memo',
        entityId: memoId,
        oldValues: memo,
        newValues: updatedMemo,
    });
    res.json({
        success: true,
        message: 'Structured memo updated successfully',
        data: { memo: updatedMemo },
    });
}
/**
 * Delete a structured memo
 */
async function deleteStructuredMemo(req, res) {
    const userId = req.user.userId;
    const { id: projectId, memoId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const memo = await (0, database_1.default)('structured_memos')
        .where({ id: memoId, project_id: projectId })
        .first();
    if (!memo) {
        throw new errorHandler_1.NotFoundError('Structured memo not found');
    }
    await (0, database_1.default)('structured_memos').where({ id: memoId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'structured_memo_deleted',
        entityType: 'structured_memo',
        entityId: memoId,
        oldValues: memo,
    });
    res.json({
        success: true,
        message: 'Structured memo deleted successfully',
    });
}
/**
 * Text Notes
 */
/**
 * Get all text notes for a project
 */
async function getTextNotes(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { patternId } = req.query;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    let query = (0, database_1.default)('text_notes')
        .where({ project_id: projectId });
    if (patternId) {
        query = query.where({ pattern_id: patternId });
    }
    const textNotes = await query.orderBy('is_pinned', 'desc').orderBy('created_at', 'desc');
    res.json({
        success: true,
        data: { textNotes },
    });
}
/**
 * Get single text note by ID
 */
async function getTextNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId, noteId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const textNote = await (0, database_1.default)('text_notes')
        .where({ id: noteId, project_id: projectId })
        .first();
    if (!textNote) {
        throw new errorHandler_1.NotFoundError('Text note not found');
    }
    res.json({
        success: true,
        data: { textNote },
    });
}
/**
 * Create a text note
 */
async function createTextNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { title, content, patternId, tags, isPinned } = req.body;
    if (!content) {
        throw new errorHandler_1.ValidationError('Note content is required');
    }
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Verify pattern ownership if patternId is provided
    if (patternId) {
        const pattern = await (0, database_1.default)('patterns')
            .where({ id: patternId, user_id: userId })
            .first();
        if (!pattern) {
            throw new errorHandler_1.NotFoundError('Pattern not found');
        }
    }
    const [textNote] = await (0, database_1.default)('text_notes')
        .insert({
        project_id: projectId,
        pattern_id: patternId || null,
        title: title || null,
        content,
        tags: tags || null,
        is_pinned: isPinned || false,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'text_note_created',
        entityType: 'text_note',
        entityId: textNote.id,
        newValues: textNote,
    });
    res.status(201).json({
        success: true,
        message: 'Text note created successfully',
        data: { textNote },
    });
}
/**
 * Update a text note
 */
async function updateTextNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId, noteId } = req.params;
    const updates = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const textNote = await (0, database_1.default)('text_notes')
        .where({ id: noteId, project_id: projectId })
        .first();
    if (!textNote) {
        throw new errorHandler_1.NotFoundError('Text note not found');
    }
    const updateData = { updated_at: new Date() };
    if (updates.title !== undefined)
        updateData.title = updates.title;
    if (updates.content !== undefined)
        updateData.content = updates.content;
    if (updates.tags !== undefined)
        updateData.tags = updates.tags;
    if (updates.isPinned !== undefined)
        updateData.is_pinned = updates.isPinned;
    const [updatedTextNote] = await (0, database_1.default)('text_notes')
        .where({ id: noteId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'text_note_updated',
        entityType: 'text_note',
        entityId: noteId,
        oldValues: textNote,
        newValues: updatedTextNote,
    });
    res.json({
        success: true,
        message: 'Text note updated successfully',
        data: { textNote: updatedTextNote },
    });
}
/**
 * Delete a text note
 */
async function deleteTextNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId, noteId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const textNote = await (0, database_1.default)('text_notes')
        .where({ id: noteId, project_id: projectId })
        .first();
    if (!textNote) {
        throw new errorHandler_1.NotFoundError('Text note not found');
    }
    await (0, database_1.default)('text_notes').where({ id: noteId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'text_note_deleted',
        entityType: 'text_note',
        entityId: noteId,
        oldValues: textNote,
    });
    res.json({
        success: true,
        message: 'Text note deleted successfully',
    });
}
