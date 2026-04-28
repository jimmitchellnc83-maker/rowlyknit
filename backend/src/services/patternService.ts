/**
 * Pattern Service — canonical Pattern entity CRUD + legacy importer.
 *
 * PR 1 of the Designer rebuild (see `docs/PATTERN_DESIGNER_PRD.md` and
 * `docs/PATTERN_DESIGNER_GAP_ANALYSIS.md`). This file owns the read/write
 * surface for the `pattern_models` table introduced in migration #062.
 *
 * The importer (`importDesignerSnapshot`) takes a frontend
 * `DesignerFormSnapshot` (raw JSONB shape — we don't import frontend code
 * on the backend) and produces a canonical `CanonicalPattern` row written
 * alongside the existing `metadata.designer` blob. The legacy form path is
 * untouched in this PR; both shapes live concurrently until a later PR
 * cuts the UI over.
 *
 * Idempotency: a (source_pattern_id) or (source_project_id) link is
 * unique-when-set at the DB level, so re-importing the same legacy row
 * UPDATEs the canonical twin instead of inserting a duplicate.
 */

import { randomUUID } from 'crypto';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import type {
  CanonicalPattern,
  Craft,
  GaugeProfile,
  MaterialEntry,
  PatternLegend,
  PatternModelRow,
  PatternSection,
  PatternSize,
  ProgressState,
  SectionKind,
  SectionParameters,
  SizeSet,
  Technique,
} from '../types/pattern';

// ---------------------------------------------------------------------------
// Legacy snapshot mirror types
//
// The backend can't import from `frontend/src/...`, but the JSONB shape is
// stable. These mirror the fields the importer touches; everything else on
// the snapshot is preserved verbatim into the destination section's
// `parameters` bag and never loses data.
// ---------------------------------------------------------------------------

interface LegacyDraftSection {
  id: string;
  name: string;
  type: 'straight' | 'ribbing' | 'increase' | 'decrease' | 'cast_off_each_side' | 'bind_off';
  rows: number;
  changePerSide: number;
  note: string;
}

interface LegacyCustomDraft {
  craftMode?: 'hand' | 'machine';
  startingStitches?: number;
  sections?: LegacyDraftSection[];
}

interface LegacyColorSwatch {
  id?: string;
  hex?: string;
  name?: string;
  yardage?: number;
}

/**
 * Permissive mirror of the frontend `DesignerFormSnapshot`. Every field is
 * optional because legacy rows pre-date many of these keys. The importer
 * tolerates missing fields and falls back to safe defaults; it never
 * throws on shape variance.
 */
