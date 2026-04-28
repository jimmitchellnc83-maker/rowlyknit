/**
 * Canonical Pattern entity — frontend types.
 *
 * Mirrors `backend/src/types/pattern.ts` and the `pattern_models` table
 * (migration #062). Both sides hold identical JSONB shapes so the API
 * contract is just `JSON.stringify` away.
 *
 * Note: this is the canonical *design* model used by the Designer rebuild.
 * The pre-existing `pattern.types.ts` covers the legacy PDF-pattern entity
 * (sections, bookmarks, highlights on a pattern PDF) and is unrelated.
 *
 * See `docs/PATTERN_DESIGNER_PRD.md` for the why.
 */

export type Craft = 'knit' | 'crochet';

export type Technique =
  | 'standard'
  | 'lace'
  | 'cables'
  | 'colorwork'
  | 'tapestry'
  | 'filet'
  | 'tunisian';

export type LengthUnit = 'in' | 'cm';

export type SectionId = string;

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

export type SectionParameters = Record<string, unknown>;

export interface ChartPlacement {
  chartId?: string | null;
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
  stitches: number;
  rows: number;
  measurement: number;
  unit: LengthUnit;
  blocked?: boolean | null;
  toolSize?: string | null;
  notes?: string | null;
}

export interface PatternSize {
  id: string;
  label: string;
  measurements: Record<string, Record<string, number>>;
}

export interface SizeSet {
  active: string;
  sizes: PatternSize[];
}

export interface LegendEntry {
  symbol: string;
  nameOverride?: string | null;
  abbreviationOverride?: string | null;
}

export interface PatternLegend {
  overrides: Record<string, LegendEntry>;
}

export interface MaterialEntry {
  id: string;
  name: string;
  colorHex?: string | null;
  yardageMin?: number | null;
  yardageMax?: number | null;
  kind?: 'yarn' | 'tool' | 'notion';
}

export interface ProgressState {
  activeSectionId?: string | null;
  rowsBySection?: Record<string, number>;
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
