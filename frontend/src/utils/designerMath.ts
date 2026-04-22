/**
 * Parametric shaping math for the Pattern Designer.
 *
 * Given a gauge and a set of body measurements, compute stitch/row counts,
 * section dimensions, and seam shaping formulas in the form a knitter
 * recognizes ("DEC 1 ST EACH END EVERY 6 ROWS × 7").
 *
 * v1 scope is deliberately narrow: a single *body block* (torso) with an
 * optional waist shaping point. Sleeves, yoke, neckline, and bust darts come
 * in follow-up PRs. The types here are shaped so those additions can slot in
 * without refactoring the existing schematic renderer.
 *
 * All math is client-side, unit-normalized to inches internally, and pure —
 * no DOM, no state, no async. Rendering reads the result and stays dumb.
 */
import type { GaugeUnit } from './gaugeMath';

export type MeasurementUnit = GaugeUnit;

/**
 * Gauge in normalized form: stitches and rows per 4 inches. The designer page
 * converts user input (which may be in cm / 10 cm) into this shape before
 * calling any of the compute functions.
 */
export interface DesignerGauge {
  stitchesPer4in: number;
  rowsPer4in: number;
}

export interface BodyBlockInput {
  gauge: DesignerGauge;
  /** Body circumference at the fullest chest/bust measurement (inches). */
  chestCircumference: number;
  /** Positive = positive ease (loose), negative = negative ease (snug). */
  easeAtChest: number;
  /** Cast-on to shoulder seam, total piece length (inches). */
  totalLength: number;
  /** Ribbing / hem depth from cast-on edge (inches). */
  hemDepth: number;
  /**
   * Optional waist shaping. If provided, the block narrows to `waistCircumference`
   * (plus its own ease) at the waist, then returns to chest width above. If
   * omitted, the block is a simple rectangle.
   */
  waist?: {
    waistCircumference: number;
    easeAtWaist: number;
    /** Distance from cast-on edge to the narrowest point (inches). */
    waistHeightFromHem: number;
  };
}

export type ShapingDirection = 'decrease' | 'increase' | 'none';

export interface ShapingStep {
  /** Display label for this segment ("Hem", "Below waist", "Above waist"). */
  label: string;
  startStitches: number;
  endStitches: number;
  rows: number;
  direction: ShapingDirection;
  /**
   * Knitter-readable instruction. For straight sections this is the terse
   * "Work straight for N rows"; for shaped sections it's the
   * "DEC 1 ST EACH END EVERY N ROWS × K" form with a trailing straight count
   * when the decreases don't fill the available rows.
   */
  instruction: string;
}