export interface LegacyDesignerSnapshot {
  unit?: 'in' | 'cm';
  craft?: Craft;
  gaugeStitches?: number | '';
  gaugeRows?: number | '';
  gaugeMeasurement?: number | '';
  itemType?: string;
  customDraft?: LegacyCustomDraft;
  colors?: LegacyColorSwatch[];
  chart?: unknown;
  chartAssetId?: string | null;
  patternTitle?: string;
  patternNotes?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Importer
// ---------------------------------------------------------------------------

const KNOWN_ITEM_TYPES = new Set([
  'sweater',
  'hat',
  'scarf',
  'blanket',
  'shawl',
  'mittens',
  'socks',
  'custom',
]);

interface ImportInput {
  snapshot: LegacyDesignerSnapshot;
  userId: string;
  /** Display name for the canonical row. Falls back to snapshot title or
   *  a generic label. */
  name?: string;
  sourcePatternId?: string | null;
  sourceProjectId?: string | null;
}

/**
 * Translate a legacy `DesignerFormSnapshot` into a canonical
 * `CanonicalPattern` and persist it. Re-runs for the same source link
 * UPDATE the existing twin in place.
 *
 * The translation is structural only — no compute math runs here. Every
 * legacy form field flows through to the appropriate section's
 * `parameters` bag so downstream code can keep invoking the existing
 * `compute*` functions until they're replaced section-by-section.
 */
export const importDesignerSnapshot = async (
  input: ImportInput,
): Promise<CanonicalPattern> => {
  const built = buildCanonicalFromSnapshot(input);

  // Conflict resolution: a unique partial index on
  // (source_pattern_id) WHERE NOT NULL — and the same on
  // (source_project_id) — guarantees at most one canonical twin per
  // legacy source. If a twin already exists we PATCH it instead of
  // inserting a duplicate. We resolve by looking up first; doing this in
  // SQL via ON CONFLICT would require either column to be the conflict
  // target, which is awkward when both can be NULL.
  const existing = await findExistingTwin({
    userId: input.userId,
    sourcePatternId: input.sourcePatternId ?? null,
    sourceProjectId: input.sourceProjectId ?? null,
  });

  if (existing) {
    return updatePattern(existing.id, input.userId, {
      name: built.name,
      craft: built.craft,
      technique: built.technique,
      gaugeProfile: built.gaugeProfile,
      sizeSet: built.sizeSet,
      sections: built.sections,
      legend: built.legend,
      materials: built.materials,
      // Preserve any progress already recorded against the canonical twin
      // — we never want a re-import to clobber row counters the user has
      // already accumulated.
      notes: built.notes,
    });
  }

  return insertCanonical(built, input);
};

interface BuiltCanonical {
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
}

/**
 * Pure transform — exported for tests so each itemType branch can be
 * exercised without touching the database.
 */
export const buildCanonicalFromSnapshot = (
  input: ImportInput,
): BuiltCanonical => {
  const { snapshot } = input;
  const itemType = snapshot.itemType ?? 'sweater';

  const craft: Craft = snapshot.craft === 'crochet' ? 'crochet' : 'knit';
  // Legacy snapshots don't capture technique; default everything to
  // `standard` and let the rebuild's technique-aware UI override later.
  const technique: Technique = 'standard';

  const name = pickName(input, itemType);
  const gaugeProfile = buildGaugeProfile(snapshot);
  const sections = buildSectionsFor(itemType, snapshot);
  const sizeSet = buildSingleSizeSet();
  const legend: PatternLegend = { overrides: {} };
  const materials = buildMaterialsFromColors(snapshot.colors);
  const progressState: ProgressState = {};
  const notes = typeof snapshot.patternNotes === 'string' && snapshot.patternNotes.trim().length > 0
    ? snapshot.patternNotes
    : null;

  return {
    name,
    craft,
    technique,
    gaugeProfile,
    sizeSet,
    sections,
    legend,
    materials,
    progressState,
    notes,
  };
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  sweater: 'Sweater',
  hat: 'Hat',
  scarf: 'Scarf',
  blanket: 'Blanket',
  shawl: 'Shawl',
  mittens: 'Mittens',
  socks: 'Socks',
  custom: 'Custom shape',
};

const pickName = (input: ImportInput, itemType: string): string => {
  if (input.name && input.name.trim().length > 0) return input.name.trim();
  const title = input.snapshot.patternTitle;
  if (typeof title === 'string' && title.trim().length > 0) return title.trim();
  return ITEM_TYPE_LABEL[itemType] ?? 'Pattern';
};

const buildGaugeProfile = (snapshot: LegacyDesignerSnapshot): GaugeProfile => {
  const unit = snapshot.unit === 'cm' ? 'cm' : 'in';
  return {
    stitches: numberOrZero(snapshot.gaugeStitches),
    rows: numberOrZero(snapshot.gaugeRows),
    // Legacy snapshots store gauge over a single user-entered measurement
    // (typically 4 in or 10 cm). Preserve verbatim — callers convert to a
    // per-unit rate via the existing `normalizedGauge` helper.
    measurement: numberOrZero(snapshot.gaugeMeasurement) || (unit === 'cm' ? 10 : 4),
    unit,
    blocked: null,
    toolSize: null,
    notes: null,
  };
};

const buildSingleSizeSet = (): SizeSet => {
  const id = randomUUID();
  const size: PatternSize = {
    id,
    label: 'Default',
    measurements: {},
  };
  return { active: id, sizes: [size] };
};

const buildMaterialsFromColors = (
  colors: LegacyColorSwatch[] | undefined,
): MaterialEntry[] => {
  if (!Array.isArray(colors)) return [];
  return colors.map<MaterialEntry>((c) => ({
    id: typeof c.id === 'string' && c.id.length > 0 ? c.id : randomUUID(),
    name: typeof c.name === 'string' ? c.name : 'Yarn',
    colorHex: typeof c.hex === 'string' ? c.hex : null,
    yardageMin: null,
    yardageMax: null,
    kind: 'yarn',
  }));
};

/**
 * Produce a section list for the given legacy itemType. Every relevant
 * `DesignerFormSnapshot` field flows into the destination section's
 * `parameters` bag verbatim; nothing is dropped or transformed beyond the
 * obvious key picks.
 */
const buildSectionsFor = (
  itemType: string,
  snapshot: LegacyDesignerSnapshot,
): PatternSection[] => {
  if (!KNOWN_ITEM_TYPES.has(itemType)) {
    // Unknown / future itemType — preserve the snapshot under one
    // catch-all section so no data is lost.
    return [
      makeSection({
        name: ITEM_TYPE_LABEL[itemType] ?? 'Pattern',
        kind: 'sweater-body',
        sortOrder: 0,
        parameters: { ...snapshot, _legacyItemType: itemType },
      }),
    ];
  }

  switch (itemType) {
    case 'sweater':
      return buildSweaterSections(snapshot);
    case 'hat':
      return [
        makeSection({
          name: 'Hat',
          kind: 'hat',
          sortOrder: 0,
          parameters: pickKeys(snapshot, [
            'headCircumference',
            'negativeEaseAtBrim',
            'hatTotalHeight',
            'hatBrimDepth',
            'hatCrownHeight',
            'panelType',
          ]),
        }),
      ];
    case 'scarf':
      return [
        makeSection({
          name: 'Scarf',
          kind: 'scarf',
          sortOrder: 0,
          parameters: pickKeys(snapshot, [
            'scarfWidth',
            'scarfLength',
            'scarfFringeLength',
          ]),
        }),
      ];
    case 'blanket':
      return [
        makeSection({
          name: 'Blanket',
          kind: 'blanket',
          sortOrder: 0,
          parameters: pickKeys(snapshot, [
            'blanketWidth',
            'blanketLength',
            'blanketBorderDepth',
          ]),
        }),
      ];
    case 'shawl':
      return [
        makeSection({
          name: 'Shawl',
          kind: 'shawl',
          sortOrder: 0,
          parameters: pickKeys(snapshot, [
            'shawlWingspan',
            'shawlInitialCastOn',
          ]),
        }),
      ];
    case 'mittens':
      return [
        makeSection({
          name: 'Mittens',
          kind: 'mittens',
          sortOrder: 0,
          parameters: pickKeys(snapshot, [
            'handCircumference',
            'negativeEaseAtMittenCuff',
            'thumbCircumference',
            'mittenCuffDepth',
            'cuffToThumbLength',
            'thumbGussetLength',
            'thumbToTipLength',
            'thumbLength',
          ]),
        }),
      ];
    case 'socks':
      return [
        makeSection({
          name: 'Socks',
          kind: 'socks',
          sortOrder: 0,
          parameters: pickKeys(snapshot, [
            'ankleCircumference',
            'negativeEaseAtSockCuff',
            'footCircumference',
            'sockCuffDepth',
            'legLength',
            'footLength',
          ]),
        }),
      ];
    case 'custom':
      return buildCustomSections(snapshot);
    default:
      // Unreachable given the KNOWN_ITEM_TYPES guard above.
      return [];
  }
};

const buildSweaterSections = (
  snapshot: LegacyDesignerSnapshot,
): PatternSection[] => {
  const bodyParams = pickKeys(snapshot, [
    'chestCircumference',
    'easeAtChest',
    'totalLength',
    'hemDepth',
    'useWaistShaping',
    'waistCircumference',
    'easeAtWaist',
    'waistHeightFromHem',
    'useArmhole',
    'armholeDepth',
    'shoulderWidth',
    'panelType',
    'necklineDepth',
    'neckOpeningWidth',
  ]);
  const sleeveParams = pickKeys(snapshot, [
    'cuffCircumference',
    'easeAtCuff',
    'bicepCircumference',
    'easeAtBicep',
    'cuffToUnderarmLength',
    'cuffDepth',
    // Sleeve cap math depends on body's armhole shaping; preserve the
    // body-side fields here so a section-only consumer still has them.
    'useArmhole',
    'armholeDepth',
  ]);
  return [
    makeSection({
      name: 'Body',
      kind: 'sweater-body',
      sortOrder: 0,
      parameters: bodyParams,
    }),
    makeSection({
      name: 'Sleeve',
      kind: 'sweater-sleeve',
      sortOrder: 1,
      parameters: sleeveParams,
    }),
  ];
};

const buildCustomSections = (
  snapshot: LegacyDesignerSnapshot,
): PatternSection[] => {
  const draft: LegacyCustomDraft = snapshot.customDraft ?? {};
  const startingStitches = numberOrZero(draft.startingStitches) || 100;
  const craftMode = draft.craftMode === 'machine' ? 'machine' : 'hand';
  const draftSections = Array.isArray(draft.sections) ? draft.sections : [];

  if (draftSections.length === 0) {
    return [
      makeSection({
        name: 'Custom shape',
        kind: 'custom-draft-section',
        sortOrder: 0,
        parameters: {
          startingStitches,
          craftMode,
          type: 'straight',
          rows: 0,
          changePerSide: 0,
        },
      }),
    ];
  }

  return draftSections.map((s, i) =>
    makeSection({
      name: s.name && s.name.length > 0 ? s.name : `Section ${i + 1}`,
      kind: 'custom-draft-section',
      sortOrder: i,
      parameters: {
        // First section needs the starting cast-on; later sections
        // inherit it via the compute pipeline. Recording it on every
        // section keeps each one self-describing.
        startingStitches,
        craftMode,
        type: s.type,
        rows: numberOrZero(s.rows),
        changePerSide: numberOrZero(s.changePerSide),
        legacySectionId: s.id,
      },
      notes: s.note && s.note.length > 0 ? s.note : null,
    }),
  );
};

interface MakeSectionInput {
  name: string;
  kind: SectionKind;
  sortOrder: number;
  parameters: SectionParameters;
  notes?: string | null;
}

const makeSection = (input: MakeSectionInput): PatternSection => ({
  id: randomUUID(),
  name: input.name,
  kind: input.kind,
  sortOrder: input.sortOrder,
  parameters: input.parameters,
  chartPlacement: null,
  notes: input.notes ?? null,
});

const pickKeys = (
  snapshot: LegacyDesignerSnapshot,
  keys: string[],
): SectionParameters => {
  const out: SectionParameters = {};
  for (const k of keys) {
    if (snapshot[k] !== undefined) out[k] = snapshot[k];
  }
  return out;
};

const numberOrZero = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

interface FindTwinInput {
  userId: string;
  sourcePatternId: string | null;
  sourceProjectId: string | null;
}

const findExistingTwin = async (
  input: FindTwinInput,
): Promise<PatternModelRow | undefined> => {
  if (!input.sourcePatternId && !input.sourceProjectId) return undefined;

  const query = db<PatternModelRow>('pattern_models')
    .where({ user_id: input.userId })
    .whereNull('deleted_at');

  if (input.sourcePatternId) {
    query.andWhere({ source_pattern_id: input.sourcePatternId });
  } else if (input.sourceProjectId) {
    query.andWhere({ source_project_id: input.sourceProjectId });
  }

  return query.first();
};

const insertCanonical = async (
  built: BuiltCanonical,
  input: ImportInput,
): Promise<CanonicalPattern> => {
  const [row] = await db<PatternModelRow>('pattern_models')
    .insert({
      user_id: input.userId,
      source_pattern_id: input.sourcePatternId ?? null,
      source_project_id: input.sourceProjectId ?? null,
      name: built.name,
      craft: built.craft,
      technique: built.technique,
      gauge_profile: JSON.stringify(built.gaugeProfile),
      size_set: JSON.stringify(built.sizeSet),
      sections: JSON.stringify(built.sections),
      legend: JSON.stringify(built.legend),
      materials: JSON.stringify(built.materials),
      progress_state: JSON.stringify(built.progressState),
      notes: built.notes,
      schema_version: 1,
    })
    .returning('*');

  return rowToPattern(row);
};

export interface ListPatternsOpts {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export const listPatterns = async (
  userId: string,
  opts: ListPatternsOpts = {},
): Promise<CanonicalPattern[]> => {
  const query = db<PatternModelRow>('pattern_models')
    .where({ user_id: userId })
    .orderBy('updated_at', 'desc');

  if (!opts.includeDeleted) query.whereNull('deleted_at');
  if (opts.limit) query.limit(opts.limit);
  if (opts.offset) query.offset(opts.offset);

  const rows = await query;
  return rows.map(rowToPattern);
};

export const getPattern = async (
  id: string,
  userId: string,
): Promise<CanonicalPattern | null> => {
  const row = await db<PatternModelRow>('pattern_models')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();
  return row ? rowToPattern(row) : null;
};

export interface CreatePatternInput {
  name: string;
  craft: Craft;
  technique?: Technique;
  gaugeProfile?: GaugeProfile;
  sizeSet?: SizeSet;
  sections?: PatternSection[];
  legend?: PatternLegend;
  materials?: MaterialEntry[];
  progressState?: ProgressState;
  notes?: string | null;
  sourcePatternId?: string | null;
  sourceProjectId?: string | null;
}

export const createPattern = async (
  userId: string,
  input: CreatePatternInput,
): Promise<CanonicalPattern> => {
  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError('name is required');
  }
  if (input.craft !== 'knit' && input.craft !== 'crochet') {
    throw new ValidationError('craft must be knit or crochet');
  }

