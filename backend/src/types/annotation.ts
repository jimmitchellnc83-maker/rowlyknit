/**
 * Wave 3 PDF annotations — type layer.
 *
 * Mirrors `pattern_annotations` (migration #073). Coords on every
 * payload variant are normalized 0..1 inside the parent crop's
 * rectangle (NOT the page) — so a re-rasterization at a different
 * zoom keeps annotations aligned.
 *
 * Cross-craft: pen/highlight/text/stamp are craft-neutral. Stamp's
 * `symbol` field will reference the existing chart_symbol_templates
 * for filet-style annotations once Wave 5 lands; until then anything
 * a knitter or crocheter wants to drop in works.
 */

export type AnnotationType = 'pen' | 'highlight' | 'text' | 'stamp';

export interface PenStrokePayload {
  /** Each entry is a continuous stroke: an array of { x, y } points. */
  strokes: Array<Array<{ x: number; y: number }>>;
  color: string;
  /** Width as a fraction of crop dimension (so it scales with zoom). */
  width: number;
}

export interface HighlightStrokePayload extends PenStrokePayload {
  /** Highlights are typically half-opacity; client renders accordingly. */
  opacity?: number;
}

export interface TextAnnotationPayload {
  /** Anchor in normalized 0..1 inside the crop. */
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  color?: string;
}

export interface StampAnnotationPayload {
  x: number;
  y: number;
  /** Free-form symbol id; chart_symbol_templates key when applicable. */
  symbol: string;
}

export type AnnotationPayload =
  | PenStrokePayload
  | HighlightStrokePayload
  | TextAnnotationPayload
  | StampAnnotationPayload;

export interface PatternAnnotation {
  id: string;
  patternCropId: string;
  userId: string;
  annotationType: AnnotationType;
  payload: AnnotationPayload;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PatternAnnotationRow {
  id: string;
  pattern_crop_id: string;
  user_id: string;
  annotation_type: AnnotationType;
  payload: AnnotationPayload | string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

/** Cap a payload at 1 MB so a runaway pen tool can't fill the DB. */
export const MAX_ANNOTATION_PAYLOAD_BYTES = 1024 * 1024;