export interface BodyBlockOutput {
  castOnStitches: number;
  totalRows: number;
  hemRows: number;
  /** Full piece length in inches, rounded to 0.25in. */
  finishedLength: number;
  /** Chest + easeAtChest, for schematic labels. */
  finishedChest: number;
  /** Waist + easeAtWaist, when waist shaping is present. */
  finishedWaist: number | null;
  /** Section-by-section shaping, top-of-piece first is NOT guaranteed;
   *  steps are listed in knitting order (cast-on upward). */
  steps: ShapingStep[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert any length measurement to inches, since the internal model is in. */
export function toInches(value: number, unit: MeasurementUnit): number {
  return unit === 'cm' ? value / 2.54 : value;
}

/** Round up to the nearest even number — pattern convention for side-seam
 *  shaping so decreases/increases can pair one-on-each-end. */
function roundToEven(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function round025(n: number): number {
  return Math.round(n * 4) / 4;
}

function stitchesForWidth(widthInches: number, gauge: DesignerGauge, even = true): number {
  const raw = (widthInches / 4) * gauge.stitchesPer4in;
  return even ? roundToEven(raw) : Math.round(raw);
}

function rowsForLength(lengthInches: number, gauge: DesignerGauge): number {
  return Math.max(0, Math.round((lengthInches / 4) * gauge.rowsPer4in));
}

/**
 * Build a seam-shaping instruction string given start/end stitch counts and
 * the number of rows available to achieve the change.
 *
 * Returns `{ events, rowsBetween, trailingStraight, instruction }`:
 *   - events = number of decrease/increase rows (each event changes 2 stitches — one each end)
 *   - rowsBetween = plain rows between events (model assumes shaping happens on the last row of each block)
 *   - trailingStraight = plain rows after the last event, before the end of the section
 *
 * If the section is straight (startStitches === endStitches) the formula is
 * just "Work straight for N rows".
 */
export interface ShapingFormula {
  direction: ShapingDirection;
  events: number;
  rowsBetween: number;
  trailingStraight: number;
  instruction: string;
}

export function buildShapingFormula(
  startStitches: number,
  endStitches: number,
  totalRows: number,
  label = 'section',
): ShapingFormula {
  if (totalRows <= 0) {
    return {
      direction: 'none',
      events: 0,
      rowsBetween: 0,
      trailingStraight: 0,
      instruction: `Skip ${label} (0 rows).`,
    };
  }

  if (startStitches === endStitches) {
    return {
      direction: 'none',
      events: 0,
      rowsBetween: 0,
      trailingStraight: totalRows,
      instruction: `Work straight for ${totalRows} row${totalRows === 1 ? '' : 's'}.`,
    };
  }

  const diff = Math.abs(endStitches - startStitches);
  // Each shaping row changes 2 sts (one each seam). Halve the diff to get
  // event count. If the diff is odd, round down and accept a 1-stitch
  // mismatch at the seam — knitters typically live with this or adjust.
  const events = Math.floor(diff / 2);

  if (events === 0) {
    return {
      direction: startStitches > endStitches ? 'decrease' : 'increase',
      events: 0,
      rowsBetween: 0,
      trailingStraight: totalRows,
      instruction: `Work straight for ${totalRows} row${totalRows === 1 ? '' : 's'}.`,
    };
  }

  // Place events evenly. If rowsBetween × events < totalRows, the remainder
  // becomes trailing straight rows.
  const rowsBetween = Math.max(2, Math.floor(totalRows / events));
  const trailingStraight = Math.max(0, totalRows - rowsBetween * events);

  const verb = startStitches > endStitches ? 'DEC' : 'INC';
  const unit = startStitches > endStitches ? 'decrease' : 'increase';
  const rowWord = rowsBetween === 1 ? 'row' : 'rows';

  let instruction = `${verb} 1 st each end every ${rowsBetween} ${rowWord} × ${events}`;
  if (trailingStraight > 0) {
    instruction += `, then work ${trailingStraight} row${trailingStraight === 1 ? '' : 's'} straight`;
  }
  instruction += `. (${unit} ${events * 2} sts total)`;

  return {
    direction: startStitches > endStitches ? 'decrease' : 'increase',
    events,
    rowsBetween,
    trailingStraight,
    instruction,
  };
}

// ---------------------------------------------------------------------------
// Main: compute the body block
// ---------------------------------------------------------------------------

/**
 * A body block is one panel of a torso (either front or back — the math is
 * symmetric). v1 computes stitches at cast-on, stitches at the waist (if
 * shaped), and rows per section. The output is designed to feed both the
 * SVG schematic and the instructions card without further math.
 */
export function computeBodyBlock(input: BodyBlockInput): BodyBlockOutput {
  const { gauge, chestCircumference, easeAtChest, totalLength, hemDepth, waist } = input;

  // Each panel is half the circumference. Cast-on is a front-or-back panel,
  // which is where we size for.
  const finishedChest = chestCircumference + easeAtChest;
  const finishedWaist = waist ? waist.waistCircumference + waist.easeAtWaist : null;

  const panelChestWidth = finishedChest / 2;
  const panelWaistWidth = finishedWaist !== null ? finishedWaist / 2 : null;

  const chestStitches = stitchesForWidth(panelChestWidth, gauge);
  const waistStitches =
    panelWaistWidth !== null ? stitchesForWidth(panelWaistWidth, gauge) : null;
  // Without waist shaping the cast-on matches the chest; with waist shaping
  // we cast on the chest width, taper to the waist, then increase back up.
  // (This is the common "A-line from hem" pattern; alternative constructions
  // can be added in a follow-up PR.)
  const castOnStitches = chestStitches;

  const hemRows = rowsForLength(hemDepth, gauge);
  const totalRows = rowsForLength(totalLength, gauge);

  const steps: ShapingStep[] = [];

  // Hem is always straight — ribbing or garter, same stitch count throughout.
  if (hemRows > 0) {
    steps.push({
      label: 'Hem',
      startStitches: castOnStitches,
      endStitches: castOnStitches,
      rows: hemRows,
      direction: 'none',
      instruction:
        `Cast on ${castOnStitches} sts. Work in pattern (e.g. 1×1 rib) for ` +
        `${hemRows} row${hemRows === 1 ? '' : 's'}.`,
    });
  }

  if (waist && waistStitches !== null) {
    const waistRowTotal = rowsForLength(waist.waistHeightFromHem, gauge);
    const belowWaistRows = Math.max(0, waistRowTotal - hemRows);
    const aboveWaistRows = Math.max(0, totalRows - hemRows - belowWaistRows);

    if (belowWaistRows > 0) {
      const f = buildShapingFormula(castOnStitches, waistStitches, belowWaistRows, 'waist decreases');
      steps.push({
        label: 'Hem to waist',
        startStitches: castOnStitches,
        endStitches: waistStitches,
        rows: belowWaistRows,
        direction: f.direction,
        instruction: f.instruction,
      });
    }

    if (aboveWaistRows > 0) {
      const f = buildShapingFormula(waistStitches, chestStitches, aboveWaistRows, 'bust increases');
      steps.push({
        label: 'Waist to bust',
        startStitches: waistStitches,
        endStitches: chestStitches,
        rows: aboveWaistRows,
        direction: f.direction,
        instruction: f.instruction,
      });
    }
  } else {
    const bodyRows = Math.max(0, totalRows - hemRows);
    if (bodyRows > 0) {
      steps.push({
        label: 'Hem to shoulder',
        startStitches: castOnStitches,
        endStitches: chestStitches,
        rows: bodyRows,
        direction: 'none',
        instruction: `Work straight for ${bodyRows} row${bodyRows === 1 ? '' : 's'}.`,
      });
    }
  }

  // Bind-off
  const bindOffStitches = waistStitches !== null ? chestStitches : castOnStitches;
  steps.push({
    label: 'Bind off',
    startStitches: bindOffStitches,
    endStitches: 0,
    rows: 1,
    direction: 'none',
    instruction: `Bind off all ${bindOffStitches} sts loosely.`,
  });

  return {
    castOnStitches,
    totalRows,
    hemRows,
    finishedLength: round025(totalLength),
    finishedChest: round025(finishedChest),
    finishedWaist: finishedWaist !== null ? round025(finishedWaist) : null,
    steps,
  };
}
