import type { ReactElement } from 'react';
import type { Craft } from '../types/chartSymbol';

/**
 * Curated stitch-symbol SVG library.
 *
 * Entries are keyed by the canonical DB `symbol` string (e.g. 'k', 'p', 'sc',
 * 'c4f'). Each entry exposes a `paths()` renderer that draws into a
 * normalized viewBox of [0, 0, 100 * cellSpan, 100], so the same SVG works
 * inside an HTML <svg> (ChartGrid) and inside the schematic's parent SVG
 * (ChartOverlay) — the caller wraps the elements in a transform.
 *
 * Style is intentionally minimal: thin black/grey strokes on a transparent
 * background so the cell's color fill shows through. Multi-cell symbols
 * (cables, shells, etc.) span their full width as a single drawing.
 */

export type StitchCategory =
  | 'basic'
  | 'decrease'
  | 'increase'
  | 'cable'
  | 'twisted'
  | 'special'
  | 'colorwork'
  | 'placeholder'
  | 'edge';

export interface StitchSvg {
  /** Canonical DB symbol key. */
  key: string;
  /** Display name shown in pickers. */
  label: string;
  /** Cell span (1 = single cell, 4 = spans 4 chart cells). */
  cellSpan: number;
  /** Craft this stitch is conventionally drawn for; 'both' = either. */
  craft: Craft | 'both';
  /** Group for the symbol picker. */
  category: StitchCategory;
  /**
   * Returns the SVG body. `stroke` is the line color (auto-contrast against
   * cell background). The drawing fills viewBox [0, 0, 100 * cellSpan, 100].
   * Use `key=` on returned elements relative to the array index.
   */
  paths: (stroke: string) => ReactElement[];
}

// ---------------------------------------------------------------------------
// Drawing helpers — small primitives kept terse so the library reads as
// one entry per stitch rather than 30 lines of SVG each.
// ---------------------------------------------------------------------------

const SW = 7; // default stroke width inside the 100-unit viewBox
const M = 12; // default margin from cell edge

const line = (key: string, x1: number, y1: number, x2: number, y2: number, stroke: string, sw = SW) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
);
const path = (key: string, d: string, stroke: string, fill = 'none', sw = SW) => (
  <path key={key} d={d} stroke={stroke} fill={fill} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
);
const circle = (key: string, cx: number, cy: number, r: number, stroke: string, fill = 'none', sw = SW) => (
  <circle key={key} cx={cx} cy={cy} r={r} stroke={stroke} fill={fill} strokeWidth={sw} />
);
const text = (key: string, x: number, y: number, label: string, fill: string, fontSize = 56) => (
  <text
    key={key}
    x={x}
    y={y}
    textAnchor="middle"
    dominantBaseline="central"
    fill={fill}
    fontSize={fontSize}
    fontFamily="ui-sans-serif, system-ui, sans-serif"
    fontWeight={600}
  >
    {label}
  </text>
);

// ---------------------------------------------------------------------------
// Entries — order is the order they appear in the palette.
// ---------------------------------------------------------------------------

