/**
 * Technique rules engine — PR 2 of the Designer rebuild.
 *
 * The PRD's "technique-aware behavior" principle says knit charts, crochet
 * charts, lace, cables, colorwork, filet, tapestry, and Tunisian crochet
 * should not all behave like one generic grid editor. Reading direction,
 * repeat semantics, terminology, and validation differ across these
 * combinations and that knowledge needs ONE source of truth so future
 * surfaces (chart engine, instruction generator, repeat engine, validator)
 * stop hard-coding it ad hoc.
 *
 * This module owns that knowledge. It exports pure functions that take
 * `(craft, technique)` and return rule sets the rest of the codebase
 * consumes. No I/O, no React, no DOM — just data.
 *
 * Today's consumers (PR 2):
 *   - `chartInstruction.ts` reads `getReadingDirection()` to decide RS/WS
 *     alternation and cell traversal direction (replacing today's
 *     hardcoded `knitRow % 2 === 1` + `RS = right-to-left` block).
 *   - `useChartSymbols` reads `getRelevantSymbolCategories()` to
 *     narrow the palette client-side when a technique is active
 *     (replacing today's `craft`-only filter).
 *
 * Future consumers (PR 3+):
 *   - Repeat engine reads `getRepeatSemantics()` for default repeat shape
 *     conventions (e.g. crochet rows pivot the chart at row boundaries).
 *   - Author mode reads `getTerminology()` to render the chosen US/UK
 *     dialect for crochet patterns.
 *   - Validator reads `getValidationRules()` to flag issues like an
 *     RS-only stitch placed on a WS row.
 */

import type { Craft, Technique } from '../types/pattern';

// ---------------------------------------------------------------------------
// Rule shape definitions
// ---------------------------------------------------------------------------

/** How a row is read on the chart and how RS/WS alternation works. */
export interface ReadingDirectionRules {
  /**
   * For flat work, do RS rows alternate with WS rows? `true` for
   * standard knit (RS odd, WS even); `false` for crochet (rows often
   * read the same way regardless of side because the chart is rotated).
   */
  alternatesRsWs: boolean;
  /**
   * Per-row cell traversal direction.
   *  - `right-to-left-on-rs` — knitter convention: RS rows right-to-left,
   *    WS rows left-to-right. Standard knit.
   *  - `right-to-left-always` — every row right-to-left. Most crochet.
   *  - `forward-and-return` — Tunisian crochet's two-pass row (forward
   *    pass picks up loops; return pass works them off).
   */
  cellTraversal:
    | 'right-to-left-on-rs'
    | 'right-to-left-always'
    | 'forward-and-return';
  /**
   * In-the-round override. When `true`, every row is treated as RS
   * (chart-instruction prefix is "Round N:" rather than "Row N (RS|WS):").
   * This is honored only when the chart's `workedInRound` flag is set.
   */
  roundsAreAllRs: boolean;
  /** Vocabulary for the row-prefix label. "Row" for flat work, "Round"
   *  in the round; per-craft variants like "Pass" for Tunisian. */
  rowLabel: { flat: string; inRound: string };
}

/** How repeats compose for this technique. */
export interface RepeatSemanticsRules {
  /**
   * Whether horizontal repeats (the most common form — "[k2tog, yo] N
   * times across the row") are first-class for this technique. Always
   * true today; included so future techniques can opt out cleanly.
   */
  supportsHorizontalRepeats: boolean;
  /** Whether vertical repeats (a multi-row motif worked N times stacked)
   *  are typical. Filet crochet and lace use them heavily. */
  supportsVerticalRepeats: boolean;
  /**
   * Whether between-marker repeats (knit "to next marker, repeat from *")
   * are a primary expressive tool. Knit sweater bodies use them for
   * raglan and waist shaping; crochet rarely does.
   */
  supportsBetweenMarkers: boolean;
  /**
   * Whether motif/panel repeats (a 2D block that tiles across the whole
   * piece) are part of the technique's normal authoring model.
   */
  supportsMotifs: boolean;
}

/** US vs. UK terminology dialect — meaningful for crochet only. */
export type TerminologyDialect = 'us' | 'uk';

