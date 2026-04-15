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
exports.getHandwrittenNotes = getHandwrittenNotes;
exports.createHandwrittenNote = createHandwrittenNote;
exports.deleteHandwrittenNote = deleteHandwrittenNote;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
const logger_1 = __importDefault(require("../config/logger"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const transcriptionService_1 = __importDefault(require("../services/transcriptionService"));
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
    let query = (0, database_1.default)('audio_notes as an')
        .leftJoin('patterns as p', 'an.pattern_id', 'p.id')
        .where({ 'an.project_id': projectId })
        .select('an.*', database_1.default.raw('p.name as pattern_name'));
    if (patternId) {
        query = query.where({ 'an.pattern_id': patternId });
    }
    const audioNotes = await query.orderBy('an.created_at', 'desc');
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
    const audioNote = await (0, database_1.default)('audio_notes as an')
        .leftJoin('patterns as p', 'an.pattern_id', 'p.id')
        .where({ 'an.id': noteId, 'an.project_id': projectId })
        .select('an.*', database_1.default.raw('p.name as pattern_name'))
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
    logger_1.default.debug('Audio note request received', {
        body: req.body,
        filename: req.file?.originalname
    });
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
    let patternName = null;
    if (patternId) {
        const pattern = await (0, database_1.default)('patterns')
            .where({ id: patternId, user_id: userId })
            .first();
        if (!pattern) {
            throw new errorHandler_1.NotFoundError('Pattern not found');
        }
        patternName = pattern.name;
    }
    // Generate unique filename and ensure upload directory exists
    const timestamp = Date.now();
    const ext = path_1.default.extname(file.originalname) || '.webm';
    const filename = `audio-${projectId}-${timestamp}${ext}`;
    const uploadRoot = process.env.UPLOAD_DIR || path_1.default.join(__dirname, '..', '..', 'uploads');
    const audioDir = path_1.default.join(uploadRoot, 'audio');
    await fs_1.default.promises.mkdir(audioDir, { recursive: true });
    const filepath = path_1.default.join(audioDir, filename);
    // Save audio file
    await fs_1.default.promises.writeFile(filepath, file.buffer);
    // Create audioUrl (relative path for serving)
    const audioUrl = `/uploads/audio/${filename}`;
    // Auto-transcribe when no transcription was provided
    let finalTranscription = transcription || null;
    if (!finalTranscription) {
        const normalizedContentType = file.mimetype ||
            (ext === '.mp3'
                ? 'audio/mpeg'
                : ext === '.m4a'
                    ? 'audio/mp4'
                    : ext === '.wav'
                        ? 'audio/wav'
                        : 'audio/webm');
        finalTranscription = await transcriptionService_1.default.transcribeFromFile(filepath, normalizedContentType);
    }
    if (!finalTranscription) {
        finalTranscription = 'Transcription pending review';
    }
    const [audioNote] = await (0, database_1.default)('audio_notes')
        .insert({
        project_id: projectId,
        pattern_id: patternId || null,
        audio_url: audioUrl,
        transcription: finalTranscription,
        duration_seconds: durationSeconds || 0,
        created_at: new Date(),
    })
        .returning('*');
    const responseNote = patternName
        ? { ...audioNote, pattern_name: patternName }
        : audioNote;
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
        data: { audioNote: responseNote },
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
    // Allow updating or clearing pattern linkage with ownership validation
    let patternName = null;
    if (updates.patternId !== undefined) {
        if (!updates.patternId) {
            updateData.pattern_id = null;
        }
        else {
            const pattern = await (0, database_1.default)('patterns')
                .where({ id: updates.patternId, user_id: userId })
                .first();
            if (!pattern) {
                throw new errorHandler_1.NotFoundError('Pattern not found');
            }
            updateData.pattern_id = updates.patternId;
            patternName = pattern.name;
        }
    }
    // If no pattern update was requested, preserve the current linkage for the response
    const fallbackPatternId = updateData.pattern_id !== undefined ? updateData.pattern_id : audioNote.pattern_id;
    if (patternName === null && fallbackPatternId) {
        const pattern = await (0, database_1.default)('patterns')
            .where({ id: fallbackPatternId, user_id: userId })
            .first();
        patternName = pattern?.name || null;
    }
    const [updatedAudioNote] = await (0, database_1.default)('audio_notes')
        .where({ id: noteId })
        .update(updateData)
        .returning('*');
    const responseNote = patternName
        ? { ...updatedAudioNote, pattern_name: patternName }
        : updatedAudioNote;
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
        data: { audioNote: responseNote },
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
    const validTemplateTypes = ['gauge_swatch', 'fit_adjustment', 'yarn_substitution', 'finishing', 'finishing_techniques'];
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
    let query = (0, database_1.default)('text_notes as tn')
        .leftJoin('patterns as p', 'tn.pattern_id', 'p.id')
        .where({ 'tn.project_id': projectId })
        .select('tn.*', database_1.default.raw('p.name as pattern_name'));
    if (patternId) {
        query = query.where({ pattern_id: patternId });
    }
    const textNotes = await query.orderBy('tn.is_pinned', 'desc').orderBy('tn.created_at', 'desc');
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
    const textNote = await (0, database_1.default)('text_notes as tn')
        .leftJoin('patterns as p', 'tn.pattern_id', 'p.id')
        .where({ 'tn.id': noteId, 'tn.project_id': projectId })
        .select('tn.*', database_1.default.raw('p.name as pattern_name'))
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
    let patternName = null;
    if (patternId) {
        const pattern = await (0, database_1.default)('patterns')
            .where({ id: patternId, user_id: userId })
            .first();
        if (!pattern) {
            throw new errorHandler_1.NotFoundError('Pattern not found');
        }
        patternName = pattern.name;
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
    const responseNote = patternName
        ? { ...textNote, pattern_name: patternName }
        : textNote;
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
        data: { textNote: responseNote },
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
    let patternName = null;
    if (updates.patternId !== undefined) {
        if (!updates.patternId) {
            updateData.pattern_id = null;
        }
        else {
            const pattern = await (0, database_1.default)('patterns')
                .where({ id: updates.patternId, user_id: userId })
                .first();
            if (!pattern) {
                throw new errorHandler_1.NotFoundError('Pattern not found');
            }
            updateData.pattern_id = updates.patternId;
            patternName = pattern.name;
        }
    }
    else if (textNote.pattern_id) {
        // Keep existing linked pattern name for response
        const pattern = await (0, database_1.default)('patterns')
            .where({ id: textNote.pattern_id, user_id: userId })
            .first();
        patternName = pattern?.name || null;
    }
    const [updatedTextNote] = await (0, database_1.default)('text_notes')
        .where({ id: noteId })
        .update(updateData)
        .returning('*');
    const responseNote = patternName
        ? { ...updatedTextNote, pattern_name: patternName }
        : updatedTextNote;
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
        data: { textNote: responseNote },
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
/**
 * Handwritten Notes
 */
/**
 * Get all handwritten notes for a project
 */
async function getHandwrittenNotes(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const notes = await (0, database_1.default)('handwritten_notes')
        .where({ project_id: projectId })
        .orderBy('created_at', 'desc');
    res.json({
        success: true,
        data: { handwrittenNotes: notes },
    });
}
/**
 * Create a handwritten note (image upload)
 */
async function createHandwrittenNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { patternId, pageNumber, notes: noteText } = req.body;
    const file = req.file;
    if (!file) {
        throw new errorHandler_1.ValidationError('Image file is required');
    }
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Save image file
    const timestamp = Date.now();
    const ext = path_1.default.extname(file.originalname) || '.png';
    const filename = `handwritten-${projectId}-${timestamp}${ext}`;
    const uploadRoot = process.env.UPLOAD_DIR || path_1.default.join(__dirname, '..', '..', 'uploads');
    const notesDir = path_1.default.join(uploadRoot, 'handwritten');
    await fs_1.default.promises.mkdir(notesDir, { recursive: true });
    const filepath = path_1.default.join(notesDir, filename);
    await fs_1.default.promises.writeFile(filepath, file.buffer);
    const imageUrl = `/uploads/handwritten/${filename}`;
    const [note] = await (0, database_1.default)('handwritten_notes')
        .insert({
        project_id: projectId,
        pattern_id: patternId || null,
        image_url: imageUrl,
        original_filename: file.originalname,
        file_size: file.size,
        page_number: pageNumber || null,
        notes: noteText || null,
        created_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'handwritten_note_created',
        entityType: 'handwritten_note',
        entityId: note.id,
        newValues: note,
    });
    res.status(201).json({
        success: true,
        message: 'Handwritten note saved successfully',
        data: { handwrittenNote: note },
    });
}
/**
 * Delete a handwritten note
 */
async function deleteHandwrittenNote(req, res) {
    const userId = req.user.userId;
    const { id: projectId, noteId } = req.params;
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const note = await (0, database_1.default)('handwritten_notes')
        .where({ id: noteId, project_id: projectId })
        .first();
    if (!note) {
        throw new errorHandler_1.NotFoundError('Handwritten note not found');
    }
    // Delete the image file
    try {
        const uploadRoot = process.env.UPLOAD_DIR || path_1.default.join(__dirname, '..', '..', 'uploads');
        const filepath = path_1.default.join(uploadRoot, note.image_url.replace('/uploads/', ''));
        await fs_1.default.promises.unlink(filepath);
    }
    catch {
        // File may already be deleted
    }
    await (0, database_1.default)('handwritten_notes').where({ id: noteId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'handwritten_note_deleted',
        entityType: 'handwritten_note',
        entityId: noteId,
        oldValues: note,
    });
    res.json({
        success: true,
        message: 'Handwritten note deleted successfully',
    });
}