export const STITCH_LIBRARY: StitchSvg[] = [
  // ===== Knit basics =====
  {
    key: 'k',
    label: 'Knit',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: () => [], // empty cell = knit (RS) by convention
  },
  {
    key: '.',
    label: 'Knit (alt)',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: (s) => [circle('d', 50, 50, 6, s, s)],
  },
  {
    key: 'p',
    label: 'Purl',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: (s) => [circle('d', 50, 50, 10, s, s)],
  },
  {
    key: '-',
    label: 'Purl (dash)',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: (s) => [line('h', M + 4, 50, 100 - M - 4, 50, s, 9)],
  },
  {
    key: 'sl',
    label: 'Slip',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: (s) => [path('v', `M ${M} ${M} L 50 80 L ${100 - M} ${M}`, s)],
  },
  {
    key: 'v',
    label: 'Slip (V)',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: (s) => [path('v', `M ${M + 4} ${M + 6} L 50 ${100 - M} L ${100 - M - 4} ${M + 6}`, s)],
  },
  {
    key: 'sl-wyif',
    label: 'Slip with yarn in front',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: (s) => [
      path('v', `M ${M + 4} ${M + 6} L 50 ${100 - M} L ${100 - M - 4} ${M + 6}`, s),
      line('y', 25, 80, 75, 80, s, 5),
    ],
  },
  {
    key: 'sl-wyib',
    label: 'Slip with yarn in back',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: (s) => [
      path('v', `M ${M + 4} ${M + 6} L 50 ${100 - M} L ${100 - M - 4} ${M + 6}`, s),
      line('y', 25, 22, 75, 22, s, 5),
    ],
  },
  {
    key: 'seed',
    label: 'Seed stitch',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: (s) => [circle('d1', 30, 35, 5, s, s), circle('d2', 70, 65, 5, s, s)],
  },
  {
    key: 'garter-ridge',
    label: 'Garter ridge',
    cellSpan: 1,
    craft: 'knit',
    category: 'basic',
    paths: (s) => [line('h1', M, 35, 100 - M, 35, s, 5), line('h2', M, 65, 100 - M, 65, s, 5)],
  },
  {
    key: 'no-stitch',
    label: 'No stitch',
    cellSpan: 1,
    craft: 'both',
    category: 'placeholder',
    paths: (s) => [
      line('a', M + 4, M + 4, 100 - M - 4, 100 - M - 4, s, 6),
      line('b', M + 4, 100 - M - 4, 100 - M - 4, M + 4, s, 6),
    ],
  },
  {
    key: 'x',
    label: 'No stitch (×)',
    cellSpan: 1,
    craft: 'both',
    category: 'placeholder',
    paths: (s) => [
      line('a', M + 4, M + 4, 100 - M - 4, 100 - M - 4, s, 6),
      line('b', M + 4, 100 - M - 4, 100 - M - 4, M + 4, s, 6),
    ],
  },
  {
    key: '[]',
    label: 'Empty cell',
    cellSpan: 1,
    craft: 'both',
    category: 'placeholder',
    paths: () => [],
  },

  // ===== Knit increases =====
  {
    key: 'yo',
    label: 'Yarn over',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [circle('o', 50, 50, 22, s)],
  },
  {
    key: 'o',
    label: 'Yarn over (alt)',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [circle('o', 50, 50, 22, s)],
  },
  {
    key: 'yo2',
    label: 'Double yarn over',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [circle('o1', 35, 50, 16, s), circle('o2', 65, 50, 16, s)],
  },
  {
    key: 'm1l',
    label: 'Make 1 left',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [path('m', `M 50 ${100 - M} L 50 ${M + 8} L ${100 - M} 50`, s)],
  },
  {
    key: 'm1r',
    label: 'Make 1 right',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [path('m', `M 50 ${100 - M} L 50 ${M + 8} L ${M} 50`, s)],
  },
  {
    key: 'm1lp',
    label: 'Make 1 left purlwise',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [
      path('m', `M 50 ${100 - M} L 50 ${M + 8} L ${100 - M} 50`, s),
      circle('d', 50, 78, 4, s, s),
    ],
  },
  {
    key: 'm1rp',
    label: 'Make 1 right purlwise',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [
      path('m', `M 50 ${100 - M} L 50 ${M + 8} L ${M} 50`, s),
      circle('d', 50, 78, 4, s, s),
    ],
  },
  {
    key: 'kfb',
    label: 'Knit front & back',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [
      path('a', `M ${M} ${100 - M} L 50 ${M} L ${100 - M} ${100 - M}`, s),
      line('b', 50, M, 50, 100 - M - 6, s),
    ],
  },
  {
    key: 'pfb',
    label: 'Purl front & back',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [
      path('a', `M ${M} ${100 - M} L 50 ${M} L ${100 - M} ${100 - M}`, s),
      circle('d', 50, 70, 6, s, s),
    ],
  },
  {
    key: 'inc-r',
    label: 'Right lifted increase',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [path('m', `M ${M} 50 L ${100 - M} 50 M ${100 - M - 12} ${50 - 12} L ${100 - M} 50 L ${100 - M - 12} ${50 + 12}`, s)],
  },
  {
    key: 'inc-l',
    label: 'Left lifted increase',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [path('m', `M ${M} 50 L ${100 - M} 50 M ${M + 12} ${50 - 12} L ${M} 50 L ${M + 12} ${50 + 12}`, s)],
  },
  {
    key: 'kyok',
    label: 'k, yo, k in same st',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [
      line('l', M, 80, 50, 30, s),
      line('r', 50, 30, 100 - M, 80, s),
      circle('o', 50, 55, 8, s),
    ],
  },

  // ===== Knit decreases =====
  {
    key: 'k2tog',
    label: 'Knit 2 together',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [line('s', M, 100 - M, 100 - M, M, s)],
  },
  {
    key: '/',
    label: 'k2tog (slash)',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [line('s', M, 100 - M, 100 - M, M, s)],
  },
  {
    key: 'ssk',
    label: 'Slip slip knit',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [line('s', M, M, 100 - M, 100 - M, s)],
  },
  {
    key: '\\',
    label: 'ssk (backslash)',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [line('s', M, M, 100 - M, 100 - M, s)],
  },
  {
    key: 'k3tog',
    label: 'Knit 3 together',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('s1', M, 100 - M, 100 - M, M, s),
      line('s2', M + 14, 100 - M, 100 - M + 14, M, s),
    ],
  },
  {
    key: 'sssk',
    label: 'Slip slip slip knit',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('s1', M, M, 100 - M, 100 - M, s),
      line('s2', M - 14, M, 100 - M - 14, 100 - M, s),
    ],
  },
  {
    key: 'sk2p',
    label: 'sl1, k2tog, psso',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('l', M, 100 - M, 50, M, s),
      line('r', 50, M, 100 - M, 100 - M, s),
    ],
  },
  {
    key: 's2kp',
    label: 'Centered double dec',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('l', M, 100 - M, 50, M, s),
      line('r', 50, M, 100 - M, 100 - M, s),
      line('m', 50, M, 50, 100 - M, s, 5),
    ],
  },
  {
    key: 'cdd',
    label: 'Centered double decrease',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('l', M, 100 - M, 50, M, s),
      line('r', 50, M, 100 - M, 100 - M, s),
      line('m', 50, M, 50, 100 - M, s, 5),
    ],
  },
  {
    key: 'p2tog',
    label: 'Purl 2 together',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('s', M, 100 - M, 100 - M, M, s),
      circle('d', 50, 50, 5, s, s),
    ],
  },
  {
    key: 'ssp',
    label: 'Slip slip purl',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('s', M, M, 100 - M, 100 - M, s),
      circle('d', 50, 50, 5, s, s),
    ],
  },
  {
    key: 'k4tog',
    label: 'Knit 4 together',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('s1', M, 100 - M, 100 - M, M, s),
      line('s2', M + 12, 100 - M, 100 - M + 12, M, s),
      line('s3', M - 12, 100 - M, 100 - M - 12, M, s),
    ],
  },

  // ===== Twisted knit =====
  {
    key: 'ktbl',
    label: 'Knit through back loop',
    cellSpan: 1,
    craft: 'knit',
    category: 'twisted',
    paths: (s) => [
      line('a', M, M, 100 - M, 100 - M, s, 5),
      line('b', 100 - M, M, M, 100 - M, s, 5),
    ],
  },
  {
    key: 'ptbl',
    label: 'Purl through back loop',
    cellSpan: 1,
    craft: 'knit',
    category: 'twisted',
    paths: (s) => [
      line('a', M, M, 100 - M, 100 - M, s, 5),
      line('b', 100 - M, M, M, 100 - M, s, 5),
      circle('d', 50, 50, 6, s, s),
    ],
  },
  {
    key: 'k1b',
    label: 'Knit 1 below',
    cellSpan: 1,
    craft: 'knit',
    category: 'twisted',
    paths: (s) => [path('v', `M 50 ${M} L 50 ${100 - M} L ${100 - M} ${100 - M}`, s)],
  },

  // ===== Cables (multi-cell) =====
  {
    key: 'rt',
    label: 'Right twist (RT)',
    cellSpan: 2,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [path('x', `M ${M} 80 C 60 80 140 20 ${200 - M} 20 M ${M} 20 C 60 20 140 80 ${200 - M} 80`, s)],
  },
  {
    key: 'lt',
    label: 'Left twist (LT)',
    cellSpan: 2,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [path('x', `M ${M} 80 C 60 80 140 20 ${200 - M} 20 M ${M} 20 C 60 20 140 80 ${200 - M} 80`, s)],
  },
  {
    key: 't2r',
    label: 'Twist 2 right',
    cellSpan: 2,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [path('x', `M ${M} 80 C 60 80 140 20 ${200 - M} 20 M ${M} 20 C 60 20 140 80 ${200 - M} 80`, s)],
  },
  {
    key: 't2l',
    label: 'Twist 2 left',
    cellSpan: 2,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [path('x', `M ${M} 80 C 60 80 140 20 ${200 - M} 20 M ${M} 20 C 60 20 140 80 ${200 - M} 80`, s)],
  },
  {
    key: 'c2f',
    label: 'Cable 2 front',
    cellSpan: 2,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('back', `M ${M} 20 C 50 20 150 80 ${200 - M} 80`, s),
      path('front', `M ${M} 80 C 50 80 150 20 ${200 - M} 20`, s),
    ],
  },
  {
    key: 'c2b',
    label: 'Cable 2 back',
    cellSpan: 2,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('front', `M ${M} 20 C 50 20 150 80 ${200 - M} 80`, s),
      path('back', `M ${M} 80 C 50 80 150 20 ${200 - M} 20`, s),
    ],
  },
  {
    key: 't3f',
    label: 'Twist 3 front',
    cellSpan: 3,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('back', `M ${M} 20 C 80 20 220 80 ${300 - M} 80`, s),
      path('front', `M ${M} 80 C 80 80 220 20 ${300 - M} 20`, s),
    ],
  },
  {
    key: 't3b',
    label: 'Twist 3 back',
    cellSpan: 3,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('front', `M ${M} 20 C 80 20 220 80 ${300 - M} 80`, s),
      path('back', `M ${M} 80 C 80 80 220 20 ${300 - M} 20`, s),
    ],
  },
  {
    key: 'c4f',
    label: 'Cable 4 front',
    cellSpan: 4,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('back', `M ${M} 20 C 100 20 300 80 ${400 - M} 80`, s),
      path('front', `M ${M} 80 C 100 80 300 20 ${400 - M} 20`, s),
    ],
  },
  {
    key: 'c4b',
    label: 'Cable 4 back',
    cellSpan: 4,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('front', `M ${M} 20 C 100 20 300 80 ${400 - M} 80`, s),
      path('back', `M ${M} 80 C 100 80 300 20 ${400 - M} 20`, s),
    ],
  },
  {
    key: 't4f',
    label: 'Twist 4 front',
    cellSpan: 4,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('back', `M ${M} 20 C 100 20 300 80 ${400 - M} 80`, s),
      path('front', `M ${M} 80 C 100 80 300 20 ${400 - M} 20`, s),
    ],
  },
  {
    key: 't4b',
    label: 'Twist 4 back',
    cellSpan: 4,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('front', `M ${M} 20 C 100 20 300 80 ${400 - M} 80`, s),
      path('back', `M ${M} 80 C 100 80 300 20 ${400 - M} 20`, s),
    ],
  },
  {
    key: 'c6f',
    label: 'Cable 6 front',
    cellSpan: 6,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('back', `M ${M} 20 C 150 20 450 80 ${600 - M} 80`, s),
      path('front', `M ${M} 80 C 150 80 450 20 ${600 - M} 20`, s),
    ],
  },
  {
    key: 'c6b',
    label: 'Cable 6 back',
    cellSpan: 6,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('front', `M ${M} 20 C 150 20 450 80 ${600 - M} 80`, s),
      path('back', `M ${M} 80 C 150 80 450 20 ${600 - M} 20`, s),
    ],
  },
  {
    key: 'c8f',
    label: 'Cable 8 front',
    cellSpan: 8,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('back', `M ${M} 20 C 200 20 600 80 ${800 - M} 80`, s),
      path('front', `M ${M} 80 C 200 80 600 20 ${800 - M} 20`, s),
    ],
  },
  {
    key: 'c8b',
    label: 'Cable 8 back',
    cellSpan: 8,
    craft: 'knit',
    category: 'cable',
    paths: (s) => [
      path('front', `M ${M} 20 C 200 20 600 80 ${800 - M} 80`, s),
      path('back', `M ${M} 80 C 200 80 600 20 ${800 - M} 20`, s),
    ],
  },

  // ===== Knit specials =====
  {
    key: 'bobble',
    label: 'Bobble',
    cellSpan: 1,
    craft: 'knit',
    category: 'special',
    paths: (s) => [circle('b', 50, 50, 24, s, s)],
  },
  {
    key: 'popcorn',
    label: 'Popcorn',
    cellSpan: 1,
    craft: 'knit',
    category: 'special',
    paths: (s) => [
      path(
        'star',
        'M 50 18 L 60 42 L 84 44 L 65 60 L 72 84 L 50 70 L 28 84 L 35 60 L 16 44 L 40 42 Z',
        s,
        s,
        4,
      ),
    ],
  },
  {
    key: 'nupp',
    label: 'Nupp',
    cellSpan: 1,
    craft: 'knit',
    category: 'special',
    paths: (s) => [
      path(
        'leaf',
        'M 50 18 C 70 30 70 70 50 82 C 30 70 30 30 50 18 Z',
        s,
      ),
    ],
  },
  {
    key: 'bead',
    label: 'Place bead',
    cellSpan: 1,
    craft: 'knit',
    category: 'special',
    paths: (s) => [
      path('d', 'M 50 25 L 70 50 L 50 75 L 30 50 Z', s, s),
    ],
  },
  {
    key: 'wt',
    label: 'Wrap & turn',
    cellSpan: 1,
    craft: 'knit',
    category: 'special',
    paths: (s) => [text('t', 50, 55, 'W', s, 56)],
  },
  {
    key: 'co',
    label: 'Cast on',
    cellSpan: 1,
    craft: 'knit',
    category: 'edge',
    paths: (s) => [
      line('h', M, 75, 100 - M, 75, s),
      circle('a', 30, 50, 6, s),
      circle('b', 50, 50, 6, s),
      circle('c', 70, 50, 6, s),
    ],
  },
  {
    key: 'bo',
    label: 'Bind off',
    cellSpan: 1,
    craft: 'knit',
    category: 'edge',
    paths: (s) => [
      line('h', M, 25, 100 - M, 25, s),
      line('a', 30, 25, 30, 75, s),
      line('b', 70, 25, 70, 75, s),
    ],
  },

  // ===== Brioche =====
  {
    key: 'brk',
    label: 'Brioche knit',
    cellSpan: 1,
    craft: 'knit',
    category: 'special',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('y', 35, 50, 65, 50, s, 5),
    ],
  },
  {
    key: 'brp',
    label: 'Brioche purl',
    cellSpan: 1,
    craft: 'knit',
    category: 'special',
    paths: (s) => [
      circle('d', 50, 50, 8, s, s),
      line('y', 25, 50, 75, 50, s, 5),
    ],
  },
  {
    key: 'brk2tog',
    label: 'Brioche left dec',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('s', M, M, 100 - M, 100 - M, s),
      line('y', M, 50, 100 - M, 50, s, 4),
    ],
  },
  {
    key: 'brsssk',
    label: 'Brioche right dec',
    cellSpan: 1,
    craft: 'knit',
    category: 'decrease',
    paths: (s) => [
      line('s', M, 100 - M, 100 - M, M, s),
      line('y', M, 50, 100 - M, 50, s, 4),
    ],
  },
  {
    key: 'brkyobrk',
    label: 'Brioche center inc',
    cellSpan: 1,
    craft: 'knit',
    category: 'increase',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      circle('o', 50, 50, 14, s),
    ],
  },

  // ===== Colorwork =====
  {
    key: 'mc',
    label: 'Main color',
    cellSpan: 1,
    craft: 'both',
    category: 'colorwork',
    paths: (s) => [text('t', 50, 55, 'MC', s, 36)],
  },
  {
    key: 'cc',
    label: 'Contrast color',
    cellSpan: 1,
    craft: 'both',
    category: 'colorwork',
    paths: (s) => [text('t', 50, 55, 'CC', s, 36)],
  },
  {
    key: 'cc1',
    label: 'Contrast color 1',
    cellSpan: 1,
    craft: 'both',
    category: 'colorwork',
    paths: (s) => [text('t', 50, 55, 'C1', s, 36)],
  },
  {
    key: 'cc2',
    label: 'Contrast color 2',
    cellSpan: 1,
    craft: 'both',
    category: 'colorwork',
    paths: (s) => [text('t', 50, 55, 'C2', s, 36)],
  },
  {
    key: 'cc3',
    label: 'Contrast color 3',
    cellSpan: 1,
    craft: 'both',
    category: 'colorwork',
    paths: (s) => [text('t', 50, 55, 'C3', s, 36)],
  },

  // ===== Crochet basics =====
  {
    key: 'ch',
    label: 'Chain',
    cellSpan: 1,
    craft: 'crochet',
    category: 'basic',
    paths: (s) => [
      path('o', 'M 30 50 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0', s),
    ],
  },
  {
    key: 'sl-st',
    label: 'Slip stitch',
    cellSpan: 1,
    craft: 'crochet',
    category: 'basic',
    paths: (s) => [circle('d', 50, 50, 8, s, s)],
  },
  {
    key: 'sc',
    label: 'Single crochet',
    cellSpan: 1,
    craft: 'crochet',
    category: 'basic',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
    ],
  },
  {
    key: 'hdc',
    label: 'Half double crochet',
    cellSpan: 1,
    craft: 'crochet',
    category: 'basic',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
      line('b', 30, 35, 70, 35, s, 4),
    ],
  },
  {
    key: 'dc',
    label: 'Double crochet',
    cellSpan: 1,
    craft: 'crochet',
    category: 'basic',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
      line('x', 30, 38, 70, 38, s, 4),
    ],
  },
  {
    key: 'tr',
    label: 'Treble crochet',
    cellSpan: 1,
    craft: 'crochet',
    category: 'basic',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
      line('x1', 30, 30, 70, 30, s, 4),
      line('x2', 30, 50, 70, 50, s, 4),
    ],
  },
  {
    key: 'dtr',
    label: 'Double treble',
    cellSpan: 1,
    craft: 'crochet',
    category: 'basic',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
      line('x1', 30, 28, 70, 28, s, 4),
      line('x2', 30, 44, 70, 44, s, 4),
      line('x3', 30, 60, 70, 60, s, 4),
    ],
  },
  {
    key: 'ttr',
    label: 'Triple treble',
    cellSpan: 1,
    craft: 'crochet',
    category: 'basic',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
      line('x1', 30, 26, 70, 26, s, 4),
      line('x2', 30, 40, 70, 40, s, 4),
      line('x3', 30, 54, 70, 54, s, 4),
      line('x4', 30, 68, 70, 68, s, 4),
    ],
  },

  // ===== Crochet increases =====
  {
    key: 'sc-inc',
    label: 'SC increase',
    cellSpan: 1,
    craft: 'crochet',
    category: 'increase',
    paths: (s) => [
      line('a', 35, M, 65, 100 - M, s),
      line('b', 65, M, 35, 100 - M, s),
      line('h', 25, M, 75, M, s, 5),
    ],
  },
  {
    key: 'hdc-inc',
    label: 'HDC increase',
    cellSpan: 1,
    craft: 'crochet',
    category: 'increase',
    paths: (s) => [
      line('a', 35, M, 65, 100 - M, s),
      line('b', 65, M, 35, 100 - M, s),
      line('h', 25, M, 75, M, s, 5),
      line('x', 30, 35, 70, 35, s, 4),
    ],
  },
  {
    key: 'dc-inc',
    label: 'DC increase',
    cellSpan: 1,
    craft: 'crochet',
    category: 'increase',
    paths: (s) => [
      line('a', 35, M, 65, 100 - M, s),
      line('b', 65, M, 35, 100 - M, s),
      line('h', 25, M, 75, M, s, 5),
      line('x', 30, 38, 70, 38, s, 4),
    ],
  },

  // ===== Crochet decreases =====
  {
    key: 'sc2tog',
    label: 'SC decrease',
    cellSpan: 1,
    craft: 'crochet',
    category: 'decrease',
    paths: (s) => [
      line('a', 30, M, 50, 100 - M, s),
      line('b', 70, M, 50, 100 - M, s),
      line('h', 25, M, 75, M, s, 5),
    ],
  },
  {
    key: 'hdc2tog',
    label: 'HDC decrease',
    cellSpan: 1,
    craft: 'crochet',
    category: 'decrease',
    paths: (s) => [
      line('a', 30, M, 50, 100 - M, s),
      line('b', 70, M, 50, 100 - M, s),
      line('h', 25, M, 75, M, s, 5),
      line('x', 30, 35, 70, 35, s, 4),
    ],
  },
  {
    key: 'dc2tog',
    label: 'DC decrease',
    cellSpan: 1,
    craft: 'crochet',
    category: 'decrease',
    paths: (s) => [
      line('a', 30, M, 50, 100 - M, s),
      line('b', 70, M, 50, 100 - M, s),
      line('h', 25, M, 75, M, s, 5),
      line('x', 30, 38, 70, 38, s, 4),
    ],
  },

  // ===== Crochet specials =====
  {
    key: 'fpdc',
    label: 'Front post DC',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
      line('x', 30, 38, 70, 38, s, 4),
      line('p', 50, 60, 50, 80, s, 9),
    ],
  },
  {
    key: 'bpdc',
    label: 'Back post DC',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      path('v', `M 50 ${M} L 50 60 M 50 80 L 50 ${100 - M}`, s),
      line('h', 30, M, 70, M, s, 5),
      line('x', 30, 38, 70, 38, s, 4),
      line('p', 30, 70, 70, 70, s, 5),
    ],
  },
  {
    key: 'fpsc',
    label: 'Front post SC',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
      line('p', 50, 60, 50, 80, s, 9),
    ],
  },
  {
    key: 'bpsc',
    label: 'Back post SC',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      path('v', `M 50 ${M} L 50 60 M 50 80 L 50 ${100 - M}`, s),
      line('h', 30, M, 70, M, s, 5),
      line('p', 30, 70, 70, 70, s, 5),
    ],
  },
  {
    key: 'shell',
    label: 'Shell (5 dc)',
    cellSpan: 5,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      path('fan', `M 50 ${100 - M} L ${M} 30 M 50 ${100 - M} L 175 25 M 50 ${100 - M} L 250 ${M} M 50 ${100 - M} L 325 25 M 50 ${100 - M} L ${500 - M} 30`, s),
      circle('hub', 50, 100 - M, 6, s, s),
    ],
  },
  {
    key: 'v-st',
    label: 'V-stitch',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [path('v', `M 25 ${M} L 50 80 L 75 ${M}`, s)],
  },
  {
    key: 'cl',
    label: 'Cluster',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      path('w', `M 25 ${M} L 50 80 L 75 ${M} M 35 ${M} L 50 80 L 65 ${M}`, s),
    ],
  },
  {
    key: 'pc',
    label: 'Crochet popcorn',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      path('star', 'M 50 18 L 60 42 L 84 44 L 65 60 L 72 84 L 50 70 L 28 84 L 35 60 L 16 44 L 40 42 Z', s, s, 4),
    ],
  },
  {
    key: 'puff',
    label: 'Puff stitch',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      path('w', `M 25 ${M} L 50 80 L 75 ${M} M 30 ${M} L 50 80 L 70 ${M} M 40 ${M} L 50 80 L 60 ${M}`, s),
    ],
  },
  {
    key: 'picot',
    label: 'Picot',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      path('p', 'M 30 80 L 50 30 L 70 80', s),
      circle('d', 50, 24, 5, s, s),
    ],
  },
  {
    key: 'mr',
    label: 'Magic ring',
    cellSpan: 1,
    craft: 'crochet',
    category: 'placeholder',
    paths: (s) => [circle('o', 50, 50, 26, s)],
  },
  {
    key: 'ch-sp',
    label: 'Chain space',
    cellSpan: 1,
    craft: 'crochet',
    category: 'placeholder',
    paths: (s) => [
      circle('o', 50, 50, 18, s),
      line('a', 25, 50, 35, 50, s, 4),
      line('b', 65, 50, 75, 50, s, 4),
    ],
  },
  {
    key: 'rev-sc',
    label: 'Reverse SC (crab)',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      path('v', 'M 50 18 L 50 80 M 50 80 L 30 60 M 50 80 L 70 60', s),
    ],
  },
  {
    key: 'crab-st',
    label: 'Crab stitch',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      path('v', 'M 50 18 L 50 80 M 50 80 L 30 60 M 50 80 L 70 60', s),
    ],
  },
  {
    key: 'sk',
    label: 'Skip',
    cellSpan: 1,
    craft: 'crochet',
    category: 'placeholder',
    paths: (s) => [path('s', `M ${M + 6} ${M + 6} L ${100 - M - 6} ${100 - M - 6}`, s, 'none', 5)],
  },
  {
    key: 'join',
    label: 'Join with sl st',
    cellSpan: 1,
    craft: 'crochet',
    category: 'edge',
    paths: (s) => [
      circle('d', 50, 50, 8, s, s),
      circle('o', 50, 50, 22, s),
    ],
  },
  {
    key: 'bl',
    label: 'Back loop only',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
      path('curve', 'M 30 70 Q 50 80 70 70', s),
    ],
  },
  {
    key: 'fl',
    label: 'Front loop only',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', 30, M, 70, M, s, 5),
      path('curve', 'M 30 70 Q 50 60 70 70', s),
    ],
  },
  {
    key: 'bobble-cr',
    label: 'Crochet bobble',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [path('b', 'M 50 25 C 70 35 70 65 50 80 C 30 65 30 35 50 25 Z', s, s)],
  },
  {
    key: 'cluster3',
    label: '3-stitch cluster',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [path('w', `M 25 ${M} L 50 80 L 75 ${M} M 50 ${M} L 50 80`, s)],
  },
  {
    key: 'cluster4',
    label: '4-stitch cluster',
    cellSpan: 1,
    craft: 'crochet',
    category: 'special',
    paths: (s) => [path('w', `M 20 ${M} L 50 80 L 80 ${M} M 35 ${M} L 50 80 L 65 ${M}`, s)],
  },

  // ===== Generic / placeholder icons users can pick for custom stitches =====
  {
    key: 'inc-1',
    label: 'Generic increase',
    cellSpan: 1,
    craft: 'both',
    category: 'increase',
    paths: (s) => [text('t', 50, 55, '+', s, 70)],
  },
  {
    key: 'dec-1',
    label: 'Generic decrease',
    cellSpan: 1,
    craft: 'both',
    category: 'decrease',
    paths: (s) => [text('t', 50, 55, '−', s, 70)],
  },
  {
    key: 'star',
    label: 'Star',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [
      path('star', 'M 50 18 L 60 42 L 84 44 L 65 60 L 72 84 L 50 70 L 28 84 L 35 60 L 16 44 L 40 42 Z', s, 'none', 4),
    ],
  },
  {
    key: 'diamond',
    label: 'Diamond',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('d', 'M 50 18 L 82 50 L 50 82 L 18 50 Z', s)],
  },
  {
    key: 'square',
    label: 'Square',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [
      <rect key="r" x={M + 4} y={M + 4} width={100 - 2 * M - 8} height={100 - 2 * M - 8} fill="none" stroke={s} strokeWidth={SW} />,
    ],
  },
  {
    key: 'triangle-up',
    label: 'Triangle up',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('t', 'M 50 18 L 82 80 L 18 80 Z', s)],
  },
  {
    key: 'triangle-down',
    label: 'Triangle down',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('t', 'M 18 20 L 82 20 L 50 82 Z', s)],
  },
  {
    key: 'arrow-up',
    label: 'Arrow up',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('a', 'M 50 80 L 50 20 M 30 38 L 50 18 L 70 38', s)],
  },
  {
    key: 'arrow-down',
    label: 'Arrow down',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('a', 'M 50 20 L 50 80 M 30 62 L 50 82 L 70 62', s)],
  },
  {
    key: 'wave',
    label: 'Wave',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('w', 'M 15 50 Q 32 30 50 50 T 85 50', s)],
  },
  {
    key: 'spiral',
    label: 'Spiral',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('s', 'M 50 50 m -20 0 a 20 20 0 1 1 40 0 a 14 14 0 1 1 -28 0 a 8 8 0 1 1 16 0', s)],
  },
  {
    key: 'butterfly',
    label: 'Butterfly',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('b', 'M 50 50 C 30 30 20 30 20 50 C 20 70 30 70 50 50 C 70 70 80 70 80 50 C 80 30 70 30 50 50 Z', s)],
  },
  {
    key: 'leaf',
    label: 'Leaf',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('l', 'M 30 80 Q 30 30 70 20 Q 70 70 30 80 Z M 30 80 L 70 20', s)],
  },
  {
    key: 'heart',
    label: 'Heart',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('h', 'M 50 80 C 10 55 10 25 30 25 C 40 25 50 35 50 45 C 50 35 60 25 70 25 C 90 25 90 55 50 80 Z', s)],
  },
  {
    key: 'cross-plus',
    label: 'Plus / cross',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [
      line('v', 50, M, 50, 100 - M, s),
      line('h', M, 50, 100 - M, 50, s),
    ],
  },
  {
    key: 'asterisk',
    label: 'Asterisk',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [
      line('a', 50, M, 50, 100 - M, s),
      line('b', M, 50, 100 - M, 50, s),
      line('c', M + 8, M + 8, 100 - M - 8, 100 - M - 8, s),
      line('d', 100 - M - 8, M + 8, M + 8, 100 - M - 8, s),
    ],
  },
  {
    key: 'sun',
    label: 'Sun',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [
      circle('o', 50, 50, 14, s),
      path('rays', 'M 50 18 L 50 28 M 50 72 L 50 82 M 18 50 L 28 50 M 72 50 L 82 50 M 28 28 L 35 35 M 65 65 L 72 72 M 72 28 L 65 35 M 28 72 L 35 65', s, 'none', 5),
    ],
  },
  {
    key: 'moon',
    label: 'Moon',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('m', 'M 60 18 A 32 32 0 1 0 60 82 A 26 26 0 1 1 60 18 Z', s)],
  },
  {
    key: 'flower',
    label: 'Flower',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [
      circle('c', 50, 50, 8, s),
      circle('p1', 50, 24, 8, s),
      circle('p2', 50, 76, 8, s),
      circle('p3', 24, 50, 8, s),
      circle('p4', 76, 50, 8, s),
    ],
  },
  {
    key: 'snowflake',
    label: 'Snowflake',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [
      line('a', 50, M, 50, 100 - M, s, 5),
      line('b', M, 50, 100 - M, 50, s, 5),
      line('c', M + 8, M + 8, 100 - M - 8, 100 - M - 8, s, 5),
      line('d', 100 - M - 8, M + 8, M + 8, 100 - M - 8, s, 5),
    ],
  },
  {
    key: 'check',
    label: 'Checkmark',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [path('c', 'M 18 50 L 40 75 L 80 25', s)],
  },
  {
    key: 'dot-small',
    label: 'Small dot',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [circle('d', 50, 50, 4, s, s)],
  },
  {
    key: 'dot-large',
    label: 'Large dot',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [circle('d', 50, 50, 16, s, s)],
  },
  {
    key: 'ring',
    label: 'Ring',
    cellSpan: 1,
    craft: 'both',
    category: 'special',
    paths: (s) => [circle('o', 50, 50, 24, s)],
  },
];