export interface TerminologyRules {
  /** Whether dialect choice meaningfully changes vocabulary for this
   *  craft+technique. Always false for knit; true for any crochet. */
  hasDialectVariants: boolean;
  /** Default dialect when the user hasn't picked one explicitly. US is
   *  the dominant published-pattern convention worldwide. */
  defaultDialect: TerminologyDialect;
  /**
   * Per-symbol vocabulary mapping. Keys are canonical symbol IDs from
   * `chart_symbol_templates.symbol`; values are the per-dialect display
   * abbreviations the Author mode should render. Empty when
   * `hasDialectVariants` is false.
   *
   * The well-known crochet shifts: US "sc" = UK "dc"; US "dc" = UK "tr";
   * US "tr" = UK "dtr"; US "hdc" = UK "htr"; US "dtr" = UK "trtr".
   */
  symbolDialect: Record<string, { us: string; uk: string }>;
}

/** Per-symbol validation hints (e.g. "this symbol is RS-only"). */
export interface ValidationRules {
  /** Symbols that should appear only on RS rows for this technique.
   *  Today: cables (knit) and front-post stitches (crochet). */
  rsOnlySymbols: ReadonlySet<string>;
  /** Symbols that should appear only on WS rows for this technique. */
  wsOnlySymbols: ReadonlySet<string>;
  /** Categories whose symbols imply this technique. Used by the symbol
   *  palette to pre-filter when a technique is selected. */
  relevantSymbolCategories: ReadonlySet<string>;
}

/** All four rule facets bundled together. */
export interface TechniqueRules {
  craft: Craft;
  technique: Technique;
  readingDirection: ReadingDirectionRules;
  repeatSemantics: RepeatSemanticsRules;
  terminology: TerminologyRules;
  validation: ValidationRules;
}

// ---------------------------------------------------------------------------
// Per-craft baselines. Each craft has a default rule set; per-technique
// overrides layer on top.
// ---------------------------------------------------------------------------

const KNIT_BASE_READING: ReadingDirectionRules = {
  alternatesRsWs: true,
  cellTraversal: 'right-to-left-on-rs',
  roundsAreAllRs: true,
  rowLabel: { flat: 'Row', inRound: 'Round' },
};

const CROCHET_BASE_READING: ReadingDirectionRules = {
  // Crochet charts are usually drawn so each row reads in working order
  // — the chart is rotated/reflected at design time rather than at read
  // time. RS/WS still exist for some stitch families (post stitches),
  // but the cell traversal convention doesn't flip.
  alternatesRsWs: true,
  cellTraversal: 'right-to-left-always',
  roundsAreAllRs: true,
  rowLabel: { flat: 'Row', inRound: 'Round' },
};

const KNIT_BASE_REPEATS: RepeatSemanticsRules = {
  supportsHorizontalRepeats: true,
  supportsVerticalRepeats: true,
  supportsBetweenMarkers: true,
  supportsMotifs: true,
};

const CROCHET_BASE_REPEATS: RepeatSemanticsRules = {
  supportsHorizontalRepeats: true,
  supportsVerticalRepeats: true,
  // Crochet rarely uses "to next marker" — between-markers in knit is
  // about even decreases on raglan lines, which doesn't translate.
  supportsBetweenMarkers: false,
  supportsMotifs: true,
};

const KNIT_TERMINOLOGY: TerminologyRules = {
  hasDialectVariants: false,
  defaultDialect: 'us',
  symbolDialect: {},
};

/** Canonical US ↔ UK crochet dialect map. Limited to symbols seeded by
 *  migrations #058 / #059; future seeds extend this here. */
const CROCHET_DIALECT_MAP: Record<string, { us: string; uk: string }> = {
  sc: { us: 'sc', uk: 'dc' },
  hdc: { us: 'hdc', uk: 'htr' },
  dc: { us: 'dc', uk: 'tr' },
  tr: { us: 'tr', uk: 'dtr' },
  dtr: { us: 'dtr', uk: 'trtr' },
  'sc-inc': { us: '2 sc in next st', uk: '2 dc in next st' },
  'hdc-inc': { us: '2 hdc in next st', uk: '2 htr in next st' },
  'dc-inc': { us: '2 dc in next st', uk: '2 tr in next st' },
  sc2tog: { us: 'sc2tog', uk: 'dc2tog' },
  hdc2tog: { us: 'hdc2tog', uk: 'htr2tog' },
  dc2tog: { us: 'dc2tog', uk: 'tr2tog' },
};

const CROCHET_TERMINOLOGY: TerminologyRules = {
  hasDialectVariants: true,
  defaultDialect: 'us',
  symbolDialect: CROCHET_DIALECT_MAP,
};

