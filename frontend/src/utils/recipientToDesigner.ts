/**
 * Map saved recipient measurements to Designer math inputs.
 *
 * The Designer accepts user-entered measurements directly today, but with
 * the CYC schema landed (PR #314) we can offer "pre-fill from a recipient"
 * across the body block, sock, and mitten flows. These pure functions are
 * the data shim — UI layers call them with a recipient's measurements and
 * receive an `Partial<*Input>` they can spread into form state.
 *
 * Returns `Partial<>` (not the full input) because the Designer also needs
 * gauge + ease values that don't come from the recipient. The form layer
 * fills those in.
 */

import type { RecipientMeasurements } from '../types/measurements';
import type {
  BodyBlockInput,
  MittenInput,
  SockInput,
} from './designerMath';

type BodyBlockSeed = Partial<
  Pick<
    BodyBlockInput,
    'chestCircumference' | 'hip' | 'waist'
  >
>;

/**
 * CYC body-sizing fields → BodyBlockInput. Returns only the fields that
 * the recipient has on file; the form caller decides whether to enable
 * waist / hip shaping based on whether each block was populated.
 *
 * - `chest` → `chestCircumference`
 * - `hip` → `hip.hipCircumference` (with ease=0; user adjusts)
 * - `waist` + `backWaistLength` → `waist.{waistCircumference,
 *   waistHeightFromHem (= totalLength - backWaistLength, defaulting to
 *   the natural waist when totalLength is supplied)}`
 *
 * The waist mapper takes `totalLength` because waistHeightFromHem is
 * relative to the bottom of the piece — a 24in cardigan with a 17in
 * back-waist measurement has its narrowest point at hem+(24-17)=7in
 * from the top, which flips to (24-7)=17in from the hem.
 */
export function recipientToBodyBlock(
  m: RecipientMeasurements,
  opts: { totalLength?: number } = {},
): BodyBlockSeed {
  const seed: BodyBlockSeed = {};

  if (typeof m.chest === 'number' && m.chest > 0) {
    seed.chestCircumference = m.chest;
  }

  if (typeof m.hip === 'number' && m.hip > 0) {
    seed.hip = {
      hipCircumference: m.hip,
      easeAtHip: 0,
    };
  }

  if (typeof m.waist === 'number' && m.waist > 0) {
    const waistHeightFromHem =
      opts.totalLength !== undefined &&
      typeof m.backWaistLength === 'number' &&
      m.backWaistLength > 0
        ? Math.max(0, opts.totalLength - m.backWaistLength)
        : opts.totalLength !== undefined
          ? Math.max(0, opts.totalLength * 0.45)
          : undefined;
    if (waistHeightFromHem !== undefined) {
      seed.waist = {
        waistCircumference: m.waist,
        easeAtWaist: 0,
        waistHeightFromHem,
      };
    }
  }

  return seed;
}

/**
 * CYC foot-sizing fields → SockInput. Returns the dimension subset; the
 * caller still has to provide gauge, ease, and cuff depth.
 *
 * - `footLength` → `footLength`
 * - `footCircumference` → `footCircumference`
 * - `sockHeight` → `legLength` (sock height = leg above the heel)
 *
 * Defaults `ankleCircumference` to `footCircumference` when the
 * recipient hasn't recorded an ankle separately — most knitters size
 * the cuff to the foot since they coincide more often than not.
 */
export function recipientToSock(
  m: RecipientMeasurements,
): Partial<SockInput> {
  const seed: Partial<SockInput> = {};

  if (typeof m.footLength === 'number' && m.footLength > 0) {
    seed.footLength = m.footLength;
  }
  if (typeof m.footCircumference === 'number' && m.footCircumference > 0) {
    seed.footCircumference = m.footCircumference;
    // Sensible default — overridden if the user types a different ankle.
    seed.ankleCircumference = m.footCircumference;
  }
  if (typeof m.sockHeight === 'number' && m.sockHeight > 0) {
    seed.legLength = m.sockHeight;
  }

  return seed;
}

/**
 * CYC hand-sizing fields → MittenInput.
 *
 * - `handCircumference` → `handCircumference`
 * - `handLength` → split 60/40 across `cuffToThumbLength` and
 *   `thumbToTipLength`. The 60/40 is a rule-of-thumb: for an average
 *   adult hand, the wrist-to-base-of-thumb segment is roughly 60% of
 *   wrist-to-fingertip. The user can adjust both fields after pre-fill.
 *
 * Doesn't pre-fill `thumbCircumference` (CYC doesn't publish a canonical
 * thumb measurement) or thumb-length / cuff-depth fields.
 */
export function recipientToMitten(
  m: RecipientMeasurements,
): Partial<MittenInput> {
  const seed: Partial<MittenInput> = {};

  if (typeof m.handCircumference === 'number' && m.handCircumference > 0) {
    seed.handCircumference = m.handCircumference;
  }
  if (typeof m.handLength === 'number' && m.handLength > 0) {
    seed.cuffToThumbLength = +(m.handLength * 0.6).toFixed(2);
    seed.thumbToTipLength = +(m.handLength * 0.4).toFixed(2);
  }

  return seed;
}
