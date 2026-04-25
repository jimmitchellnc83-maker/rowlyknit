import {
  computeBlanket,
  computeBodyBlock,
  computeHat,
  computeMittens,
  computeScarf,
  computeShawl,
  computeSleeve,
  computeSocks,
  formatLength,
  toInches,
  type BlanketInput,
  type BlanketOutput,
  type BodyBlockInput,
  type BodyBlockOutput,
  type DesignerGauge,
  type HatInput,
  type HatOutput,
  type MeasurementUnit,
  type MittenInput,
  type MittenOutput,
  type ScarfInput,
  type ScarfOutput,
  type ShawlInput,
  type ShawlOutput,
  type SleeveInput,
  type SleeveOutput,
  type SockInput,
  type SockOutput,
} from './designerMath';
import type { ChartData } from '../components/designer/ChartGrid';
import type { ColorSwatch } from '../components/designer/ColorPalette';
import { DEFAULT_CUSTOM_SHAPE, type CustomShape } from '../types/customShape';

/**
 * Serialized Designer form + chart. Written to:
 *   - localStorage (the in-progress "current" draft)
 *   - `projects.metadata.designer` (a saved snapshot attached to a project)
 *   - `patterns.metadata.designer` (future — saved snapshot attached to a
 *     pattern in the library)
 *
 * This type is the contract between the Designer page (producer), the
 * print view (pure renderer), and Projects/Patterns (storage + embed).
 */
export interface DesignerFormSnapshot {
  unit: MeasurementUnit;
  gaugeStitches: number | '';
  gaugeRows: number | '';
  gaugeMeasurement: number | '';
  itemType: string;
  activeSection: string;

  chestCircumference: number | '';
  easeAtChest: number | '';
  totalLength: number | '';
  hemDepth: number | '';
  useWaistShaping: boolean;
  waistCircumference: number | '';
  easeAtWaist: number | '';
  waistHeightFromHem: number | '';
  useArmhole: boolean;
  armholeDepth: number | '';
  shoulderWidth: number | '';
  panelType: 'front' | 'back';
  necklineDepth: number | '';
  neckOpeningWidth: number | '';

  cuffCircumference: number | '';
  easeAtCuff: number | '';
  bicepCircumference: number | '';
  easeAtBicep: number | '';
  cuffToUnderarmLength: number | '';
  cuffDepth: number | '';

  headCircumference: number | '';
  negativeEaseAtBrim: number | '';
  hatTotalHeight: number | '';
  hatBrimDepth: number | '';
  hatCrownHeight: number | '';

  scarfWidth: number | '';
  scarfLength: number | '';
  scarfFringeLength: number | '';

  blanketWidth: number | '';
  blanketLength: number | '';
  blanketBorderDepth: number | '';

  shawlWingspan: number | '';
  shawlInitialCastOn: number | '';

  handCircumference: number | '';
  negativeEaseAtMittenCuff: number | '';
  thumbCircumference: number | '';
  mittenCuffDepth: number | '';
  cuffToThumbLength: number | '';
  thumbGussetLength: number | '';
  thumbToTipLength: number | '';
  thumbLength: number | '';

  ankleCircumference: number | '';
  negativeEaseAtSockCuff: number | '';
  footCircumference: number | '';
  sockCuffDepth: number | '';
  legLength: number | '';
  footLength: number | '';

  colors: ColorSwatch[];
  chart: ChartData | null;

  /** User-defined polygon for itemType === 'custom'. Optional in the
   *  snapshot type so older saved snapshots without a custom shape still
   *  round-trip; consumers should fall back to DEFAULT_CUSTOM_SHAPE. */
  custom?: CustomShape;
}

/** Convert form gauge + unit to the normalized DesignerGauge expected by
 *  every compute* function. */
