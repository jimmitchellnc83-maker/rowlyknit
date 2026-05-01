/**
 * Recipient measurements — CYC canonical body sizing schema.
 *
 * Mirrors `frontend/src/types/measurements.ts`. Storage is in inches
 * (CYC's authoritative unit). Wire format = JSONB on
 * `recipients.measurements`.
 *
 * Two responsibilities live here:
 *   1) The TypeScript shape (`RecipientMeasurements`).
 *   2) `sanitizeMeasurements` — server-side validator. The
 *      `recipients.measurements` column is JSONB so Postgres can't
 *      enforce shape; we filter any incoming object down to known
 *      keys + sane numeric ranges before persisting.
 */

export interface RecipientMeasurements {
  chest?: number;
  cbToWrist?: number;
  backWaistLength?: number;
  crossBack?: number;
  armLength?: number;
  upperArm?: number;
  armholeDepth?: number;
  waist?: number;
  hip?: number;

  footLength?: number;
  footCircumference?: number;
  sockHeight?: number;

  handCircumference?: number;
  handLength?: number;

  headCircumference?: number;
}

interface FieldRule {
  key: keyof RecipientMeasurements;
  /** Reasonable upper bound in inches — twice this is rejected as a
   *  typo (e.g. someone typing 80 instead of 8). */
  maxIn: number;
}

const FIELD_RULES: FieldRule[] = [
  { key: 'chest', maxIn: 80 },
  { key: 'cbToWrist', maxIn: 40 },
  { key: 'backWaistLength', maxIn: 40 },
  { key: 'crossBack', maxIn: 30 },
  { key: 'armLength', maxIn: 40 },
  { key: 'upperArm', maxIn: 30 },
  { key: 'armholeDepth', maxIn: 20 },
  { key: 'waist', maxIn: 80 },
  { key: 'hip', maxIn: 80 },
  { key: 'footLength', maxIn: 16 },
  { key: 'footCircumference', maxIn: 16 },
  { key: 'sockHeight', maxIn: 30 },
  { key: 'handCircumference', maxIn: 14 },
  { key: 'handLength', maxIn: 12 },
  { key: 'headCircumference', maxIn: 30 },
];

/**
 * Filter an incoming measurements object down to the canonical CYC keys
 * with positive finite values. Unknown keys are dropped silently. Values
 * outside reasonable ranges are dropped (`maxIn * 2` is the hard ceiling
 * — a value of 80in for foot length is almost certainly a typo).
 *
 * Returns an empty object when input is null / undefined / non-object —
 * never throws — so callers can write `measurements: sanitize(req.body.measurements)`
 * without guarding.
 */
export function sanitizeMeasurements(
  raw: unknown
): RecipientMeasurements {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const out: RecipientMeasurements = {};
  for (const rule of FIELD_RULES) {
    const value = input[rule.key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    if (value > rule.maxIn * 2) continue;
    out[rule.key] = value;
  }
  return out;
}
