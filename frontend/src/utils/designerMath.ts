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

export interface ArmholeInput {
  /** Vertical distance from underarm bind-off row to shoulder seam (inches).
   *  Typical adult sweater: 7–9 in. */
  armholeDepth: number;
  /** Width across each shoulder, one side (inches). Shoulder ends at the
   *  neck opening on the body side and at the sleeve seam on the outer side.
   *  Typical adult: 4–6 in. */
  shoulderWidth: number;
}

export interface NecklineInput {
  /** How far the scoop drops from the shoulder seam (inches). Crew neck is
   *  usually 2–3 in; scoop / U-neck 4–6 in. */
  necklineDepth: number;
  /** Width of the bound-off base of the neck opening (inches). Crew: 6–8 in. */
  neckOpeningWidth: number;
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
  /**
   * Optional set-in-sleeve armhole shaping. When present, the top
   * `armholeDepth` inches of the piece narrow from chest width to shoulder
   * width via an initial underarm bind-off + tapered decreases. Pairs with
   * a matching sleeve cap (see SleeveInput.cap).
   */
  armhole?: ArmholeInput;
  /**
   * Optional crew-style neckline on the front panel. Only meaningful when
   * `armhole` is also set (the neckline happens within the armhole section
   * above the taper). If you're designing the back panel, leave this out.
   */
  neckline?: NecklineInput;
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
  /** When armhole shaping is present: initial bind-off per side (each
   *  armhole edge). Used by the sleeve-cap math to keep the underarm seam
   *  aligned. Null when no armhole shaping is requested. */
  armholeInitialBindOffPerSide: number | null;
  /** Total stitches at the shoulder seam (2 × shoulderStitches + neckOpeningStitches)
   *  when armhole is present. Null otherwise. */
  shoulderSeamStitches: number | null;
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
 * A body block is one panel of a torso. Back panel: leave `neckline` unset.
 * Front panel: provide `neckline` to shape the crew / scoop neckline above
 * the armhole. Set-in-sleeve armholes are optional — when omitted the panel
 * is a simple rectangle to the shoulder (drop-shoulder / modified-drop construction).
 *
 * The output feeds both the SVG schematic and the instructions card.
 */
export function computeBodyBlock(input: BodyBlockInput): BodyBlockOutput {
  const { gauge, chestCircumference, easeAtChest, totalLength, hemDepth, waist, armhole, neckline } = input;

  // Each panel is half the circumference. Cast-on is a front-or-back panel,
  // which is where we size for.
  const finishedChest = chestCircumference + easeAtChest;
  const finishedWaist = waist ? waist.waistCircumference + waist.easeAtWaist : null;

  const panelChestWidth = finishedChest / 2;
  const panelWaistWidth = finishedWaist !== null ? finishedWaist / 2 : null;

  const chestStitches = stitchesForWidth(panelChestWidth, gauge);
  const waistStitches =
    panelWaistWidth !== null ? stitchesForWidth(panelWaistWidth, gauge) : null;
  const castOnStitches = chestStitches;

  const hemRows = rowsForLength(hemDepth, gauge);
  const totalRows = rowsForLength(totalLength, gauge);
  const armholeDepthRows = armhole ? rowsForLength(armhole.armholeDepth, gauge) : 0;
  // bodyCoreRows = hem→armhole section (includes optional waist shaping).
  // When no armhole, this covers the full cast-on → shoulder span.
  const bodyCoreRows = Math.max(0, totalRows - hemRows - armholeDepthRows);

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

  // Body core — hem up to where the armhole shaping starts (or the shoulder
  // seam, if no armhole shaping is requested).
  if (waist && waistStitches !== null) {
    const waistRowTotal = rowsForLength(waist.waistHeightFromHem, gauge);
    const belowWaistRows = Math.max(0, waistRowTotal - hemRows);
    const aboveWaistRows = Math.max(0, bodyCoreRows - belowWaistRows);

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
  } else if (bodyCoreRows > 0) {
    steps.push({
      label: armhole ? 'Hem to armhole' : 'Hem to shoulder',
      startStitches: castOnStitches,
      endStitches: chestStitches,
      rows: bodyCoreRows,
      direction: 'none',
      instruction: `Work straight for ${bodyCoreRows} row${bodyCoreRows === 1 ? '' : 's'}.`,
    });
  }

  // Armhole + neckline + shoulder (if armhole shaping is requested).
  let armholeInitialBindOffPerSide: number | null = null;
  let shoulderSeamStitches: number | null = null;

  if (armhole) {
    // Initial underarm bind-off: ~10% of the panel width per side, minimum 2,
    // rounded to an even number so bind-offs match on front/back.
    const rawBindOff = chestStitches * 0.1;
    armholeInitialBindOffPerSide = Math.max(2, roundToEven(rawBindOff / 2));

    const afterInitialBindOff = chestStitches - 2 * armholeInitialBindOffPerSide;

    const shoulderStitches = stitchesForWidth(armhole.shoulderWidth, gauge);
    const neckOpeningStitches = neckline ? stitchesForWidth(neckline.neckOpeningWidth, gauge) : 0;
    shoulderSeamStitches = 2 * shoulderStitches + neckOpeningStitches;

    // Step: the 2 initial-bind-off rows (RS, then WS).
    steps.push({
      label: 'Armhole — initial bind-off',
      startStitches: chestStitches,
      endStitches: afterInitialBindOff,
      rows: 2,
      direction: 'decrease',
      instruction:
        `Bind off ${armholeInitialBindOffPerSide} sts at the beginning of the next 2 rows ` +
        `(one each armhole edge). ${2 * armholeInitialBindOffPerSide} sts removed total.`,
    });

    const necklineDepthRows = neckline ? rowsForLength(neckline.necklineDepth, gauge) : 0;
    // Tapered decreases happen between the initial bind-off and the start of
    // the neckline (or the shoulder seam if no neckline).
    const taperRows = Math.max(0, armholeDepthRows - 2 - necklineDepthRows);
    if (taperRows > 0 && afterInitialBindOff !== shoulderSeamStitches) {
      const f = buildShapingFormula(afterInitialBindOff, shoulderSeamStitches, taperRows, 'armhole taper');
      steps.push({
        label: 'Armhole — taper',
        startStitches: afterInitialBindOff,
        endStitches: shoulderSeamStitches,
        rows: taperRows,
        direction: f.direction,
        instruction: f.instruction,
      });
    }

    // Neckline: bind off center, then work each shoulder separately.
    if (neckline && necklineDepthRows > 0 && neckOpeningStitches > 0) {
      steps.push({
        label: 'Neckline — center bind-off',
        startStitches: shoulderSeamStitches,
        endStitches: shoulderSeamStitches - neckOpeningStitches,
        rows: 1,
        direction: 'decrease',
        instruction:
          `Work to center ${neckOpeningStitches} sts, bind off those sts, then continue each ` +
          `shoulder separately. Each shoulder starts with ${shoulderStitches} sts.`,
      });
      // Optional neckline curve — decrease 1 st at neck edge every RS row a
      // few times to round the scoop. For a crew neck: 2–4 decreases per side
      // over necklineDepthRows. Keep it terse at this level; knitters adjust.
      const curveEvents = Math.min(4, Math.floor(necklineDepthRows / 4));
      if (curveEvents > 0) {
        steps.push({
          label: 'Neckline — shape each shoulder',
          startStitches: shoulderStitches,
          endStitches: shoulderStitches - curveEvents,
          rows: necklineDepthRows - 1,
          direction: 'decrease',
          instruction:
            `On each shoulder: dec 1 st at neck edge every other row × ${curveEvents}, ` +
            `then work even until the piece measures ${round025(armhole.armholeDepth)} in ` +
            `from the underarm bind-off.`,
        });
      }
    }

    // Shoulder bind-off.
    if (neckline && neckOpeningStitches > 0) {
      const finalPerShoulder = Math.max(
        0,
        shoulderStitches - Math.min(4, Math.floor(necklineDepthRows / 4)),
      );
      steps.push({
        label: 'Shoulder bind-off',
        startStitches: finalPerShoulder,
        endStitches: 0,
        rows: 1,
        direction: 'none',
        instruction: `Bind off remaining ${finalPerShoulder} sts on each shoulder.`,
      });
    } else {
      steps.push({
        label: 'Shoulder bind-off',
        startStitches: shoulderSeamStitches,
        endStitches: 0,
        rows: 1,
        direction: 'none',
        instruction: `Bind off all ${shoulderSeamStitches} sts loosely across the shoulder.`,
      });
    }
  } else {
    // No armhole shaping — straight bind-off at the top.
    steps.push({
      label: 'Bind off',
      startStitches: chestStitches,
      endStitches: 0,
      rows: 1,
      direction: 'none',
      instruction: `Bind off all ${chestStitches} sts loosely.`,
    });
  }

  return {
    castOnStitches,
    totalRows,
    hemRows,
    finishedLength: round025(totalLength),
    finishedChest: round025(finishedChest),
    finishedWaist: finishedWaist !== null ? round025(finishedWaist) : null,
    armholeInitialBindOffPerSide,
    shoulderSeamStitches,
    steps,
  };
}

// ---------------------------------------------------------------------------
// Sleeve
// ---------------------------------------------------------------------------

export interface SleeveCapInput {
  /** The body's armhole depth — cap matches this (inches). */
  matchingArmholeDepth: number;
  /** The body's initial armhole bind-off per side (stitches). Keeping these
   *  equal means the underarm seam stays aligned. Read from
   *  `BodyBlockOutput.armholeInitialBindOffPerSide`. */
  matchingArmholeInitialBindOff: number;
}

export interface SleeveInput {
  gauge: DesignerGauge;
  /** Wrist/cuff circumference (inches). */
  cuffCircumference: number;
  /** Positive ease = roomier cuff. */
  easeAtCuff: number;
  /** Upper-arm (bicep) circumference. */
  bicepCircumference: number;
  /** Ease at the bicep — usually tighter than the body for mobility. */
  easeAtBicep: number;
  /** Total sleeve length from cuff edge to underarm (inches). */
  cuffToUnderarmLength: number;
  /** Ribbing / cuff depth where no shaping happens (inches). */
  cuffDepth: number;
  /**
   * Optional set-in-sleeve cap shaping. When set, the cap sits above the
   * bicep and tapers to a narrow top edge ready to seam into the body's
   * armhole. Pair with a body that has matching `armhole` shaping.
   */
  cap?: SleeveCapInput;
}

export interface SleeveOutput {
  castOnStitches: number;
  bicepStitches: number;
  totalRows: number;
  cuffRows: number;
  finishedCuff: number;
  finishedBicep: number;
  finishedLength: number;
  /** Total sleeve length including cap (inches), when cap is present. */
  finishedTotalLength: number;
  /** Stitches remaining at the top of the cap (what gets bound off last).
   *  Null when no cap shaping is requested. */
  capTopStitches: number | null;
  /** Knit-order: cuff cast-on → cuff ribbing → taper → bicep → optional cap. */
  steps: ShapingStep[];
}

/**
 * A simple tapered sleeve — cuff at the bottom, gradually increases to the
 * bicep just below the underarm. v1 stops at the underarm; sleeve-cap
 * shaping (which connects to the yoke/armhole) comes in the yoke PR so we
 * can model the cap against a known armhole depth.
 *
 * Assumes flat-knit symmetric seam shaping (increase 1 st each end every N
 * rows). In-the-round sleeves use the same formula with the caveat that
 * "each end" means at the underarm stitch on each side of the marker —
 * the pattern language is identical.
 */
export function computeSleeve(input: SleeveInput): SleeveOutput {
  const {
    gauge,
    cuffCircumference,
    easeAtCuff,
    bicepCircumference,
    easeAtBicep,
    cuffToUnderarmLength,
    cuffDepth,
    cap,
  } = input;

  const finishedCuff = cuffCircumference + easeAtCuff;
  const finishedBicep = bicepCircumference + easeAtBicep;

  const castOnStitches = stitchesForWidth(finishedCuff, gauge);
  const bicepStitches = stitchesForWidth(finishedBicep, gauge);

  const cuffRows = rowsForLength(cuffDepth, gauge);
  const totalRows = rowsForLength(cuffToUnderarmLength, gauge);
  const taperRows = Math.max(0, totalRows - cuffRows);

  const steps: ShapingStep[] = [];

  if (cuffRows > 0) {
    steps.push({
      label: 'Cuff',
      startStitches: castOnStitches,
      endStitches: castOnStitches,
      rows: cuffRows,
      direction: 'none',
      instruction:
        `Cast on ${castOnStitches} sts. Work in pattern (e.g. 1×1 rib) for ` +
        `${cuffRows} row${cuffRows === 1 ? '' : 's'}.`,
    });
  }

  if (taperRows > 0) {
    const f = buildShapingFormula(castOnStitches, bicepStitches, taperRows, 'sleeve taper');
    steps.push({
      label: 'Taper to bicep',
      startStitches: castOnStitches,
      endStitches: bicepStitches,
      rows: taperRows,
      direction: f.direction,
      instruction: f.instruction,
    });
  }

  // Optional set-in sleeve cap. Structure: initial bind-off at each underarm
  // edge that matches the body's armhole bind-off → tapered decreases up
  // through ~80% of the armhole depth → narrow top bind-off.
  let capTopStitches: number | null = null;
  let capRowsTotal = 0;

  if (cap) {
    // Cap height is typically 80% of the armhole depth (the curved bell
    // eats some length versus a straight top).
    capRowsTotal = rowsForLength(cap.matchingArmholeDepth * 0.8, gauge);
    const capInitial = cap.matchingArmholeInitialBindOff;
    const afterCapInitial = Math.max(0, bicepStitches - 2 * capInitial);

    // Top of cap is typically 2 in wide — the "neck" that gets seamed at
    // the very top of the shoulder.
    const capTopTarget = stitchesForWidth(2, gauge);
    capTopStitches = Math.min(afterCapInitial, capTopTarget);

    const capTaperRows = Math.max(0, capRowsTotal - 2 - 1); // 2 initial bind-off rows, 1 final
    steps.push({
      label: 'Cap — initial bind-off',
      startStitches: bicepStitches,
      endStitches: afterCapInitial,
      rows: 2,
      direction: 'decrease',
      instruction:
        `Bind off ${capInitial} sts at the beginning of the next 2 rows (matches the body's ` +
        `armhole bind-off). ${2 * capInitial} sts removed total.`,
    });

    if (capTaperRows > 0 && afterCapInitial !== capTopStitches) {
      const f = buildShapingFormula(afterCapInitial, capTopStitches, capTaperRows, 'cap taper');
      steps.push({
        label: 'Cap — taper',
        startStitches: afterCapInitial,
        endStitches: capTopStitches,
        rows: capTaperRows,
        direction: f.direction,
        instruction: f.instruction,
      });
    }

    steps.push({
      label: 'Cap — top bind-off',
      startStitches: capTopStitches,
      endStitches: 0,
      rows: 1,
      direction: 'none',
      instruction: `Bind off remaining ${capTopStitches} sts loosely across the top of the cap.`,
    });
  } else {
    steps.push({
      label: 'Underarm',
      startStitches: bicepStitches,
      endStitches: 0,
      rows: 1,
      direction: 'none',
      instruction:
        taperRows > 0
          ? `Bind off all ${bicepStitches} sts (or place on a holder if joining to the body for a seamless yoke).`
          : `Bind off all ${bicepStitches} sts.`,
    });
  }

  const finishedTotalLength = cap
    ? round025(cuffToUnderarmLength + cap.matchingArmholeDepth * 0.8)
    : round025(cuffToUnderarmLength);

  return {
    castOnStitches,
    bicepStitches,
    totalRows: totalRows + capRowsTotal,
    cuffRows,
    finishedCuff: round025(finishedCuff),
    finishedBicep: round025(finishedBicep),
    finishedLength: round025(cuffToUnderarmLength),
    finishedTotalLength,
    capTopStitches,
    steps,
  };
}

// ---------------------------------------------------------------------------
// Hat
// ---------------------------------------------------------------------------

export interface HatInput {
  gauge: DesignerGauge;
  /** Head circumference at the fullest (forehead) point (inches). */
  headCircumference: number;
  /** Negative ease at the brim — subtracts from head circumference for a
   *  snug fit. Typical beanie: 1–2 in of negative ease. */
  negativeEaseAtBrim: number;
  /** Total hat height from cast-on to crown peak (inches). */
  totalHeight: number;
  /** Brim / ribbing depth from cast-on (inches). */
  brimDepth: number;
  /** Crown shaping section height (inches). Typical 2–3 in. */
  crownHeight: number;
}

export interface HatOutput {
  castOnStitches: number;
  brimRows: number;
  bodyRows: number;
  crownRows: number;
  crownEndStitches: number;
  finishedCircumference: number;
  finishedHeight: number;
  steps: ShapingStep[];
}

/**
 * A simple top-down-or-bottom-up beanie worked in the round. v1 is
 * deliberately terse on the crown shaping — it reports the total decrease
 * count and rough cadence guidance, leaving per-round spacing to the
 * knitter (8 decreases every other round is the canonical pattern). More
 * prescriptive crown formulas (star, spiral, split decreases) can layer in
 * later once the multi-item framework is in place.
 */
export function computeHat(input: HatInput): HatOutput {
  const { gauge, headCircumference, negativeEaseAtBrim, totalHeight, brimDepth, crownHeight } = input;

  const finishedCircumference = Math.max(1, headCircumference - negativeEaseAtBrim);
  const castOnStitches = stitchesForWidth(finishedCircumference, gauge);

  const brimRows = rowsForLength(brimDepth, gauge);
  const crownRows = rowsForLength(crownHeight, gauge);
  const bodyRows = Math.max(0, rowsForLength(totalHeight, gauge) - brimRows - crownRows);

  // Canonical closing stitch count — small enough to thread through with a
  // tapestry needle and cinch shut. Round to a multiple of 8 when possible
  // since most crown patterns use 8 decrease points.
  const crownEndStitches = 8;

  const steps: ShapingStep[] = [];

  if (brimRows > 0) {
    steps.push({
      label: 'Brim',
      startStitches: castOnStitches,
      endStitches: castOnStitches,
      rows: brimRows,
      direction: 'none',
      instruction:
        `Cast on ${castOnStitches} sts and join to work in the round. Work 2×2 rib (or ` +
        `pattern of choice) for ${brimRows} round${brimRows === 1 ? '' : 's'} ` +
        `(~${round025(brimDepth)} in).`,
    });
  }

  if (bodyRows > 0) {
    steps.push({
      label: 'Body',
      startStitches: castOnStitches,
      endStitches: castOnStitches,
      rows: bodyRows,
      direction: 'none',
      instruction:
        `Continue in stockinette (or pattern of choice) for ${bodyRows} round` +
        `${bodyRows === 1 ? '' : 's'} (~${round025(totalHeight - brimDepth - crownHeight)} in).`,
    });
  }

  const totalDecreases = Math.max(0, castOnStitches - crownEndStitches);
  steps.push({
    label: 'Crown decreases',
    startStitches: castOnStitches,
    endStitches: crownEndStitches,
    rows: crownRows,
    direction: 'decrease',
    instruction:
      `Decrease ${totalDecreases} sts evenly over ${crownRows} round` +
      `${crownRows === 1 ? '' : 's'} (~${round025(crownHeight)} in). Common cadence: 8 ` +
      `decrease points spaced equally around, alternated with plain rounds, tapering faster ` +
      `as you approach the top. End with ${crownEndStitches} sts.`,
  });

  steps.push({
    label: 'Close crown',
    startStitches: crownEndStitches,
    endStitches: 0,
    rows: 1,
    direction: 'none',
    instruction:
      `Cut yarn leaving a ~10 in tail. Thread through remaining ${crownEndStitches} sts and ` +
      `pull tight to close the crown. Weave in the tail on the inside.`,
  });

  return {
    castOnStitches,
    brimRows,
    bodyRows,
    crownRows,
    crownEndStitches,
    finishedCircumference: round025(finishedCircumference),
    finishedHeight: round025(totalHeight),
    steps,
  };
}

// ---------------------------------------------------------------------------
// Scarf
// ---------------------------------------------------------------------------

export interface ScarfInput {
  gauge: DesignerGauge;
  /** Finished scarf width (inches). */
  width: number;
  /** Finished scarf length (inches). */
  length: number;
  /** Optional fringe length per side (inches). 0 = no fringe. */
  fringeLength?: number;
}

export interface ScarfOutput {
  castOnStitches: number;
  totalRows: number;
  finishedWidth: number;
  finishedLength: number;
  fringeLength: number;
  steps: ShapingStep[];
}

/**
 * The simplest item — a flat rectangle. Cast on width × gauge, knit straight
 * for length × gauge rows, bind off. Optional knotted fringe on each end.
 */
export function computeScarf(input: ScarfInput): ScarfOutput {
  const { gauge, width, length } = input;
  const fringeLength = input.fringeLength ?? 0;

  const castOnStitches = stitchesForWidth(width, gauge);
  const totalRows = rowsForLength(length, gauge);

  const steps: ShapingStep[] = [
    {
      label: 'Cast on',
      startStitches: 0,
      endStitches: castOnStitches,
      rows: 1,
      direction: 'none',
      instruction:
        `Cast on ${castOnStitches} sts. Any stretchy cast-on works — long-tail, German twisted, ` +
        `or tubular for a neater edge.`,
    },
    {
      label: 'Body',
      startStitches: castOnStitches,
      endStitches: castOnStitches,
      rows: totalRows,
      direction: 'none',
      instruction:
        `Work straight for ${totalRows} row${totalRows === 1 ? '' : 's'} in pattern (garter, ` +
        `stockinette, ribbed, cabled — whatever you like). Scarves look best in reversible ` +
        `stitches since the back shows as you wear it.`,
    },
    {
      label: 'Bind off',
      startStitches: castOnStitches,
      endStitches: 0,
      rows: 1,
      direction: 'none',
      instruction: `Bind off all ${castOnStitches} sts loosely in pattern.`,
    },
  ];

  if (fringeLength > 0) {
    steps.push({
      label: 'Fringe',
      startStitches: 0,
      endStitches: 0,
      rows: 0,
      direction: 'none',
      instruction:
        `Cut ${castOnStitches * 4} strands of yarn, each ${round025(fringeLength * 2 + 1)} in long. ` +
        `Fold each group of 2 strands in half, pull through a cast-on/bind-off stitch with a ` +
        `crochet hook, and knot. Trim to even. Repeat along both short ends.`,
    });
  }

  return {
    castOnStitches,
    totalRows,
    finishedWidth: round025(width),
    finishedLength: round025(length),
    fringeLength: round025(fringeLength),
    steps,
  };
}

// ---------------------------------------------------------------------------
// Blanket
// ---------------------------------------------------------------------------

export interface BlanketInput {
  gauge: DesignerGauge;
  /** Finished blanket width (inches). */
  width: number;
  /** Finished blanket length (inches). */
  length: number;
  /** Optional garter or seed-stitch border depth (inches). 0 = no border. */
  borderDepth?: number;
}

export interface BlanketOutput {
  castOnStitches: number;
  totalRows: number;
  borderRows: number;
  borderStitchesPerSide: number;
  finishedWidth: number;
  finishedLength: number;
  steps: ShapingStep[];
}

/**
 * A blanket is a big rectangle, usually with a garter or seed-stitch border
 * so the edges don't curl. Math: cast on (width × gauge), work border rows
 * straight, then body in pattern with border-stitches-per-side held in the
 * border stitch, then mirror border rows at top.
 */
export function computeBlanket(input: BlanketInput): BlanketOutput {
  const { gauge, width, length } = input;
  const borderDepth = input.borderDepth ?? 0;

  const castOnStitches = stitchesForWidth(width, gauge);
  const totalRows = rowsForLength(length, gauge);
  const borderRows = rowsForLength(borderDepth, gauge);
  const borderStitchesPerSide = borderDepth > 0 ? stitchesForWidth(borderDepth, gauge, false) : 0;

  const bodyRows = Math.max(0, totalRows - 2 * borderRows);

  const steps: ShapingStep[] = [];

  steps.push({
    label: 'Cast on',
    startStitches: 0,
    endStitches: castOnStitches,
    rows: 1,
    direction: 'none',
    instruction:
      `Cast on ${castOnStitches} sts using a stretchy method that won't pull in ` +
      `(long-tail or knitted cast-on both work well for blankets).`,
  });

  if (borderRows > 0) {
    steps.push({
      label: 'Bottom border',
      startStitches: castOnStitches,
      endStitches: castOnStitches,
      rows: borderRows,
      direction: 'none',
      instruction:
        `Work ${borderRows} row${borderRows === 1 ? '' : 's'} in border pattern (garter, seed, ` +
        `or linen stitch) across all sts.`,
    });
  }

  if (bodyRows > 0) {
    if (borderStitchesPerSide > 0) {
      steps.push({
        label: 'Body with side borders',
        startStitches: castOnStitches,
        endStitches: castOnStitches,
        rows: bodyRows,
        direction: 'none',
        instruction:
          `Work ${bodyRows} row${bodyRows === 1 ? '' : 's'}: ${borderStitchesPerSide} sts in border ` +
          `pattern, ${castOnStitches - 2 * borderStitchesPerSide} sts in main pattern, ` +
          `${borderStitchesPerSide} sts in border pattern. Keep the sides in border through the body ` +
          `to prevent curling.`,
      });
    } else {
      steps.push({
        label: 'Body',
        startStitches: castOnStitches,
        endStitches: castOnStitches,
        rows: bodyRows,
        direction: 'none',
        instruction:
          `Work ${bodyRows} row${bodyRows === 1 ? '' : 's'} straight in main pattern.`,
      });
    }
  }

  if (borderRows > 0) {
    steps.push({
      label: 'Top border',
      startStitches: castOnStitches,
      endStitches: castOnStitches,
      rows: borderRows,
      direction: 'none',
      instruction:
        `Mirror the bottom border: ${borderRows} row${borderRows === 1 ? '' : 's'} in border ` +
        `pattern across all sts.`,
    });
  }

  steps.push({
    label: 'Bind off',
    startStitches: castOnStitches,
    endStitches: 0,
    rows: 1,
    direction: 'none',
    instruction:
      `Bind off all ${castOnStitches} sts loosely in border pattern. A stretchy ` +
      `bind-off (Jeny's Surprisingly Stretchy or i-cord) keeps the top edge from pulling in.`,
  });

  return {
    castOnStitches,
    totalRows,
    borderRows,
    borderStitchesPerSide,
    finishedWidth: round025(width),
    finishedLength: round025(length),
    steps,
  };
}