export function normalizedGauge(f: DesignerFormSnapshot): DesignerGauge {
  const measurementIn = toInches(f.gaugeMeasurement as number, f.unit);
  return {
    stitchesPer4in: ((f.gaugeStitches as number) / measurementIn) * 4,
    rowsPer4in: ((f.gaugeRows as number) / measurementIn) * 4,
  };
}

// ---------------------------------------------------------------------------
// Per-item input builders. Each takes a (form, gauge) and produces the
// ...Input type expected by its matching compute* function.
// ---------------------------------------------------------------------------

export function buildBodyInput(f: DesignerFormSnapshot, gauge: DesignerGauge): BodyBlockInput {
  return {
    gauge,
    chestCircumference: toInches(f.chestCircumference as number, f.unit),
    easeAtChest: toInches(f.easeAtChest as number, f.unit),
    totalLength: toInches(f.totalLength as number, f.unit),
    hemDepth: toInches(f.hemDepth as number, f.unit),
    waist: f.useWaistShaping
      ? {
          waistCircumference: toInches(f.waistCircumference as number, f.unit),
          easeAtWaist: toInches(f.easeAtWaist as number, f.unit),
          waistHeightFromHem: toInches(f.waistHeightFromHem as number, f.unit),
        }
      : undefined,
    armhole: f.useArmhole
      ? {
          armholeDepth: toInches(f.armholeDepth as number, f.unit),
          shoulderWidth: toInches(f.shoulderWidth as number, f.unit),
        }
      : undefined,
    neckline:
      f.useArmhole && f.panelType === 'front'
        ? {
            necklineDepth: toInches(f.necklineDepth as number, f.unit),
            neckOpeningWidth: toInches(f.neckOpeningWidth as number, f.unit),
          }
        : undefined,
  };
}

export function buildSleeveInput(
  f: DesignerFormSnapshot,
  gauge: DesignerGauge,
  bodyArmholeInitialBindOff: number | null,
): SleeveInput {
  return {
    gauge,
    cuffCircumference: toInches(f.cuffCircumference as number, f.unit),
    easeAtCuff: toInches(f.easeAtCuff as number, f.unit),
    bicepCircumference: toInches(f.bicepCircumference as number, f.unit),
    easeAtBicep: toInches(f.easeAtBicep as number, f.unit),
    cuffToUnderarmLength: toInches(f.cuffToUnderarmLength as number, f.unit),
    cuffDepth: toInches(f.cuffDepth as number, f.unit),
    cap:
      f.useArmhole && bodyArmholeInitialBindOff !== null
        ? {
            matchingArmholeDepth: toInches(f.armholeDepth as number, f.unit),
            matchingArmholeInitialBindOff: bodyArmholeInitialBindOff,
          }
        : undefined,
  };
}

export function buildHatInput(f: DesignerFormSnapshot, gauge: DesignerGauge): HatInput {
  return {
    gauge,
    headCircumference: toInches(f.headCircumference as number, f.unit),
    negativeEaseAtBrim: toInches(f.negativeEaseAtBrim as number, f.unit),
    totalHeight: toInches(f.hatTotalHeight as number, f.unit),
    brimDepth: toInches(f.hatBrimDepth as number, f.unit),
    crownHeight: toInches(f.hatCrownHeight as number, f.unit),
  };
}

export function buildScarfInput(f: DesignerFormSnapshot, gauge: DesignerGauge): ScarfInput {
  return {
    gauge,
    width: toInches(f.scarfWidth as number, f.unit),
    length: toInches(f.scarfLength as number, f.unit),
    fringeLength: toInches(f.scarfFringeLength as number, f.unit),
  };
}

export function buildBlanketInput(f: DesignerFormSnapshot, gauge: DesignerGauge): BlanketInput {
  return {
    gauge,
    width: toInches(f.blanketWidth as number, f.unit),
    length: toInches(f.blanketLength as number, f.unit),
    borderDepth: toInches(f.blanketBorderDepth as number, f.unit),
  };
}