// ---------------------------------------------------------------------------
// Lookup utilities
// ---------------------------------------------------------------------------

const STITCH_INDEX = new Map(STITCH_LIBRARY.map((e) => [e.key, e] as const));

/**
 * Legacy `KnittingSymbol.id` → canonical DB symbol key. Lets old saved
 * drafts keep rendering after we migrate the chart cells from the old
 * frontend-only id space (e.g. 'knit') to the DB symbol space ('k').
 */
const LEGACY_ALIASES: Record<string, string> = {
  knit: 'k',
  purl: 'p',
  yarn_over: 'yo',
  slip_stitch: 'sl',
  no_stitch: 'no-stitch',
  wrap_turn: 'wt',
};

export function resolveStitchKey(id: string | null | undefined): string | null {
  if (!id) return null;
  if (STITCH_INDEX.has(id)) return id;
  const alias = LEGACY_ALIASES[id];
  if (alias && STITCH_INDEX.has(alias)) return alias;
  return null;
}

export function getStitchSvg(id: string | null | undefined): StitchSvg | null {
  const key = resolveStitchKey(id);
  return key ? STITCH_INDEX.get(key) ?? null : null;
}

/** Default cell span for a symbol; falls back to 1 when unknown. */
export function getCellSpan(id: string | null | undefined, fallback = 1): number {
  return getStitchSvg(id)?.cellSpan ?? fallback;
}

