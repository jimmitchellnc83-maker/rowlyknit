import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import logger from '../config/logger';
import fs from 'fs';
import path from 'path';
import transcriptionService from '../services/transcriptionService';

/**
 * Audio Notes
 */

/**
 * Get all audio notes for a project
 */
export async function getAudioNotes(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const { patternId } = req.query;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  let query = db('audio_notes as an')
    .leftJoin('patterns as p', 'an.pattern_id', 'p.id')
    .where({ 'an.project_id': projectId })
    .select('an.*', db.raw('p.name as pattern_name'));

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
export async function getAudioNote(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, noteId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const audioNote = await db('audio_notes as an')
    .leftJoin('patterns as p', 'an.pattern_id', 'p.id')
    .where({ 'an.id': noteId, 'an.project_id': projectId })
    .select('an.*', db.raw('p.name as pattern_name'))
    .first();

  if (!audioNote) {
    throw new NotFoundError('Audio note not found');
  }

  res.json({
    success: true,
    data: { audioNote },
  });
}

/**
 * Create an audio note
 */
export async function createAudioNote(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;

  // Debug logging
  logger.debug('Audio note request received', {
    body: req.body,
    filename: (req as any).file?.originalname
  });

  const { patternId, transcription, durationSeconds } = req.body;
  const file = (req as any).file;

  // Multer will have already uploaded the file if present
  if (!file) {
    throw new ValidationError('Audio file is required');
  }

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Verify pattern ownership if patternId is provided
  let patternName: string | null = null;
  if (patternId) {
    const pattern = await db('patterns')
      .where({ id: patternId, user_id: userId })
      .first();

    if (!pattern) {
      throw new NotFoundError('Pattern not found');
    }

    patternName = pattern.name;
  }

  // Generate unique filename and ensure upload directory exists
  const timestamp = Date.now();
  const ext = path.extname(file.originalname) || '.webm';
  const filename = `audio-${projectId}-${timestamp}${ext}`;
  const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
  const audioDir = path.join(uploadRoot, 'audio');
  await fs.promises.mkdir(audioDir, { recursive: true });

  const filepath = path.join(audioDir, filename);

  // Save audio file
  await fs.promises.writeFile(filepath, file.buffer);

  // Create audioUrl (relative path for serving)
  const audioUrl = `/uploads/audio/${filename}`;

  // Auto-transcribe when no transcription was provided
  let finalTranscription = transcription || null;
  if (!finalTranscription) {
    const normalizedContentType =
      file.mimetype ||
      (ext === '.mp3'
        ? 'audio/mpeg'
        : ext === '.m4a'
          ? 'audio/mp4'
          : ext === '.wav'
            ? 'audio/wav'
            : 'audio/webm');
    finalTranscription = await transcriptionService.transcribeFromFile(
      filepath,
      normalizedContentType
    );
  }

  if (!finalTranscription) {
    finalTranscription = 'Transcription pending review';
  }

  const [audioNote] = await db('audio_notes')
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

  await createAuditLog(req, {
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
export async function updateAudioNote(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, noteId } = req.params;
  const updates = req.body;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const audioNote = await db('audio_notes')
    .where({ id: noteId, project_id: projectId })
    .first();

  if (!audioNote) {
    throw new NotFoundError('Audio note not found');
  }

  const updateData: any = {};
  if (updates.transcription !== undefined) updateData.transcription = updates.transcription;

  // Allow updating or clearing pattern linkage with ownership validation
  let patternName: string | null = null;
  if (updates.patternId !== undefined) {
    if (!updates.patternId) {
      updateData.pattern_id = null;
    } else {
      const pattern = await db('patterns')
        .where({ id: updates.patternId, user_id: userId })
        .first();

      if (!pattern) {
        throw new NotFoundError('Pattern not found');
      }

      updateData.pattern_id = updates.patternId;
      patternName = pattern.name;
    }
  }

  // If no pattern update was requested, preserve the current linkage for the response
  const fallbackPatternId =
    updateData.pattern_id !== undefined ? updateData.pattern_id : audioNote.pattern_id;
  if (patternName === null && fallbackPatternId) {
    const pattern = await db('patterns')
      .where({ id: fallbackPatternId, user_id: userId })
      .first();
    patternName = pattern?.name || null;
  }

  const [updatedAudioNote] = await db('audio_notes')
    .where({ id: noteId })
    .update(updateData)
    .returning('*');

  const responseNote = patternName
    ? { ...updatedAudioNote, pattern_name: patternName }
    : updatedAudioNote;

  await createAuditLog(req, {
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
export async function deleteAudioNote(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, noteId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const audioNote = await db('audio_notes')
    .where({ id: noteId, project_id: projectId })
    .first();

  if (!audioNote) {
    throw new NotFoundError('Audio note not found');
  }

  await db('audio_notes').where({ id: noteId }).del();

  await createAuditLog(req, {
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
export async function getStructuredMemos(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const { templateType } = req.query;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  let query = db('structured_memos')
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
export async function getStructuredMemo(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, memoId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const memo = await db('structured_memos')
    .where({ id: memoId, project_id: projectId })
    .first();

  if (!memo) {
    throw new NotFoundError('Structured memo not found');
  }

  res.json({
    success: true,
    data: { memo },
  });
}

/**
 * Create a structured memo
 */
export async function createStructuredMemo(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const { templateType, data } = req.body;

  if (!templateType || !data) {
    throw new ValidationError('Template type and data are required');
  }

  const validTemplateTypes = ['gauge_swatch', 'fit_adjustment', 'yarn_substitution', 'finishing'];
  if (!validTemplateTypes.includes(templateType)) {
    throw new ValidationError(`Template type must be one of: ${validTemplateTypes.join(', ')}`);
  }

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const [memo] = await db('structured_memos')
    .insert({
      project_id: projectId,
      template_type: templateType,
      data: JSON.stringify(data),
      created_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
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
export async function updateStructuredMemo(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, memoId } = req.params;
  const updates = req.body;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const memo = await db('structured_memos')
    .where({ id: memoId, project_id: projectId })
    .first();

  if (!memo) {
    throw new NotFoundError('Structured memo not found');
  }

  const updateData: any = {};
  if (updates.data !== undefined) updateData.data = JSON.stringify(updates.data);

  const [updatedMemo] = await db('structured_memos')
    .where({ id: memoId })
    .update(updateData)
    .returning('*');

  await createAuditLog(req, {
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
export async function deleteStructuredMemo(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, memoId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const memo = await db('structured_memos')
    .where({ id: memoId, project_id: projectId })
    .first();

  if (!memo) {
    throw new NotFoundError('Structured memo not found');
  }

  await db('structured_memos').where({ id: memoId }).del();

  await createAuditLog(req, {
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
export async function getTextNotes(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const { patternId } = req.query;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  let query = db('text_notes as tn')
    .leftJoin('patterns as p', 'tn.pattern_id', 'p.id')
    .where({ 'tn.project_id': projectId })
    .select('tn.*', db.raw('p.name as pattern_name'));

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
export async function getTextNote(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, noteId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const textNote = await db('text_notes as tn')
    .leftJoin('patterns as p', 'tn.pattern_id', 'p.id')
    .where({ 'tn.id': noteId, 'tn.project_id': projectId })
    .select('tn.*', db.raw('p.name as pattern_name'))
    .first();

  if (!textNote) {
    throw new NotFoundError('Text note not found');
  }

  res.json({
    success: true,
    data: { textNote },
  });
}

/**
 * Create a text note
 */
export async function createTextNote(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const { title, content, patternId, tags, isPinned } = req.body;

  if (!content) {
    throw new ValidationError('Note content is required');
  }

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Verify pattern ownership if patternId is provided
  let patternName: string | null = null;
  if (patternId) {
    const pattern = await db('patterns')
      .where({ id: patternId, user_id: userId })
      .first();

    if (!pattern) {
      throw new NotFoundError('Pattern not found');
    }

    patternName = pattern.name;
  }

  const [textNote] = await db('text_notes')
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

  await createAuditLog(req, {
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
export async function updateTextNote(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, noteId } = req.params;
  const updates = req.body;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const textNote = await db('text_notes')
    .where({ id: noteId, project_id: projectId })
    .first();

  if (!textNote) {
    throw new NotFoundError('Text note not found');
  }

  const updateData: any = { updated_at: new Date() };
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.isPinned !== undefined) updateData.is_pinned = updates.isPinned;

  let patternName: string | null = null;
  if (updates.patternId !== undefined) {
    if (!updates.patternId) {
      updateData.pattern_id = null;
    } else {
      const pattern = await db('patterns')
        .where({ id: updates.patternId, user_id: userId })
        .first();

      if (!pattern) {
        throw new NotFoundError('Pattern not found');
      }

      updateData.pattern_id = updates.patternId;
      patternName = pattern.name;
    }
  } else if (textNote.pattern_id) {
    // Keep existing linked pattern name for response
    const pattern = await db('patterns')
      .where({ id: textNote.pattern_id, user_id: userId })
      .first();
    patternName = pattern?.name || null;
  }

  const [updatedTextNote] = await db('text_notes')
    .where({ id: noteId })
    .update(updateData)
    .returning('*');

  const responseNote = patternName
    ? { ...updatedTextNote, pattern_name: patternName }
    : updatedTextNote;

  await createAuditLog(req, {
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
export async function deleteTextNote(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, noteId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const textNote = await db('text_notes')
    .where({ id: noteId, project_id: projectId })
    .first();

  if (!textNote) {
    throw new NotFoundError('Text note not found');
  }

  await db('text_notes').where({ id: noteId }).del();

  await createAuditLog(req, {
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