export function buildShawlInput(f: DesignerFormSnapshot, gauge: DesignerGauge): ShawlInput {
  return {
    gauge,
    wingspan: toInches(f.shawlWingspan as number, f.unit),
    initialCastOn: f.shawlInitialCastOn as number,
  };
}

export function buildMittenInput(f: DesignerFormSnapshot, gauge: DesignerGauge): MittenInput {
  return {
    gauge,
    handCircumference: toInches(f.handCircumference as number, f.unit),
    negativeEaseAtCuff: toInches(f.negativeEaseAtMittenCuff as number, f.unit),
    thumbCircumference: toInches(f.thumbCircumference as number, f.unit),
    cuffDepth: toInches(f.mittenCuffDepth as number, f.unit),
    cuffToThumbLength: toInches(f.cuffToThumbLength as number, f.unit),
    thumbGussetLength: toInches(f.thumbGussetLength as number, f.unit),
    thumbToTipLength: toInches(f.thumbToTipLength as number, f.unit),
    thumbLength: toInches(f.thumbLength as number, f.unit),
  };
}

export function buildSockInput(f: DesignerFormSnapshot, gauge: DesignerGauge): SockInput {
  return {
    gauge,
    ankleCircumference: toInches(f.ankleCircumference as number, f.unit),
    negativeEaseAtCuff: toInches(f.negativeEaseAtSockCuff as number, f.unit),
    footCircumference: toInches(f.footCircumference as number, f.unit),
    cuffDepth: toInches(f.sockCuffDepth as number, f.unit),
    legLength: toInches(f.legLength as number, f.unit),
    footLength: toInches(f.footLength as number, f.unit),
  };
}

// ---------------------------------------------------------------------------
// Unified compute — returns the full output bundle plus a "summary" object
// that's cheap to render (item name, finished dimensions, cast-on). Callers
// that just want a quick summary card (Project Detail, Patterns list) can
// ignore the `steps` fields; callers that render the full write-up (print
// view) use everything.
// ---------------------------------------------------------------------------

export interface DesignSummary {
  itemType: string;
  itemLabel: string;
  /** 1–3 one-line bullets describing the finished item. */
  dimensions: string[];
  /** Cast-on stitch count (if applicable for the item type). */
  castOnStitches: number | null;
}

export interface DesignCompute {
  summary: DesignSummary;
  body?: BodyBlockOutput;
  sleeve?: SleeveOutput;
  hat?: HatOutput;
  scarf?: ScarfOutput;
  blanket?: BlanketOutput;
  shawl?: ShawlOutput;
  mittens?: MittenOutput;
  socks?: SockOutput;
  /** User-defined polygon for itemType === 'custom'. */
  custom?: CustomShape;
}

const ITEM_LABELS: Record<string, string> = {
  sweater: 'Sweater',
  hat: 'Hat',
  scarf: 'Scarf',
  blanket: 'Blanket',
  shawl: 'Shawl',
  mittens: 'Mittens',
  socks: 'Socks',
  custom: 'Custom shape',
};

export function itemLabel(type: string): string {
  return ITEM_LABELS[type] ?? 'Pattern';
}

/**
 * Run the compute* functions matching the form's itemType and return a
 * bundle. Throws nothing — on error each per-item field is simply omitted
 * and the summary falls back to empty dimensions.
 */
