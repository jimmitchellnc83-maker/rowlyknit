/**
 * Quick-start templates for the Pattern Designer. Each template targets one
 * itemType and provides a sensible measurement starting point that the
 * knitter can then customize. Values are stored in INCHES — the picker
 * converts to centimeters when the user has cm mode active so users in
 * either unit see reasonable starting numbers.
 *
 * The picker preserves user-specific fields (gauge, colors, chart) when
 * applying a template — only the measurement fields and itemType are
 * replaced.
 */

type ItemType = 'sweater' | 'hat' | 'scarf' | 'blanket' | 'shawl' | 'mittens' | 'socks';

export interface DesignerTemplate {
  id: string;
  name: string;
  /** One-line subtitle shown under the name in the picker. */
  description: string;
  itemType: ItemType;
  /** Measurement fields to merge into the form. All values in inches. */
  fields: Record<string, number | boolean | string>;
}

/**
 * Merge a template into the user's current form. Returns a new form object:
 *   - itemType is set from the template
 *   - measurement values are converted to cm if the form is in cm mode
 *     (rounded to 0.25 to match the math layer's precision)
 *   - the user's unit, gauge, colors, and chart are preserved
 *
 * Pure — does not mutate `form`. Generic over the form shape so the data
 * module doesn't need to import the page-level DesignerForm type.
 */
export function mergeTemplateIntoForm<
  F extends {
    unit: 'in' | 'cm';
    gaugeStitches: unknown;
    gaugeRows: unknown;
    gaugeMeasurement: unknown;
    colors: unknown;
    chart: unknown;
    itemType: string;
  },
>(template: DesignerTemplate, form: F): F {
  const factor = form.unit === 'cm' ? 2.54 : 1;
  const merged: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(template.fields)) {
    if (typeof v === 'number' && MEASUREMENT_FIELD_KEYS.has(k)) {
      merged[k] = Math.round(v * factor * 4) / 4;
    } else {
      merged[k] = v;
    }
  }
  return {
    ...form,
    ...merged,
    itemType: template.itemType,
    unit: form.unit,
    gaugeStitches: form.gaugeStitches,
    gaugeRows: form.gaugeRows,
    gaugeMeasurement: form.gaugeMeasurement,
    colors: form.colors,
    chart: form.chart,
  } as F;
}

/** Names of DesignerForm fields that hold a length measurement (in inches
 *  in template data; the picker converts to cm when the user is in cm
 *  mode). Booleans, stitch counts, and gauge fields are NOT in this set. */
export const MEASUREMENT_FIELD_KEYS: ReadonlySet<string> = new Set([
  'headCircumference', 'negativeEaseAtBrim', 'hatTotalHeight', 'hatBrimDepth', 'hatCrownHeight',
  'scarfWidth', 'scarfLength', 'scarfFringeLength',
  'blanketWidth', 'blanketLength', 'blanketBorderDepth',
  'shawlWingspan',
  'handCircumference', 'negativeEaseAtMittenCuff', 'thumbCircumference',
  'mittenCuffDepth', 'cuffToThumbLength', 'thumbGussetLength',
  'thumbToTipLength', 'thumbLength',
  'ankleCircumference', 'negativeEaseAtSockCuff', 'footCircumference',
  'sockCuffDepth', 'legLength', 'footLength',
  'chestCircumference', 'easeAtChest', 'totalLength', 'hemDepth',
  'waistCircumference', 'easeAtWaist', 'waistHeightFromHem',
  'armholeDepth', 'shoulderWidth', 'necklineDepth', 'neckOpeningWidth',
  'cuffCircumference', 'easeAtCuff', 'bicepCircumference', 'easeAtBicep',
  'cuffToUnderarmLength', 'cuffDepth',
]);