// ---------------------------------------------------------------------------
// Per-technique overlays. Each entry overrides specific facets on top of
// the craft baseline. Techniques the craft doesn't support produce a
// "standard" fallback so the engine never throws on bad combos.
// ---------------------------------------------------------------------------

interface TechniqueOverlay {
  reading?: Partial<ReadingDirectionRules>;
  repeats?: Partial<RepeatSemanticsRules>;
  /** Symbol categories whose presence implies this technique. Used by
   *  the palette filter and the validator. */
  relevantCategories: string[];
  rsOnlySymbols?: string[];
  wsOnlySymbols?: string[];
}

const KNIT_TECHNIQUE_OVERLAYS: Record<Technique, TechniqueOverlay> = {
  standard: {
    relevantCategories: ['basic', 'increase', 'decrease', 'colorwork'],
  },
  lace: {
    relevantCategories: ['basic', 'lace', 'increase', 'decrease'],
  },
  cables: {
    relevantCategories: ['basic', 'cable', 'twist', 'increase', 'decrease'],
    // Cable crosses use a cable needle and only resolve correctly when
    // worked from the right side of the fabric.
    rsOnlySymbols: ['c4f', 'c4b', 'c6f', 'c6b', 'c8f', 'c8b', 't2r', 't2l', 'rt', 'lt'],
  },
  colorwork: {
    relevantCategories: ['basic', 'colorwork'],
  },
  // Tapestry, filet, and Tunisian are crochet techniques — knit overlays
  // fall through to standard rather than producing nonsense.
  tapestry: {
    relevantCategories: ['basic', 'colorwork', 'increase', 'decrease'],
  },
  filet: {
    relevantCategories: ['basic'],
  },
  tunisian: {
    relevantCategories: ['basic'],
  },
};

const CROCHET_TECHNIQUE_OVERLAYS: Record<Technique, TechniqueOverlay> = {
  standard: {
    relevantCategories: ['basic', 'increase', 'decrease'],
  },
  lace: {
    relevantCategories: ['basic', 'special', 'increase', 'decrease'],
  },
  cables: {
    relevantCategories: ['basic', 'special', 'increase', 'decrease'],
    // Front/back post stitches are the crochet analogue of cables and
    // only render the textured side correctly on RS rows.
    rsOnlySymbols: ['fpdc', 'bpdc', 'fpsc', 'bpsc'],
  },
  colorwork: {
    relevantCategories: ['basic', 'colorwork', 'increase', 'decrease'],
  },
  tapestry: {
    relevantCategories: ['basic', 'colorwork'],
  },
  filet: {
    // Filet is read as a binary chart (filled = dc + ch / empty = open
    // mesh), so only basic stitches are needed.
    relevantCategories: ['basic'],
    repeats: { supportsVerticalRepeats: true },
  },
  tunisian: {
    relevantCategories: ['basic', 'special'],
    reading: { cellTraversal: 'forward-and-return' },
  },
};

