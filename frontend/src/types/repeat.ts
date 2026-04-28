/**
 * Repeat engine types — PR 3 of the Designer rebuild.
 *
 * The PRD's "repeat-first design" principle says real patterns are built
 * from repeats, motifs, and reusable sections rather than per-cell
 * authoring. Today's Designer has none of this: charts are flat grids
 * and `ChartOverlay` tiles bottom-left-anchored without structured
 * repeat objects. This module defines the structured form.
 *
 * Two layers:
 *   1. Within-row tokens (`RowToken`) — what fills a single row. May be
 *      literal stitches OR repeat structures embedded in the row
 *      (horizontal repeat / between-markers / mirrored).
 *   2. Section-level items (`SectionRowItem`) — what fills a section.
 *      May be literal rows OR multi-row repeat blocks (vertical / motif
 *      / nested / panel).
 *
 * The expansion engine (`utils/repeatEngine.ts`) walks both layers and
 * produces a flat `ExpandedRow[]` that downstream consumers (chart
 * renderer, instruction text generator, make-mode tracker) read.
 */

import type { Craft, Technique } from './pattern';

// ---------------------------------------------------------------------------
// Row tokens — within-row content
// ---------------------------------------------------------------------------

/** Stable per-block ID. Caller-supplied; the engine echoes it back in
 *  `ExpandedRow.source` / `ExpandedToken.source` so consumers can map
 *  expanded output back to the structured pattern model. */
export type BlockId = string;

/** Literal stitch reference. `symbolId` matches `chart_symbol_templates.symbol`. */
export interface LiteralStitchToken {
  kind: 'stitch';
  symbolId: string;
  /** Number of chart cells this stitch spans (cables span 2+). Default 1. */
  cellSpan?: number;
  /** Optional knitter note shown inline ("first row" etc.). */
  note?: string;
}

/**
 * Within-row repeat: "[k2tog, yo] 4 times". The body's tokens are
 * unrolled `count` times when the row is expanded.
 *
 * Body may itself contain repeats — nested-within-row repeats are
 * resolved recursively by the engine.
 */
export interface HorizontalRepeatToken {
  kind: 'horizontal-repeat';
  id?: BlockId;
  label?: string;
  body: RowToken[];
  count: number;
}

/**
 * Between-markers repeat: "to next marker, repeat from *". The body
 * tiles between two named markers; the engine derives the iteration
 * count from the markers' stitch positions on the row.
 *
 * Markers are passed alongside the section in the engine input — see
 * `MarkerPositions`. Resolves to a horizontal repeat at expansion time.
 */
export interface BetweenMarkersToken {
  kind: 'between-markers';
  id?: BlockId;
  label?: string;
  body: RowToken[];
  fromMarker: string;
  toMarker: string;
}

/**
 * Mirrored repeat (within a row): the body is emitted forward, then
 * again with its order reversed. Used for symmetric patterns
 * ("k2, [yo, k2tog] mirrored").
 *
 * Note: PR 3 implements *structural* mirror — the order of tokens is
 * reversed but the tokens themselves are not swapped (k2tog stays
 * k2tog). Symbol-mirroring (k2tog ↔ ssk) is a later concern that
 * needs a per-symbol mirror table on `chart_symbol_templates`.
 */
export interface MirroredToken {
  kind: 'mirrored';
  id?: BlockId;
  label?: string;
  body: RowToken[];
  axis?: 'horizontal';
}

export type RowToken =
  | LiteralStitchToken
  | HorizontalRepeatToken
  | BetweenMarkersToken
  | MirroredToken;

// ---------------------------------------------------------------------------
// Row spec — one row's content + metadata
// ---------------------------------------------------------------------------

/** A row of content. Tokens may be literals or any embedded RowToken
 *  variant; the engine expands them in order. */
export interface RowSpec {
  /** Stable per-row ID. Echoed back in `ExpandedRow.source` so consumers
   *  can attribute expanded rows back to source. */
  id?: string;
  /** Optional knitter-readable label like "Setup row" or "Pattern row 1". */
  label?: string;
  tokens: RowToken[];
}

// ---------------------------------------------------------------------------
// Section-level: vertical / motif / mirrored / panel / nested repeats
// ---------------------------------------------------------------------------

/**
 * Vertical repeat: a row sequence repeated N times stacked. The most
 * common pattern shape ("Repeat rows 1-4 5 times").
 */
export interface VerticalRepeatBlock {
  kind: 'vertical';
  id?: BlockId;
  label?: string;
  body: RowSpec[];
  count: number;
}

/**
 * Motif repeat: a 2D block tiled across BOTH dimensions. Used for
 * colorwork yokes, fair-isle bodies, and lace medallions where the
 * same motif tiles across the width AND repeats up the body.
 */
export interface MotifRepeatBlock {
  kind: 'motif';
  id?: BlockId;
  label?: string;
  body: RowSpec[];
  countHorizontal: number;
  countVertical: number;
}

