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

// PATCH /api/source-files/:fileId/crops/:cropId/annotations/:annotationId
//
// Parent-child invariant gate — PR #384/#385 follow-up. The route
// already runs `verifyCropBelongsToParent` (sourceFile ↔ crop), but
// pre-fix the annotationId itself was loaded by id+userId only, so
// a request like
//   PATCH /api/source-files/A/crops/B/annotations/<ann-from-crop-C>
// where crop B is owned by the user AND annotation-from-C is owned
// by the user would silently mutate the foreign annotation. The
// service layer now requires the annotation to belong to `cropId`
// too; mismatch returns 404.
export async function updateAnnotationHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  // The route wrapper aliases :annotationId onto :id for the legacy
  // controller signature; cropId is still the original :cropId param.
  const { id, cropId } = req.params;
  const body = req.body as Record<string, unknown>;
  const payload =
    'payload' in body ? (body.payload as AnnotationPayload) : undefined;
  const result = await updateAnnotation({
    annotationId: id,
    userId,
    cropId,
    payload,
  });
  if (!result) throw new NotFoundError('Annotation not found');
  res.json({ success: true, data: { annotation: result } });
}

// DELETE /api/source-files/:fileId/crops/:cropId/annotations/:annotationId
//
// Same parent-child gate as updateAnnotationHandler. A DELETE that
// mismatches the URL parent must not soft-delete the row.
export async function deleteAnnotationHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { id, cropId } = req.params;
  const ok = await softDeleteAnnotation(id, userId, cropId);
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
