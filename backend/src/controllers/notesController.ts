import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);

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

  let query = db('audio_notes')
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

  const audioNote = await db('audio_notes')
    .where({ id: noteId, project_id: projectId })
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
  const { patternId, transcription, durationSeconds, title, tags } = req.body;
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
  if (patternId) {
    const pattern = await db('patterns')
      .where({ id: patternId, user_id: userId })
      .first();

    if (!pattern) {
      throw new NotFoundError('Pattern not found');
    }
  }

  // Generate unique filename
  const timestamp = Date.now();
  const ext = path.extname(file.originalname) || '.webm';
  const filename = `audio-${projectId}-${timestamp}${ext}`;
  const filepath = path.join('uploads/audio', filename);

  // Save audio file
  await writeFileAsync(filepath, file.buffer);

  // Create audioUrl (relative path for serving)
  const audioUrl = `/uploads/audio/${filename}`;

  const [audioNote] = await db('audio_notes')
    .insert({
      project_id: projectId,
      pattern_id: patternId || null,
      audio_url: audioUrl,
      transcription: transcription || null,
      duration_seconds: durationSeconds || 0,
      title: title || null,
      tags: tags ? JSON.stringify(tags) : null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

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
    data: { audioNote },
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

  const updateData: any = { updated_at: new Date() };
  if (updates.transcription !== undefined) updateData.transcription = updates.transcription;
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.tags !== undefined) updateData.tags = JSON.stringify(updates.tags);

  const [updatedAudioNote] = await db('audio_notes')
    .where({ id: noteId })
    .update(updateData)
    .returning('*');

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
    data: { audioNote: updatedAudioNote },
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
  const { templateType, data, title } = req.body;

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
      title,
      created_at: new Date(),
      updated_at: new Date(),
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

  const updateData: any = { updated_at: new Date() };
  if (updates.data !== undefined) updateData.data = JSON.stringify(updates.data);
  if (updates.title !== undefined) updateData.title = updates.title;

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
