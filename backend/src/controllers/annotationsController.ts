/**
 * Wave 3 — annotations + QuickKey HTTP layer.
 *
 * Plain async functions that throw NotFoundError / ValidationError;
 * routes wrap with asyncHandler.
 */

import { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import {
  createAnnotation,
  listAnnotationsForCrop,
  listQuickKeysForPattern,
  setCropQuickKey,
  softDeleteAnnotation,
  updateAnnotation,
} from '../services/annotationService';
import type {
  AnnotationPayload,
  AnnotationType,
} from '../types/annotation';

// POST /api/source-files/:fileId/crops/:cropId/annotations
export async function createAnnotationHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { cropId } = req.params;
  const body = req.body as Record<string, unknown>;
  const annotationType = body.annotationType as AnnotationType;
  const payload = body.payload as AnnotationPayload;
  const annotation = await createAnnotation({
    cropId,
    userId,
    annotationType,
    payload,
  });
  res.status(201).json({ success: true, data: { annotation } });
}

// GET /api/source-files/:fileId/crops/:cropId/annotations
export async function listAnnotationsHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { cropId } = req.params;
  const annotations = await listAnnotationsForCrop(cropId, userId);
  res.json({ success: true, data: { annotations } });
}

// PATCH /api/source-files/:fileId/crops/:cropId/annotations/:id
export async function updateAnnotationHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const payload =
    'payload' in body ? (body.payload as AnnotationPayload) : undefined;
  const result = await updateAnnotation({
    annotationId: id,
    userId,
    payload,
  });
  if (!result) throw new NotFoundError('Annotation not found');
  res.json({ success: true, data: { annotation: result } });
}

// DELETE /api/source-files/:fileId/crops/:cropId/annotations/:id
export async function deleteAnnotationHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params;
  const ok = await softDeleteAnnotation(id, userId);
  if (!ok) throw new NotFoundError('Annotation not found');
  res.json({ success: true, message: 'Annotation deleted' });
}

// PATCH /api/source-files/:fileId/crops/:cropId/quickkey
export async function setQuickKeyHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { cropId } = req.params;
  const body = req.body as Record<string, unknown>;
  if (typeof body.isQuickKey !== 'boolean') {
    throw new ValidationError('isQuickKey must be a boolean');
  }
  const position =
    typeof body.position === 'number'
      ? body.position
      : body.position === null
        ? null
        : undefined;
  const label =
    typeof body.label === 'string' ? body.label : body.label === null ? null : undefined;
  const result = await setCropQuickKey({
    cropId,
    userId,
    isQuickKey: body.isQuickKey,
    position,
    label,
  });
  if (!result) throw new NotFoundError('Crop not found');
  res.json({ success: true, data: result });
}

// GET /api/patterns/:patternId/quickkeys
export async function listQuickKeysHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { patternId } = req.params;
  const quickKeys = await listQuickKeysForPattern(patternId, userId);
  res.json({ success: true, data: { quickKeys } });
}