/**
 * Render a stitch into a target rect inside a parent SVG (used by ChartGrid
 * cells and by ChartOverlay). The stitch's normalized [0..100*span, 0..100]
 * viewBox is mapped onto the destination rect via a translate+scale group.
 *
 * `width` is the TOTAL width (across all spanned cells, in parent SVG
 * coordinates). The function infers scale from this — handy when a run is
 * shorter than the symbol's natural span and the artwork should compress.
 */
export function renderStitchInto(opts: {
  id: string | null | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  keyPrefix: string;
}): ReactElement | null {
  const stitch = getStitchSvg(opts.id);
  if (!stitch) return null;
  const sx = opts.width / (100 * stitch.cellSpan);
  const sy = opts.height / 100;
  const elements = stitch.paths(opts.stroke);
  if (elements.length === 0) return null;
  return (
    <g key={opts.keyPrefix} transform={`translate(${opts.x},${opts.y}) scale(${sx},${sy})`}>
      {elements}
    </g>
  );
}

/**
 * Standalone SVG element (own viewBox) for use in HTML/Tailwind layouts —
 * the picker buttons in StitchPalette and CustomStitchModal.
 */
export function StitchIcon({ id, size = 28, stroke = '#374151' }: { id: string; size?: number; stroke?: string }) {
  const stitch = getStitchSvg(id);
  if (!stitch) return null;
  const w = size * stitch.cellSpan;
  return (
    <svg
      width={w}
      height={size}
      viewBox={`0 0 ${100 * stitch.cellSpan} 100`}
      role="img"
      aria-label={stitch.label}
    >
      {stitch.paths(stroke)}
    </svg>
  );
}