/**
 * Mirrored repeat (vertical): the body is worked forward, then again
 * with its rows in reverse order. Used for symmetric shapes worked
 * top-down then bottom-up (or any symmetric vertical motif).
 */
export interface MirroredRepeatBlock {
  kind: 'mirrored';
  id?: BlockId;
  label?: string;
  body: RowSpec[];
  axis?: 'vertical';
}

/**
 * Nested repeat: an outer repeat that wraps an inner repeat. Used to
 * compose "repeat the lace pattern (which itself contains a horizontal
 * repeat) 5 times" without expanding by hand.
 */
export interface NestedRepeatBlock {
  kind: 'nested';
  id?: BlockId;
  label?: string;
  outerCount: number;
  inner: RepeatBlock;
}

/**
 * Panel repeat: side-by-side independent panels, each with its own
 * row sequence and repeat count, all worked in parallel within the
 * same physical rows.
 *
 * The number of expanded rows is the LCM of the panels' row counts —
 * each panel walks its own body, looping until all panels align at
 * their starting position again. Consumers wanting strict alignment
 * should size the panels' bodies to a common multiple.
 */
export interface PanelRepeatBlock {
  kind: 'panel';
  id?: BlockId;
  label?: string;
  panels: PanelDefinition[];
  /** How many physical rows to expand. If omitted, the engine uses LCM
   *  of the panels' body lengths. */
  rows?: number;
}

export interface PanelDefinition {
  id: string;
  /** Display width (in stitches/cells) for the panel. */
  width: number;
  /** Optional knitter label ("Cable A", "Lace panel"). */
  label?: string;
  /** The row sequence that repeats indefinitely within this panel. */
  body: RowSpec[];
}

export type RepeatBlock =
  | VerticalRepeatBlock
  | MotifRepeatBlock
  | MirroredRepeatBlock
  | NestedRepeatBlock
  | PanelRepeatBlock;

// ---------------------------------------------------------------------------
// Section row sequence
// ---------------------------------------------------------------------------

/** A top-level item in a section's row sequence. Either a literal row
 *  or a multi-row repeat block. */
export type SectionRowItem =
  | { kind: 'literal'; row: RowSpec }
  | { kind: 'repeat'; block: RepeatBlock };

/** Marker positions used by between-markers repeats. Keys are marker
 *  IDs; values are 1-indexed stitch positions on the row. */
export type MarkerPositions = Record<string, number>;

/** Inputs to {@link expandSection}. */
export interface SectionRowSequence {
  items: SectionRowItem[];
  /** Marker positions per row, keyed by row id. Within-row repeats
   *  using `between-markers` resolve their counts via these positions. */
  markersByRow?: Record<string, MarkerPositions>;
  /** Optional craft + technique for engines that need to consult
   *  `techniqueRules` while expanding (e.g. mirror semantics). */
  craft?: Craft;
  technique?: Technique;
}

// ---------------------------------------------------------------------------
// Expansion output
// ---------------------------------------------------------------------------

export interface ExpandedToken {
  kind: 'stitch';
  symbolId: string;
  cellSpan: number;
  /** Source attribution — null when the token came from a literal row
   *  (no horizontal repeat wrapping it). */
  source: ExpandedTokenSource | null;
  note?: string;
}

export interface ExpandedTokenSource {
  /** The within-row repeat block id this token belongs to. */
  blockId: BlockId | null;
  /** 1-indexed iteration number within the within-row repeat. */
  iteration: number;
}

export interface ExpandedRowSource {
  /** Source repeat block id for the row, or null when the row was a
   *  literal at the section level. */
  blockId: BlockId | null;
  /** 1-indexed iteration of the section-level repeat. */
  iteration: number;
  /** 1-indexed row position within the repeat's body (or 1 for literals). */
  positionInBody: number;
  /** Source row id from the original RowSpec, when one was provided. */
  rowId: string | null;
}

export interface ExpandedRow {
  /** 1-indexed row number in the expanded flat sequence. */
  rowNumber: number;
  tokens: ExpandedToken[];
  source: ExpandedRowSource;
  /** Optional row label propagated from the source RowSpec. */
  label?: string;
  /**
   * Per-panel rows — when this expansion came from a `panel` repeat,
   * each panel's row contributes its own token slice in panel order.
   * Empty when the row is not from a panel block.
   */
  panelSlices?: ExpandedPanelSlice[];
  /** Non-fatal warnings from the expansion of this row (e.g. a
   *  between-markers count rounded down). */
  warnings: string[];
}

export interface ExpandedPanelSlice {
  /** Panel id from the source PanelDefinition. */
  panelId: string;
  /** Panel display width (in stitches/cells). */
  width: number;
  tokens: ExpandedToken[];
  /** 1-indexed iteration of the panel's body (panels loop independently). */
  iteration: number;
  /** 1-indexed position within the panel's body. */
  positionInBody: number;
}

export interface ExpansionResult {
  rows: ExpandedRow[];
  /** Section-level warnings (e.g. "between-markers count was zero"). */
  warnings: string[];
}
