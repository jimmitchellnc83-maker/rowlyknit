/**
 * Yardage / skein estimator math.
 *
 * Sprint 1 Public Tools Conversion. Estimates how much yarn a project
 * eats based on garment type, finished size, and yarn weight (CYC
 * standard 0–6). The number is an estimate, not a guarantee — knitting
 * yardage varies by gauge, stitch pattern, and individual tension.
 * The output ranges encode that uncertainty (low ≈ -10%, high ≈ +15%
 * — humans tend to underestimate so the upper band is wider).
 *
 * The reference yardage table below blends:
 *   - Craft Yarn Council "Yarn Weight System" project guidelines
 *   - Yarnsub / Ravelry community reference patterns
 *   - Internal calibration from existing pattern_models in production
 *
 * The numbers stored in the table are the WORSTED (CYC 4) midpoint for
 * each garment+size pair. We adjust by yarn weight using a linear
 * stitch-density factor: lighter yarns need more length per area;
 * heavier yarns less. The factor isn't physically rigorous but matches
 * the rules of thumb pattern designers actually use ("if you go up
 * one weight, knock about 25% off the yardage; if you go down one,
 * add about 30%").
 */

export type GarmentType =
  | 'hat'
  | 'scarf'
  | 'cowl'
  | 'mittens'
  | 'socks'
  | 'shawl'
  | 'sweater_adult'
  | 'sweater_child'
  | 'baby_blanket'
  | 'throw_blanket';

export type YarnWeight =
  | 'lace'
  | 'fingering'
  | 'sport'
  | 'dk'
  | 'worsted'
  | 'aran'
  | 'bulky'
  | 'super_bulky';

export type Size = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | 'one_size';

export const GARMENT_LABELS: Record<GarmentType, string> = {
  hat: 'Hat / beanie',
  scarf: 'Scarf',
  cowl: 'Cowl',
  mittens: 'Mittens',
  socks: 'Socks (pair)',
  shawl: 'Shawl / triangular wrap',
  sweater_adult: 'Adult sweater / pullover',
  sweater_child: "Child's sweater",
  baby_blanket: 'Baby blanket',
  throw_blanket: 'Throw blanket',
};

export const YARN_WEIGHT_LABELS: Record<YarnWeight, string> = {
  lace: 'Lace (CYC 0)',
  fingering: 'Fingering / sock (CYC 1)',
  sport: 'Sport (CYC 2)',
  dk: 'DK (CYC 3)',
  worsted: 'Worsted / aran (CYC 4)',
  aran: 'Aran (CYC 4)',
  bulky: 'Bulky / chunky (CYC 5)',
  super_bulky: 'Super bulky (CYC 6)',
};

export const SIZE_LABELS: Record<Size, string> = {
  xs: 'XS',
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
  xxl: '2XL',
  one_size: 'One size',
};

/**
 * Whether a garment supports adult sizing (XS–2XL) or only "one size."
 * Hats etc. take a one-size value; sweaters need a full size.
 */
export function sizesFor(garment: GarmentType): Size[] {
  switch (garment) {
    case 'sweater_adult':
      return ['xs', 's', 'm', 'l', 'xl', 'xxl'];
    case 'sweater_child':
      return ['xs', 's', 'm', 'l'];
    case 'shawl':
    case 'baby_blanket':
    case 'throw_blanket':
      return ['s', 'm', 'l'];
    default:
      return ['one_size'];
  }
}

/**
 * Worsted-weight midpoint yardage by garment + size.
 * Numbers in YARDS for a CYC-4 worsted-weight reference.
 */
const WORSTED_MIDPOINT_YARDS: Record<GarmentType, Partial<Record<Size, number>>> = {
  hat: { one_size: 175 },
  scarf: { one_size: 350 },
  cowl: { one_size: 200 },
  mittens: { one_size: 200 },
  socks: { one_size: 400 },
  shawl: { s: 400, m: 600, l: 850 },
  sweater_adult: { xs: 1100, s: 1300, m: 1500, l: 1750, xl: 2000, xxl: 2300 },
  sweater_child: { xs: 600, s: 800, m: 1000, l: 1200 },
  baby_blanket: { s: 800, m: 1200, l: 1700 },
  throw_blanket: { s: 1200, m: 1800, l: 2400 },
};

/**
 * Yarn-weight scaling factor relative to worsted (=1.0). Lighter yarns
 * need more length per square inch (smaller stitches); heavier yarns
 * less. Values calibrated against Craft Yarn Council suggested gauges.
 */
const WEIGHT_FACTOR: Record<YarnWeight, number> = {
  lace: 2.0,
  fingering: 1.6,
  sport: 1.3,
  dk: 1.15,
  worsted: 1.0,
  aran: 0.95,
  bulky: 0.75,
  super_bulky: 0.55,
};

export interface YardageEstimateInput {
  garment: GarmentType;
  yarnWeight: YarnWeight;
  size: Size;
  /** Most yarn is sold in 100, 200, 400 yard skeins. Default 200. */
  skeinYards?: number;
}

export interface YardageEstimate {
  estimatedYards: number;
  estimatedMeters: number;
  rangeLowYards: number;
  rangeHighYards: number;
  skeinsAt200Yd: number;
  skeinsAtCustomYd: number | null;
  skeinYards: number;
  garment: GarmentType;
  yarnWeight: YarnWeight;
  size: Size;
}

export function estimateYardage(input: YardageEstimateInput): YardageEstimate | null {
  const baseRow = WORSTED_MIDPOINT_YARDS[input.garment];
  const baseYards = baseRow?.[input.size];
  if (typeof baseYards !== 'number') return null;
  const factor = WEIGHT_FACTOR[input.yarnWeight];
  const midpoint = baseYards * factor;
  const low = Math.round(midpoint * 0.9);
  const high = Math.round(midpoint * 1.15);
  const estimatedYards = Math.round(midpoint);
  const estimatedMeters = Math.round(estimatedYards * 0.9144);
  const skeinsAt200Yd = Math.ceil(high / 200);
  const skeinYards = input.skeinYards ?? 200;
  const skeinsAtCustomYd =
    input.skeinYards && input.skeinYards > 0
      ? Math.ceil(high / input.skeinYards)
      : null;
  return {
    estimatedYards,
    estimatedMeters,
    rangeLowYards: low,
    rangeHighYards: high,
    skeinsAt200Yd,
    skeinsAtCustomYd,
    skeinYards,
    garment: input.garment,
    yarnWeight: input.yarnWeight,
    size: input.size,
  };
}
