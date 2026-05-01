/**
 * Recipient measurements — CYC canonical body sizing schema.
 *
 * Source: Craft Yarn Council of America's body sizing standards. Storage
 * is in **inches** (CYC's authoritative unit for body sizing — the cm
 * cells in CYC's plus-size charts contain transcription errors). Display
 * conversion to cm is done at the UI layer via `useMeasurementPrefs`.
 *
 * All fields are optional. A user might enter just chest + arm length to
 * knit a sweater, or just foot length + sock height for socks. Patterns
 * pull whatever fields they need from the recipient's saved profile.
 *
 * Wire format: stored as JSONB in the `recipients.measurements` column.
 */
export interface RecipientMeasurements {
  // CYC body sizing — the 9 canonical fields.
  /** Chest / bust circumference (full bust, fullest part). */
  chest?: number;
  /** Center back to wrist — neck-back to wrist with arm at side, drives
   *  raglan / drop-shoulder sleeve length. */
  cbToWrist?: number;
  /** Back waist length — neck-back to natural waist. */
  backWaistLength?: number;
  /** Cross back — shoulder seam to shoulder seam across the back. */
  crossBack?: number;
  /** Arm length — shoulder seam to wrist with arm slightly bent. */
  armLength?: number;
  /** Upper arm circumference at the bicep. */
  upperArm?: number;
  /** Armhole depth — shoulder to underarm vertically. */
  armholeDepth?: number;
  /** Waist circumference at the natural waist. */
  waist?: number;
  /** Hip circumference at the fullest part. */
  hip?: number;

  // Foot measurements — for socks and slippers.
  /** Foot length, heel to toe. */
  footLength?: number;
  /** Foot circumference at the ball of the foot. */
  footCircumference?: number;
  /** Sock height — how far up the leg the sock should reach (calf). */
  sockHeight?: number;

  // Hand measurements — for mittens and gloves.
  /** Hand circumference at the knuckles, excluding the thumb. */
  handCircumference?: number;
  /** Hand length, wrist crease to tip of middle finger. */
  handLength?: number;

  // Head — already implicit in the legacy comment; keep for hat fits.
  /** Head circumference at the widest part above the ears. */
  headCircumference?: number;
}

/** Field definitions for rendering the measurement form. Order matters
 *  — it's the order users see the inputs. */
export interface MeasurementFieldDef {
  key: keyof RecipientMeasurements;
  label: string;
  description?: string;
  /** Reasonable upper bound for a numeric input (in inches). Mainly for
   *  catching typos. */
  maxIn?: number;
  group: 'body' | 'foot' | 'hand' | 'head';
}

export const MEASUREMENT_FIELDS: MeasurementFieldDef[] = [
  // Body — CYC 9 fields, ordered by typical usage frequency for sweater
  // patterns (chest first, then the fields the Designer body block + sock
  // / mitten flows consume).
  { key: 'chest', label: 'Chest / bust', description: 'Fullest part', maxIn: 80, group: 'body' },
  { key: 'waist', label: 'Waist', maxIn: 80, group: 'body' },
  { key: 'hip', label: 'Hip', description: 'Fullest part', maxIn: 80, group: 'body' },
  { key: 'backWaistLength', label: 'Back waist length', description: 'Neck back to natural waist', maxIn: 40, group: 'body' },
  { key: 'crossBack', label: 'Cross back', description: 'Shoulder seam to shoulder seam', maxIn: 30, group: 'body' },
  { key: 'cbToWrist', label: 'Center back to wrist', description: 'Drives raglan/drop-shoulder sleeve', maxIn: 40, group: 'body' },
  { key: 'armLength', label: 'Arm length', description: 'Shoulder to wrist', maxIn: 40, group: 'body' },
  { key: 'upperArm', label: 'Upper arm', description: 'Bicep circumference', maxIn: 30, group: 'body' },
  { key: 'armholeDepth', label: 'Armhole depth', description: 'Shoulder to underarm', maxIn: 20, group: 'body' },
  // Foot
  { key: 'footLength', label: 'Foot length', description: 'Heel to toe', maxIn: 16, group: 'foot' },
  { key: 'footCircumference', label: 'Foot circumference', description: 'Ball of foot', maxIn: 16, group: 'foot' },
  { key: 'sockHeight', label: 'Sock height', description: 'How far up the calf', maxIn: 30, group: 'foot' },
  // Hand
  { key: 'handCircumference', label: 'Hand circumference', description: 'Around knuckles, excl. thumb', maxIn: 14, group: 'hand' },
  { key: 'handLength', label: 'Hand length', description: 'Wrist to middle fingertip', maxIn: 12, group: 'hand' },
  // Head
  { key: 'headCircumference', label: 'Head circumference', description: 'Above ears', maxIn: 30, group: 'head' },
];

/**
 * Strip undefined / NaN / negative values out of a measurements object so
 * the JSONB written to the DB stays clean. Returns an empty object when
 * all values are missing.
 */
export function sanitizeMeasurements(
  raw: Partial<RecipientMeasurements> | null | undefined
): RecipientMeasurements {
  if (!raw || typeof raw !== 'object') return {};
  const out: RecipientMeasurements = {};
  for (const field of MEASUREMENT_FIELDS) {
    const value = raw[field.key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    if (field.maxIn !== undefined && value > field.maxIn * 2) continue;
    out[field.key] = value;
  }
  return out;
}