export function computeDesign(form: DesignerFormSnapshot): DesignCompute {
  const gauge = normalizedGauge(form);
  const labelOf = itemLabel(form.itemType);

  try {
    if (form.itemType === 'sweater') {
      const body = computeBodyBlock(buildBodyInput(form, gauge));
      const sleeve = computeSleeve(
        buildSleeveInput(form, gauge, body.armholeInitialBindOffPerSide),
      );
      return {
        summary: {
          itemType: form.itemType,
          itemLabel: labelOf,
          dimensions: [
            `Chest ${formatLength(body.finishedChest, form.unit)}, length ${formatLength(body.finishedLength, form.unit)}`,
            `Sleeve to underarm ${formatLength(sleeve.finishedLength, form.unit)}${
              sleeve.finishedTotalLength !== sleeve.finishedLength
                ? ` (+ cap = ${formatLength(sleeve.finishedTotalLength, form.unit)})`
                : ''
            }`,
          ],
          castOnStitches: body.castOnStitches,
        },
        body,
        sleeve,
      };
    }
    if (form.itemType === 'hat') {
      const hat = computeHat(buildHatInput(form, gauge));
      return {
        summary: {
          itemType: form.itemType,
          itemLabel: labelOf,
          dimensions: [
            `Circumference ${formatLength(hat.finishedCircumference, form.unit)}, height ${formatLength(hat.finishedHeight, form.unit)}`,
          ],
          castOnStitches: hat.castOnStitches,
        },
        hat,
      };
    }
    if (form.itemType === 'scarf') {
      const scarf = computeScarf(buildScarfInput(form, gauge));
      return {
        summary: {
          itemType: form.itemType,
          itemLabel: labelOf,
          dimensions: [`${formatLength(scarf.finishedWidth, form.unit)} × ${formatLength(scarf.finishedLength, form.unit)}`],
          castOnStitches: scarf.castOnStitches,
        },
        scarf,
      };
    }
    if (form.itemType === 'blanket') {
      const blanket = computeBlanket(buildBlanketInput(form, gauge));
      return {
        summary: {
          itemType: form.itemType,
          itemLabel: labelOf,
          dimensions: [`${formatLength(blanket.finishedWidth, form.unit)} × ${formatLength(blanket.finishedLength, form.unit)}`],
          castOnStitches: blanket.castOnStitches,
        },
        blanket,
      };
    }
    if (form.itemType === 'shawl') {
      const shawl = computeShawl(buildShawlInput(form, gauge));
      return {
        summary: {
          itemType: form.itemType,
          itemLabel: labelOf,
          dimensions: [
            `Wingspan ${formatLength(shawl.finishedWingspan, form.unit)}, depth ${formatLength(shawl.finishedDepth, form.unit)}`,
          ],
          castOnStitches: shawl.castOnStitches,
        },
        shawl,
      };
    }
    if (form.itemType === 'mittens') {
      const mittens = computeMittens(buildMittenInput(form, gauge));
      return {
        summary: {
          itemType: form.itemType,
          itemLabel: labelOf,
          dimensions: [
            `Hand ${formatLength(mittens.finishedHandCircumference, form.unit)}, total ${formatLength(mittens.finishedLength, form.unit)}`,
          ],
          castOnStitches: mittens.castOnStitches,
        },
        mittens,
      };
    }
    if (form.itemType === 'socks') {
      const socks = computeSocks(buildSockInput(form, gauge));
      return {
        summary: {
          itemType: form.itemType,
          itemLabel: labelOf,
          dimensions: [
            `Ankle ${formatLength(socks.finishedAnkleCircumference, form.unit)}, length ${formatLength(socks.finishedTotalLength, form.unit)}`,
          ],
          castOnStitches: socks.castOnStitches,
        },
        socks,
      };
    }
    if (form.itemType === 'custom') {
      const custom = form.custom ?? DEFAULT_CUSTOM_SHAPE;
      return {
        summary: {
          itemType: form.itemType,
          itemLabel: labelOf,
          dimensions: [
            `${formatLength(custom.widthInches, form.unit)} × ${formatLength(custom.heightInches, form.unit)} (${custom.vertices.length} vertices)`,
          ],
          castOnStitches: null,
        },
        custom,
      };
    }
  } catch (e) {
    console.error('[designerSnapshot] compute error:', e);
  }

  return {
    summary: { itemType: form.itemType, itemLabel: labelOf, dimensions: [], castOnStitches: null },
  };
}
