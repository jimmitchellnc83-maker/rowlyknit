/**
 * Canonical Pattern entity — backend types.
 *
 * Mirrors the `pattern_models` table introduced in migration #062 and the
 * matching frontend type at `frontend/src/types/pattern.ts`. The two sides
 * are kept structurally identical (JSONB shapes match field-for-field) so
 * the API contract is just `JSON.stringify` away.
 *
 * See `docs/PATTERN_DESIGNER_PRD.md` and
 * `docs/PATTERN_DESIGNER_GAP_ANALYSIS.md` for the why; this file is the
 * what.
 */

export type Craft = 'knit' | 'crochet';

/**
 * Knit/crochet technique. Drives chart-cell semantics, terminology, and
 * (future) repeat behavior. `standard` is the safe default for any draft
 * imported from the legacy form path — that path doesn't capture
 * technique, so the importer normalizes everything to `standard`.
 */
export type Technique =
  | 'standard'
  | 'lace'
  | 'cables'
  | 'colorwork'
  | 'tapestry'
  | 'filet'
  | 'tunisian';

export type LengthUnit = 'in' | 'cm';

/** A pattern row has a stable id; users will reorder, rename, retype them. */
export type SectionId = string;

/**
 * Section "kind" enumerates the eight legacy itemTypes plus the custom-
 * draft section subtypes. After PR 1 the canonical model sees the legacy
 * world only through `kind`; downstream rebuilds (PR 2+) layer
 * technique-aware behavior on top.
 */
export type SectionKind =
  | 'sweater-body'
  | 'sweater-sleeve'
  | 'hat'
  | 'scarf'
  | 'blanket'
  | 'shawl'
  | 'mittens'
  | 'socks'
  | 'custom-draft-section';

/**
 * Per-section parameters preserved verbatim from the legacy form snapshot.
 * The importer never re-runs the compute math; it only reshapes input
 * fields into a per-section bag so the downstream rebuild can keep using
 * the same compute functions until they are replaced section-by-section.
 *
 * Shape is intentionally permissive: every legacy `DesignerFormSnapshot`
 * field that belongs to this section ends up here under its original key.
 */
export type SectionParameters = Record<string, unknown>;

export interface ChartPlacement {
  /** ID of a `charts` library row, when the section pulls from there. */
  chartId?: string | null;
  /**
   * How the chart tiles across the section. `tile` mirrors today's
   * `ChartOverlay` (bottom-left anchored repeat); `single` draws once.
   * Future: `between-markers`, `mirrored`, `panel-aware`.
   */
  repeatMode?: 'tile' | 'single';
}

export interface PatternSection {
  id: SectionId;
  name: string;
  kind: SectionKind;
  sortOrder: number;
  parameters: SectionParameters;
  chartPlacement?: ChartPlacement | null;
  notes?: string | null;
}

export interface GaugeProfile {
  /** Stitches in the swatch, over `measurement` units. */
  stitches: number;
  /** Rows in the swatch, over `measurement` units. */
  rows: number;
  /** Length the stitch + row counts cover. Typical values: 4 (in) or 10 (cm). */
  measurement: number;
  unit: LengthUnit;
  /** Reserved for future swatch-detail capture. */
  blocked?: boolean | null;
  toolSize?: string | null;
  notes?: string | null;
}

export interface PatternSize {
  id: string;
  /** Display label such as "M" or "32 in chest"; free-form. */
  label: string;
  /**
   * Per-section measurement overrides keyed by section id. PR 1 stores
   * exactly one size with empty overrides; multi-size grading lands in a
   * later PR.
   */
  measurements: Record<string, Record<string, number>>;
}

export interface SizeSet {
  /** Active size id; matches one of `sizes[].id`. */
  active: string;
  sizes: PatternSize[];
}

export interface LegendEntry {
  /** Symbol key from `chart_symbol_templates.symbol`. */
  symbol: string;
  /** Pattern-level override of the symbol's display name (optional). */
  nameOverride?: string | null;
  /** Pattern-level override of the symbol's abbreviation (optional). */
  abbreviationOverride?: string | null;
}

export interface PatternLegend {
  /** Pattern-specific overrides keyed by symbol key. */
  overrides: Record<string, LegendEntry>;
}

export interface MaterialEntry {
  id: string;
  /** Free-text yarn or material name; not yet linked to the stash. */
  name: string;
  /** Hex color used in the chart, when this entry maps to a chart color. */
  colorHex?: string | null;
  /** Estimated yardage range — output of `yarnEstimatePerColor`. */
  yardageMin?: number | null;
  yardageMax?: number | null;
  /** Reserved for needles, hooks, notions; populated in a later PR. */
  kind?: 'yarn' | 'tool' | 'notion';
}

export interface ProgressState {
  /** Section currently being worked. Null when no progress yet. */
  activeSectionId?: string | null;
  /** Per-section row position; section id → 1-indexed row. */
  rowsBySection?: Record<string, number>;
  /** Reserved for repeat counters, panel positions, "at the same time" state. */
  counters?: Record<string, number>;
}

export interface CanonicalPattern {
  id: string;
  userId: string;
  sourcePatternId: string | null;
  sourceProjectId: string | null;

  name: string;
  craft: Craft;
  technique: Technique;

  gaugeProfile: GaugeProfile;
  sizeSet: SizeSet;
  sections: PatternSection[];
  legend: PatternLegend;
  materials: MaterialEntry[];
  progressState: ProgressState;
  notes: string | null;

  schemaVersion: number;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Raw row shape as Knex returns it. Service-layer code converts to and
 * from `CanonicalPattern`; controllers only ever see the camelCase form.
 */
export interface PatternModelRow {
  id: string;
  user_id: string;
  source_pattern_id: string | null;
  source_project_id: string | null;
  name: string;
  craft: Craft;
  technique: Technique;
  gauge_profile: GaugeProfile | string;
  size_set: SizeSet | string;
  sections: PatternSection[] | string;
  legend: PatternLegend | string;
  materials: MaterialEntry[] | string;
  progress_state: ProgressState | string;
  notes: string | null;
  schema_version: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}