const OVERLAYS: Record<Craft, Record<Technique, TechniqueOverlay>> = {
  knit: KNIT_TECHNIQUE_OVERLAYS,
  crochet: CROCHET_TECHNIQUE_OVERLAYS,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const compose = (
  base: ReadingDirectionRules,
  overlay: Partial<ReadingDirectionRules> | undefined,
): ReadingDirectionRules => ({ ...base, ...(overlay ?? {}) });

const composeRepeats = (
  base: RepeatSemanticsRules,
  overlay: Partial<RepeatSemanticsRules> | undefined,
): RepeatSemanticsRules => ({ ...base, ...(overlay ?? {}) });

/**
 * Return the full rule set for a (craft, technique) pair. Every facet
 * is always populated — facets that don't apply (e.g. crochet dialect
 * for knit) fall back to safe defaults rather than missing.
 */
export function getTechniqueRules(craft: Craft, technique: Technique): TechniqueRules {
  const overlay = OVERLAYS[craft][technique];
  const baseReading = craft === 'knit' ? KNIT_BASE_READING : CROCHET_BASE_READING;
  const baseRepeats = craft === 'knit' ? KNIT_BASE_REPEATS : CROCHET_BASE_REPEATS;
  const terminology = craft === 'knit' ? KNIT_TERMINOLOGY : CROCHET_TERMINOLOGY;

  return {
    craft,
    technique,
    readingDirection: compose(baseReading, overlay.reading),
    repeatSemantics: composeRepeats(baseRepeats, overlay.repeats),
    terminology,
    validation: {
      rsOnlySymbols: new Set(overlay.rsOnlySymbols ?? []),
      wsOnlySymbols: new Set(overlay.wsOnlySymbols ?? []),
      relevantSymbolCategories: new Set(overlay.relevantCategories),
    },
  };
}

/** Convenience: just the reading-direction facet. */
export function getReadingDirection(craft: Craft, technique: Technique): ReadingDirectionRules {
  return getTechniqueRules(craft, technique).readingDirection;
}

/** Convenience: just the repeat-semantics facet. */
export function getRepeatSemantics(craft: Craft, technique: Technique): RepeatSemanticsRules {
  return getTechniqueRules(craft, technique).repeatSemantics;
}

/** Convenience: just the terminology facet. */
export function getTerminology(craft: Craft, technique: Technique): TerminologyRules {
  return getTechniqueRules(craft, technique).terminology;
}

/** Convenience: just the validation facet. */
export function getValidationRules(craft: Craft, technique: Technique): ValidationRules {
  return getTechniqueRules(craft, technique).validation;
}

/**
 * The set of symbol categories considered relevant for a (craft,
 * technique). Used by the symbol palette to filter the system pack
 * client-side after the craft-scoped backend fetch returns. Empty set
 * means "no filter applied" (the palette shows everything for the craft).
 */
export function getRelevantSymbolCategories(
  craft: Craft,
  technique: Technique,
): ReadonlySet<string> {
  return getTechniqueRules(craft, technique).validation.relevantSymbolCategories;
}

/**
 * Resolve the display abbreviation for a symbol given the active
 * dialect. Returns the input symbolKey when the technique has no
 * dialect variants or the symbol isn't in the dialect map.
 */
export function resolveDialectAbbreviation(
  symbolKey: string,
  craft: Craft,
  technique: Technique,
  dialect?: TerminologyDialect,
): string {
  const t = getTerminology(craft, technique);
  if (!t.hasDialectVariants) return symbolKey;
  const entry = t.symbolDialect[symbolKey];
  if (!entry) return symbolKey;
  return entry[dialect ?? t.defaultDialect];
}

/**
 * Determine whether a chart row at `knitRow` (1-indexed, bottom-up) is
 * a right-side row given the technique. Returns `true` for every row
 * in the round when the chart is worked circularly.
 */
export function isRightSideRow(
  knitRow: number,
  workedInRound: boolean,
  craft: Craft,
  technique: Technique,
): boolean {
  const rules = getReadingDirection(craft, technique);
  if (workedInRound && rules.roundsAreAllRs) return true;
  if (!rules.alternatesRsWs) return true;
  return knitRow % 2 === 1;
}

/**
 * Build the row prefix label for chart instructions. Returns strings
 * shaped like `"Row 3 (RS):"`, `"Round 5:"`, or `"Pass 7 (forward):"`
 * depending on the technique's reading rules.
 *
 * `rowKind` is reserved for techniques with multi-pass rows (Tunisian).
 * Standard techniques pass undefined.
 */
export function buildRowPrefix(
  knitRow: number,
  workedInRound: boolean,
  craft: Craft,
  technique: Technique,
  rowKind?: 'forward' | 'return',
): string {
  const rules = getReadingDirection(craft, technique);
  if (workedInRound && rules.roundsAreAllRs) {
    return `${rules.rowLabel.inRound} ${knitRow}:`;
  }
  if (rules.cellTraversal === 'forward-and-return' && rowKind) {
    return `${rules.rowLabel.flat} ${knitRow} (${rowKind}):`;
  }
  if (rules.alternatesRsWs) {
    const isRS = isRightSideRow(knitRow, workedInRound, craft, technique);
    return `${rules.rowLabel.flat} ${knitRow} (${isRS ? 'RS' : 'WS'}):`;
  }
  return `${rules.rowLabel.flat} ${knitRow}:`;
}

/**
 * Whether the chart cells in the given row should be reversed before
 * being read (right-to-left vs left-to-right). Centralizes the
 * convention currently hardcoded in `chartInstruction.ts`.
 */
export function shouldReverseCellOrder(
  isRS: boolean,
  workedInRound: boolean,
  craft: Craft,
  technique: Technique,
): boolean {
  const rules = getReadingDirection(craft, technique);
  if (workedInRound) return true;
  switch (rules.cellTraversal) {
    case 'right-to-left-always':
      return true;
    case 'right-to-left-on-rs':
      return isRS;
    case 'forward-and-return':
      return isRS;
    default:
      return false;
  }
}
