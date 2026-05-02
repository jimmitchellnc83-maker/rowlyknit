/**
 * Wave 3 annotation service.
 *
 * Storage / ownership boundary for `pattern_annotations`. Every read
 * and write is gated on the parent crop being owned by the caller —
 * controllers should re-check too, but this layer treats it as the
 * load-bearing invariant.
 *
 * Cross-craft: payloads are typed but craft-neutral. The service
 * never inspects the symbol vocabulary — knit/crochet/etc all flow
 * through the same path.
 */

import db from '../config/database';
import {
  MAX_ANNOTATION_PAYLOAD_BYTES,
  type AnnotationPayload,
  type AnnotationType,
  type PatternAnnotation,
  type PatternAnnotationRow,
} from '../types/annotation';
import { ValidationError } from '../utils/errorHandler';

const VALID_TYPES: AnnotationType[] = ['pen', 'highlight', 'text', 'stamp'];

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}
function toIsoNonNull(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function parseJsonOrPassthrough<T>(value: T | string): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value;
}

function mapRow(row: PatternAnnotationRow): PatternAnnotation {
  return {
    id: row.id,
    patternCropId: row.pattern_crop_id,
    userId: row.user_id,
    annotationType: row.annotation_type,
    payload: parseJsonOrPassthrough<AnnotationPayload>(row.payload),
    createdAt: toIsoNonNull(row.created_at),
    updatedAt: toIsoNonNull(row.updated_at),
    deletedAt: toIso(row.deleted_at),
  };
}

export function assertValidAnnotationInput(input: {
  annotationType: string;
  payload: unknown;
}): void {
  if (!VALID_TYPES.includes(input.annotationType as AnnotationType)) {
    throw new ValidationError(
      `annotationType must be one of ${VALID_TYPES.join(', ')}`
    );
  }
  if (!input.payload || typeof input.payload !== 'object') {
    throw new ValidationError('payload must be an object');
  }
  const json = JSON.stringify(input.payload);
  if (Buffer.byteLength(json, 'utf8') > MAX_ANNOTATION_PAYLOAD_BYTES) {
    throw new ValidationError(
      `payload exceeds ${MAX_ANNOTATION_PAYLOAD_BYTES}-byte cap`
    );
  }
}

export interface CreateAnnotationInput {
  cropId: string;
  userId: string;
  annotationType: AnnotationType;
  payload: AnnotationPayload;
}

export async function createAnnotation(
  input: CreateAnnotationInput
): Promise<PatternAnnotation> {
  assertValidAnnotationInput(input);
  const crop = await db('pattern_crops')
    .where({ id: input.cropId, user_id: input.userId })
    .whereNull('deleted_at')
    .first('id');
  if (!crop) {
    throw new ValidationError('crop not found for user');
  }
  const [row] = await db('pattern_annotations')
    .insert({
      pattern_crop_id: input.cropId,
      user_id: input.userId,
      annotation_type: input.annotationType,
      payload: JSON.stringify(input.payload),
    })
    .returning('*');
  return mapRow(row as PatternAnnotationRow);
}

export async function listAnnotationsForCrop(
  cropId: string,
  userId: string
): Promise<PatternAnnotation[]> {
  const rows = await db('pattern_annotations')
    .where({ pattern_crop_id: cropId, user_id: userId })
    .whereNull('deleted_at')
    .orderBy('created_at', 'asc');
  return rows.map((r) => mapRow(r as PatternAnnotationRow));
}

export async function updateAnnotation(input: {
  annotationId: string;
  userId: string;
  payload?: AnnotationPayload;
}): Promise<PatternAnnotation | null> {
  if (input.payload !== undefined) {
    assertValidAnnotationInput({
      annotationType: 'pen',
      payload: input.payload,
    });
  }
  const update: Record<string, unknown> = { updated_at: new Date() };
  if (input.payload !== undefined) update.payload = JSON.stringify(input.payload);
  const updated = await db('pattern_annotations')
    .where({ id: input.annotationId, user_id: input.userId })
    .whereNull('deleted_at')
    .update(update);
  if (updated === 0) return null;
  const row = await db('pattern_annotations')
    .where({ id: input.annotationId })
    .first();
  return row ? mapRow(row as PatternAnnotationRow) : null;
}

export async function softDeleteAnnotation(
  annotationId: string,
  userId: string
): Promise<boolean> {
  const updated = await db('pattern_annotations')
    .where({ id: annotationId, user_id: userId })
    .whereNull('deleted_at')
    .update({ deleted_at: new Date() });
  return updated > 0;
}

// ============================================
// QuickKey on pattern_crops
// ============================================

export async function setCropQuickKey(input: {
  cropId: string;
  userId: string;
  isQuickKey: boolean;
  position?: number | null;
  label?: string | null;
}): Promise<{
  isQuickKey: boolean;
  quickKeyPosition: number | null;
  label: string | null;
} | null> {
  const update: Record<string, unknown> = {
    is_quickkey: input.isQuickKey,
    updated_at: new Date(),
  };
  if (input.isQuickKey) {
    if (input.position !== undefined) update.quickkey_position = input.position;
  } else {
    update.quickkey_position = null;
  }
  if (input.label !== undefined) update.label = input.label;

  const updated = await db('pattern_crops')
    .where({ id: input.cropId, user_id: input.userId })
    .whereNull('deleted_at')
    .update(update);
  if (updated === 0) return null;
  const row = await db('pattern_crops')
    .where({ id: input.cropId })
    .first('is_quickkey', 'quickkey_position', 'label');
  if (!row) return null;
  return {
    isQuickKey: !!row.is_quickkey,
    quickKeyPosition:
      row.quickkey_position === null ? null : Number(row.quickkey_position),
    label: row.label ?? null,
  };
}

export async function listQuickKeysForPattern(
  patternId: string,
  userId: string
): Promise<
  Array<{
    cropId: string;
    label: string | null;
    quickKeyPosition: number | null;
    pageNumber: number;
  }>
> {
  const rows = await db('pattern_crops')
    .where({ pattern_id: patternId, user_id: userId, is_quickkey: true })
    .whereNull('deleted_at')
    .orderBy([
      { column: 'quickkey_position', order: 'asc' },
      { column: 'created_at', order: 'asc' },
    ])
    .select('id', 'label', 'quickkey_position', 'page_number');
  return rows.map((r) => ({
    cropId: r.id,
    label: r.label ?? null,
    quickKeyPosition:
      r.quickkey_position === null ? null : Number(r.quickkey_position),
    pageNumber: r.page_number,
  }));
}