export const DESIGNER_TEMPLATES: DesignerTemplate[] = [
  // ---------- Sweater ----------
  {
    id: 'sweater-adult-pullover',
    name: 'Adult crewneck pullover',
    description: '36" chest, drop-shoulder, no waist shaping',
    itemType: 'sweater',
    fields: {
      chestCircumference: 36, easeAtChest: 4, totalLength: 24, hemDepth: 2,
      useWaistShaping: false,
      useArmhole: false, armholeDepth: 8, shoulderWidth: 5,
      panelType: 'back',
      cuffCircumference: 7, easeAtCuff: 1, bicepCircumference: 12, easeAtBicep: 2,
      cuffToUnderarmLength: 18, cuffDepth: 2,
    },
  },
  {
    id: 'sweater-adult-fitted',
    name: 'Adult fitted pullover',
    description: '36" chest, hourglass with set-in sleeves',
    itemType: 'sweater',
    fields: {
      chestCircumference: 36, easeAtChest: 2, totalLength: 23, hemDepth: 2,
      useWaistShaping: true, waistCircumference: 30, easeAtWaist: 2, waistHeightFromHem: 8,
      useArmhole: true, armholeDepth: 8, shoulderWidth: 5,
      panelType: 'front', necklineDepth: 3, neckOpeningWidth: 7,
      cuffCircumference: 7, easeAtCuff: 1, bicepCircumference: 11, easeAtBicep: 2,
      cuffToUnderarmLength: 18, cuffDepth: 2.5,
    },
  },
  {
    id: 'sweater-oversized',
    name: 'Oversized pullover',
    description: '44" chest, dropped shoulder, longer body',
    itemType: 'sweater',
    fields: {
      chestCircumference: 36, easeAtChest: 8, totalLength: 26, hemDepth: 2.5,
      useWaistShaping: false,
      useArmhole: false, armholeDepth: 9, shoulderWidth: 6,
      panelType: 'back',
      cuffCircumference: 8, easeAtCuff: 1, bicepCircumference: 13, easeAtBicep: 3,
      cuffToUnderarmLength: 17, cuffDepth: 2,
    },
  },
  {
    id: 'sweater-cropped',
    name: 'Cropped pullover',
    description: '34" chest, body ends just below waist',
    itemType: 'sweater',
    fields: {
      chestCircumference: 34, easeAtChest: 3, totalLength: 18, hemDepth: 1.5,
      useWaistShaping: false,
      useArmhole: true, armholeDepth: 7.5, shoulderWidth: 5,
      panelType: 'front', necklineDepth: 2.5, neckOpeningWidth: 6.5,
      cuffCircumference: 7, easeAtCuff: 1, bicepCircumference: 11, easeAtBicep: 2,
      cuffToUnderarmLength: 17, cuffDepth: 2,
    },
  },
  {
    id: 'sweater-kids',
    name: "Kid's pullover (size 8)",
    description: '28" chest, drop-shoulder',
    itemType: 'sweater',
    fields: {
      chestCircumference: 28, easeAtChest: 3, totalLength: 17, hemDepth: 1.5,
      useWaistShaping: false,
      useArmhole: false, armholeDepth: 6.5, shoulderWidth: 4,
      panelType: 'back',
      cuffCircumference: 6, easeAtCuff: 0.5, bicepCircumference: 9, easeAtBicep: 1.5,
      cuffToUnderarmLength: 12, cuffDepth: 1.5,
    },
  },

  // ---------- Hat ----------
  {
    id: 'hat-adult-beanie',
    name: 'Adult beanie',
    description: '22" head, 9" tall, 2" brim',
    itemType: 'hat',
    fields: {
      headCircumference: 22, negativeEaseAtBrim: 1.5,
      hatTotalHeight: 9, hatBrimDepth: 2, hatCrownHeight: 2.5,
    },
  },
  {
    id: 'hat-slouchy',
    name: 'Slouchy beanie',
    description: '22" head, 11" tall for extra slouch',
    itemType: 'hat',
    fields: {
      headCircumference: 22, negativeEaseAtBrim: 1,
      hatTotalHeight: 11, hatBrimDepth: 2.5, hatCrownHeight: 3,
    },
  },
  {
    id: 'hat-watch-cap',
    name: 'Watch cap (close-fitting)',
    description: '22" head, 7.5" tall, snug brim',
    itemType: 'hat',
    fields: {
      headCircumference: 22, negativeEaseAtBrim: 2,
      hatTotalHeight: 7.5, hatBrimDepth: 2.5, hatCrownHeight: 2,
    },
  },
  {
    id: 'hat-kids',
    name: "Kid's hat (4–8 yr)",
    description: '20" head, 7.5" tall',
    itemType: 'hat',
    fields: {
      headCircumference: 20, negativeEaseAtBrim: 1,
      hatTotalHeight: 7.5, hatBrimDepth: 1.5, hatCrownHeight: 2,
    },
  },
  {
    id: 'hat-baby',
    name: 'Baby hat (6–12 mo)',
    description: '17" head, 6" tall',
    itemType: 'hat',
    fields: {
      headCircumference: 17, negativeEaseAtBrim: 0.5,
      hatTotalHeight: 6, hatBrimDepth: 1, hatCrownHeight: 1.5,
    },
  },

  // ---------- Scarf ----------
  {
    id: 'scarf-classic',
    name: 'Classic scarf',
    description: '8" × 60", no fringe',
    itemType: 'scarf',
    fields: { scarfWidth: 8, scarfLength: 60, scarfFringeLength: 0 },
  },
  {
    id: 'scarf-fringed',
    name: 'Fringed scarf',
    description: '8" × 60", 4" fringe each end',
    itemType: 'scarf',
    fields: { scarfWidth: 8, scarfLength: 60, scarfFringeLength: 4 },
  },
  {
    id: 'scarf-wide-wrap',
    name: 'Wide wrap',
    description: '14" × 72", drape over shoulders',
    itemType: 'scarf',
    fields: { scarfWidth: 14, scarfLength: 72, scarfFringeLength: 0 },
  },
  {
    id: 'scarf-skinny',
    name: 'Skinny neck scarf',
    description: '4" × 50", layering piece',
    itemType: 'scarf',
    fields: { scarfWidth: 4, scarfLength: 50, scarfFringeLength: 0 },
  },

  // ---------- Blanket ----------
  {
    id: 'blanket-baby',
    name: 'Baby blanket',
    description: '30" × 36", 1.5" border',
    itemType: 'blanket',
    fields: { blanketWidth: 30, blanketLength: 36, blanketBorderDepth: 1.5 },
  },
  {
    id: 'blanket-lap',
    name: 'Lap blanket',
    description: '40" × 50", 2" border',
    itemType: 'blanket',
    fields: { blanketWidth: 40, blanketLength: 50, blanketBorderDepth: 2 },
  },
  {
    id: 'blanket-throw',
    name: 'Throw',
    description: '48" × 60", 2" border',
    itemType: 'blanket',
    fields: { blanketWidth: 48, blanketLength: 60, blanketBorderDepth: 2 },
  },
  {
    id: 'blanket-twin',
    name: 'Twin bed blanket',
    description: '66" × 90", 3" border',
    itemType: 'blanket',
    fields: { blanketWidth: 66, blanketLength: 90, blanketBorderDepth: 3 },
  },

  // ---------- Shawl ----------
  {
    id: 'shawl-triangle',
    name: 'Triangle shawl',
    description: '60" wingspan from 7-stitch cast-on',
    itemType: 'shawl',
    fields: { shawlWingspan: 60, shawlInitialCastOn: 7 },
  },
  {
    id: 'shawl-generous',
    name: 'Generous wrap',
    description: '80" wingspan for bigger drape',
    itemType: 'shawl',
    fields: { shawlWingspan: 80, shawlInitialCastOn: 7 },
  },
  {
    id: 'shawl-mini',
    name: 'Kerchief',
    description: '40" wingspan, smaller scarf-shawl',
    itemType: 'shawl',
    fields: { shawlWingspan: 40, shawlInitialCastOn: 5 },
  },

  // ---------- Mittens ----------
  {
    id: 'mittens-adult-women',
    name: 'Adult mittens (women’s M)',
    description: '8" hand, 11" total length',
    itemType: 'mittens',
    fields: {
      handCircumference: 8, negativeEaseAtMittenCuff: 0.5,
      thumbCircumference: 3, mittenCuffDepth: 2,
      cuffToThumbLength: 1, thumbGussetLength: 1.5,
      thumbToTipLength: 3, thumbLength: 2,
    },
  },
  {
    id: 'mittens-adult-men',
    name: "Adult mittens (men's L)",
    description: '9" hand, 12" total length',
    itemType: 'mittens',
    fields: {
      handCircumference: 9, negativeEaseAtMittenCuff: 0.5,
      thumbCircumference: 3.5, mittenCuffDepth: 2.5,
      cuffToThumbLength: 1.5, thumbGussetLength: 2,
      thumbToTipLength: 3.5, thumbLength: 2.5,
    },
  },
  {
    id: 'mittens-kids',
    name: "Kid's mittens (4–6 yr)",
    description: '6" hand, 8" total length',
    itemType: 'mittens',
    fields: {
      handCircumference: 6, negativeEaseAtMittenCuff: 0.25,
      thumbCircumference: 2.5, mittenCuffDepth: 1.5,
      cuffToThumbLength: 0.75, thumbGussetLength: 1,
      thumbToTipLength: 2, thumbLength: 1.5,
    },
  },

  // ---------- Socks ----------
  {
    id: 'socks-adult-crew',
    name: 'Adult crew socks',
    description: '8" ankle, 9" foot, 6" leg',
    itemType: 'socks',
    fields: {
      ankleCircumference: 8, negativeEaseAtSockCuff: 0.5,
      footCircumference: 9, sockCuffDepth: 1.5,
      legLength: 6, footLength: 8,
    },
  },
  {
    id: 'socks-adult-ankle',
    name: 'Adult ankle socks',
    description: '8" ankle, 9" foot, 3" leg',
    itemType: 'socks',
    fields: {
      ankleCircumference: 8, negativeEaseAtSockCuff: 0.5,
      footCircumference: 9, sockCuffDepth: 1.5,
      legLength: 3, footLength: 8,
    },
  },
  {
    id: 'socks-adult-knee',
    name: 'Adult knee-high socks',
    description: '8" ankle, 9" foot, 14" leg',
    itemType: 'socks',
    fields: {
      ankleCircumference: 8, negativeEaseAtSockCuff: 0.5,
      footCircumference: 9, sockCuffDepth: 2,
      legLength: 14, footLength: 8,
    },
  },
];