  const [row] = await db<PatternModelRow>('pattern_models')
    .insert({
      user_id: userId,
      source_pattern_id: input.sourcePatternId ?? null,
      source_project_id: input.sourceProjectId ?? null,
      name: input.name.trim(),
      craft: input.craft,
      technique: input.technique ?? 'standard',
      gauge_profile: JSON.stringify(input.gaugeProfile ?? defaultGaugeProfile()),
      size_set: JSON.stringify(input.sizeSet ?? buildSingleSizeSet()),
      sections: JSON.stringify(input.sections ?? []),
      legend: JSON.stringify(input.legend ?? { overrides: {} }),
      materials: JSON.stringify(input.materials ?? []),
      progress_state: JSON.stringify(input.progressState ?? {}),
      notes: input.notes ?? null,
      schema_version: 1,
    })
    .returning('*');

  return rowToPattern(row);
};

export interface UpdatePatternInput {
  name?: string;
  craft?: Craft;
  technique?: Technique;
  gaugeProfile?: GaugeProfile;
  sizeSet?: SizeSet;
  sections?: PatternSection[];
  legend?: PatternLegend;
  materials?: MaterialEntry[];
  progressState?: ProgressState;
  notes?: string | null;
}

export const updatePattern = async (
  id: string,
  userId: string,
  patch: UpdatePatternInput,
): Promise<CanonicalPattern> => {
  const existing = await db<PatternModelRow>('pattern_models')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();
  if (!existing) throw new NotFoundError('Pattern not found');

  const update: Record<string, unknown> = { updated_at: new Date() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.craft !== undefined) update.craft = patch.craft;
  if (patch.technique !== undefined) update.technique = patch.technique;
  if (patch.gaugeProfile !== undefined)
    update.gauge_profile = JSON.stringify(patch.gaugeProfile);
  if (patch.sizeSet !== undefined) update.size_set = JSON.stringify(patch.sizeSet);
  if (patch.sections !== undefined) update.sections = JSON.stringify(patch.sections);
  if (patch.legend !== undefined) update.legend = JSON.stringify(patch.legend);
  if (patch.materials !== undefined)
    update.materials = JSON.stringify(patch.materials);
  if (patch.progressState !== undefined)
    update.progress_state = JSON.stringify(patch.progressState);
  if (patch.notes !== undefined) update.notes = patch.notes;

  const [row] = await db<PatternModelRow>('pattern_models')
    .where({ id, user_id: userId })
    .update(update)
    .returning('*');

  return rowToPattern(row);
};

export const softDeletePattern = async (
  id: string,
  userId: string,
): Promise<void> => {
  const affected = await db<PatternModelRow>('pattern_models')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .update({ deleted_at: new Date(), updated_at: new Date() });
  if (affected === 0) throw new NotFoundError('Pattern not found');
};

const defaultGaugeProfile = (): GaugeProfile => ({
  stitches: 0,
  rows: 0,
  measurement: 4,
  unit: 'in',
  blocked: null,
  toolSize: null,
  notes: null,
});

const parseJsonb = <T>(value: T | string | null | undefined, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value;
};

const toIsoString = (v: Date | string): string =>
  v instanceof Date ? v.toISOString() : v;

const rowToPattern = (row: PatternModelRow): CanonicalPattern => ({
  id: row.id,
  userId: row.user_id,
  sourcePatternId: row.source_pattern_id,
  sourceProjectId: row.source_project_id,
  name: row.name,
  craft: row.craft,
  technique: row.technique,
  gaugeProfile: parseJsonb<GaugeProfile>(row.gauge_profile, defaultGaugeProfile()),
  sizeSet: parseJsonb<SizeSet>(row.size_set, { active: '', sizes: [] }),
  sections: parseJsonb<PatternSection[]>(row.sections, []),
  legend: parseJsonb<PatternLegend>(row.legend, { overrides: {} }),
  materials: parseJsonb<MaterialEntry[]>(row.materials, []),
  progressState: parseJsonb<ProgressState>(row.progress_state, {}),
  notes: row.notes,
  schemaVersion: row.schema_version,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
  deletedAt: row.deleted_at ? toIsoString(row.deleted_at) : null,
});
