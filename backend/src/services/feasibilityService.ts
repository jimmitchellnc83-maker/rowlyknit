/**
 * Feasibility Service
 *
 * Given a pattern, score it against the user's yarn stash + tools and emit a
 * per-requirement traffic-light verdict (🟢 🟡 🔴) plus a shopping list for
 * anything missing.
 *
 * Parsers are kept pure (string → structured hints) so they're covered by
 * unit tests without touching the database. The orchestrator `getFeasibility`
 * composes the parsers with Knex reads of the user's stash + tools.
 *
 * Pattern requirements are FREE TEXT on the `patterns` table (migration 37
 * flattened structured Ravelry objects into display strings). We parse them
 * here on demand rather than storing structured copies — reparse cost is
 * trivial and keeps the schema unchanged.
 */

import db from '../config/database';
import { NotFoundError } from '../utils/errorHandler';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LightLevel = 'green' | 'yellow' | 'red';

/** One dimension of a match (weight, yardage, fiber, tool-size-exactness). */
type DimLevel = LightLevel | 'unknown';

export interface ParsedYarnRequirement {
  totalYardage: number | null;
  weightNumber: number | null; // CYC 0-7
  weightName: string | null;
  fiberHints: string[];
  skeinCount: number | null;
  rawText: string | null;
}

export interface ParsedNeedleSizes {
  sizesMm: number[];
  rawText: string | null;
}

export interface YarnMatchCandidate {
  yarnId: string;
  name: string;
  brand: string | null;
  weight: string | null;
  fiberContent: string | null;
  yardsRemaining: number | null;
  dyeLot: string | null;
  color: string | null;
  score: number;
  level: LightLevel;
  weightLevel: DimLevel;
  yardageLevel: DimLevel;
  fiberLevel: DimLevel;
  reasons: string[];
}

export interface YarnRequirementResult {
  status: LightLevel;
  requirement: ParsedYarnRequirement;
  bestCandidate: YarnMatchCandidate | null;
  candidates: YarnMatchCandidate[];
  message: string;
}

export interface ToolMatch {
  sizeMm: number;
  status: LightLevel;
  matches: Array<{
    toolId: string;
    name: string;
    sizeMm: number | null;
    type: string;
    offsetMm: number;
  }>;
  message: string;
}

export interface ToolRequirementResult {
  status: LightLevel;
  requirements: ToolMatch[];
  rawText: string | null;
}

export interface ShoppingListItem {
  kind: 'yarn' | 'tool';
  description: string;
  reason: string;
}

export interface FeasibilityReport {
  patternId: string;
  patternName: string;
  overallStatus: LightLevel;
  yarn: YarnRequirementResult;
  tools: ToolRequirementResult;
  shoppingList: ShoppingListItem[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Reference tables (mirror `ref_yarn_weight_categories` seed + migration 42)
// ---------------------------------------------------------------------------

const WEIGHT_CATEGORIES: Array<{ number: number; name: string; aliases: string[] }> = [
  { number: 0, name: 'Lace', aliases: ['lace', 'thread', 'cobweb'] },
  { number: 1, name: 'Super Fine', aliases: ['super fine', 'superfine', 'fingering', 'sock', 'baby'] },
  { number: 2, name: 'Fine', aliases: ['fine', 'sport'] },
  { number: 3, name: 'Light', aliases: ['light', 'dk', 'double knitting', 'light worsted'] },
  { number: 4, name: 'Medium', aliases: ['medium', 'worsted', 'afghan', 'aran'] },
  { number: 5, name: 'Bulky', aliases: ['bulky', 'chunky', 'craft', 'rug'] },
  { number: 6, name: 'Super Bulky', aliases: ['super bulky', 'superbulky', 'roving'] },
  { number: 7, name: 'Jumbo', aliases: ['jumbo'] },
];

const FIBER_FAMILIES: Record<string, string[]> = {
  animal: ['wool', 'merino', 'alpaca', 'mohair', 'cashmere', 'angora', 'llama', 'yak', 'silk'],
  plant: ['cotton', 'linen', 'bamboo', 'hemp', 'ramie', 'tencel', 'lyocell', 'viscose', 'rayon'],
  synthetic: ['acrylic', 'nylon', 'polyester', 'polyamide', 'elastane', 'spandex', 'microfiber'],
};

// US knitting-needle → mm (mirrors migration 20240101000042_canonical_mm_sizes).
const US_TO_MM: Record<string, number> = {
  '000': 1.0, '00': 1.25, '0': 2.0, '1': 2.25, '1.5': 2.5, '2': 2.75,
  '2.5': 3.0, '3': 3.25, '4': 3.5, '5': 3.75, '6': 4.0, '7': 4.5,
  '8': 5.0, '9': 5.5, '10': 6.0, '10.5': 6.5, '10.75': 7.0,
  '11': 8.0, '13': 9.0, '15': 10.0, '17': 12.0, '19': 15.0,
  '35': 19.0, '50': 25.0,
};

const METERS_TO_YARDS = 1.09361;
const TOOL_TOLERANCE_GREEN_MM = 0.01;
const TOOL_TOLERANCE_YELLOW_MM = 0.25;

/** Canonical weight names for UI dropdowns / API validation. */
export const YARN_WEIGHT_NAMES = WEIGHT_CATEGORIES.map((c) => c.name);

/** Known fiber keywords, flattened for UI multi-select / API validation. */
export const KNOWN_FIBERS = Object.values(FIBER_FAMILIES).flat();

/**
 * Build a ParsedYarnRequirement from structured input (weight name, fiber
 * hints, yardage, skein count) — used by the standalone yarn-substitution
 * endpoint where the caller supplies fields directly instead of a free-text
 * pattern string. Re-uses the same alias lookup as the parser so callers
 * can pass either a canonical name ("Medium") or a common alias
 * ("worsted") and get the same result.
 */
export function buildYarnRequirement(input: {
  weightName?: string | null;
  fiberHints?: string[] | null;
  yardage?: number | null;
  skeinCount?: number | null;
}): ParsedYarnRequirement {
  let weightNumber: number | null = null;
  let weightName: string | null = null;
  if (input.weightName) {
    const lower = input.weightName.toLowerCase().trim();
    for (const cat of WEIGHT_CATEGORIES) {
      if (
        cat.name.toLowerCase() === lower ||
        cat.aliases.some((a) => a.toLowerCase() === lower)
      ) {
        weightNumber = cat.number;
        weightName = cat.name;
        break;
      }
    }
  }

  const fiberHints = (input.fiberHints ?? [])
    .map((f) => f.trim().toLowerCase())
    .filter((f) => KNOWN_FIBERS.includes(f));

  return {
    totalYardage: input.yardage != null && input.yardage > 0 ? input.yardage : null,
    weightNumber,
    weightName,
    fiberHints,
    skeinCount: input.skeinCount != null && input.skeinCount > 0 ? input.skeinCount : null,
    rawText: null,
  };
}

/**
 * Score the user's stash against a standalone yarn requirement and return a
 * ready-to-render result. Thin orchestrator around matchYarn — kept here so
 * both the feasibility flow and the standalone yarn-substitution endpoint
 * share identical matching semantics.
 */
export async function findYarnSubstitutions(
  userId: string,
  input: {
    weightName?: string | null;
    fiberHints?: string[] | null;
    yardage?: number | null;
    skeinCount?: number | null;
  },
): Promise<YarnRequirementResult> {
  const stash = await db('yarn')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      'id',
      'name',
      'brand',
      'weight',
      'fiber_content',
      'yards_remaining',
      'dye_lot',
      'color',
      'is_stash',
    );

  const req = buildYarnRequirement(input);
  return matchYarn(req, stash as YarnStashRow[]);
}

// ---------------------------------------------------------------------------
// Parsers (pure)
// ---------------------------------------------------------------------------

/**
 * Extract structured hints from a free-text yarn requirement.
 *
 * Recognizes:
 *   - yardage in yards, yds, meters, metres, or bare "m" not followed by a letter
 *   - comma grouping ("1,200 yards")
 *   - CYC weight categories + common aliases (fingering, DK, worsted, …)
 *   - skein/ball/hank counts
 *   - fiber keywords (wool, cotton, acrylic, …)
 *
 * When `estimatedYardage` is supplied (populated by Ravelry import or blog
 * extractor), it takes precedence over regex-derived yardage.
 */
export function parseYarnRequirements(
  text: string | null | undefined,
  estimatedYardage?: number | null,
): ParsedYarnRequirement {
  const raw = (text ?? '').trim();
  const result: ParsedYarnRequirement = {
    totalYardage: estimatedYardage != null && estimatedYardage > 0 ? estimatedYardage : null,
    weightNumber: null,
    weightName: null,
    fiberHints: [],
    skeinCount: null,
    rawText: raw || null,
  };
  if (!raw && result.totalYardage == null) return result;

  const lower = raw.toLowerCase();

  if (result.totalYardage == null) {
    const ydMatch = lower.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*(?:yards?|yds?)\b/);
    if (ydMatch) {
      result.totalYardage = parseInt(ydMatch[1].replace(/,/g, ''), 10);
    } else {
      // "500 m", "500 meters"; reject "500mm" / "500mg" via negative lookahead
      const mMatch = lower.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*(?:meters?|metres?|m(?![a-z]))/);
      if (mMatch) {
        const meters = parseInt(mMatch[1].replace(/,/g, ''), 10);
        result.totalYardage = Math.round(meters * METERS_TO_YARDS);
      }
    }
  }

  const skeinMatch = lower.match(/(\d+)\s*(?:skeins?|balls?|hanks?|cakes?)\b/);
  if (skeinMatch) {
    result.skeinCount = parseInt(skeinMatch[1], 10);
  }

  // Weight alias scan — longest alias first so "super fine" beats "fine".
  const flatAliases = WEIGHT_CATEGORIES.flatMap((cat) =>
    cat.aliases.map((alias) => ({ alias, number: cat.number, name: cat.name })),
  );
  flatAliases.sort((a, b) => b.alias.length - a.alias.length);
  for (const { alias, number, name } of flatAliases) {
    const re = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(lower)) {
      result.weightNumber = number;
      result.weightName = name;
      break;
    }
  }

  const hints = new Set<string>();
  for (const fibers of Object.values(FIBER_FAMILIES)) {
    for (const fiber of fibers) {
      if (new RegExp(`\\b${fiber}\\b`, 'i').test(lower)) hints.add(fiber);
    }
  }
  result.fiberHints = [...hints];

  return result;
}

/**
 * Extract needle sizes (in mm) from a free-text needle-size string.
 *
 * Recognizes:
 *   - direct mm: "4.5mm", "4.5 mm"
 *   - US sizes: "US 7", "US 10.5", "US 000" (via US→mm table)
 *
 * Returns a sorted, de-duplicated list. Circular/DPN qualifiers in the source
 * text are ignored here — matching against the stash treats any tool with a
 * given size_mm as compatible regardless of tool_category.
 */
export function parseNeedleSizes(text: string | null | undefined): ParsedNeedleSizes {
  const raw = (text ?? '').trim();
  const result: ParsedNeedleSizes = { sizesMm: [], rawText: raw || null };
  if (!raw) return result;

  const sizes = new Set<number>();

  for (const m of raw.matchAll(/(\d+(?:\.\d+)?)\s*mm\b/gi)) {
    const v = parseFloat(m[1]);
    if (v >= 0.5 && v <= 50) sizes.add(round2(v));
  }

  for (const m of raw.matchAll(/\bUS\s*(\d+(?:\.\d+)?)\b/gi)) {
    const mm = US_TO_MM[m[1]];
    if (mm != null) sizes.add(round2(mm));
  }

  result.sizesMm = [...sizes].sort((a, b) => a - b);
  return result;
}

// ---------------------------------------------------------------------------
// Matching (pure)
// ---------------------------------------------------------------------------

export interface YarnStashRow {
  id: string;
  name: string;
  brand: string | null;
  weight: string | null;
  fiber_content: string | null;
  yards_remaining: number | null;
  dye_lot: string | null;
  color: string | null;
  is_stash: boolean | null;
}

export interface ToolRow {
  id: string;
  name: string;
  type: string;
  size: string | null;
  size_mm: number | null;
  is_available: boolean | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function weightNumberFromYarnWeight(weight: string | null): number | null {
  if (!weight) return null;
  const lower = weight.toLowerCase().trim();
  if (/^[0-7]$/.test(lower)) return parseInt(lower, 10);
  for (const cat of WEIGHT_CATEGORIES) {
    if (cat.name.toLowerCase() === lower) return cat.number;
    if (cat.aliases.some((a) => a.toLowerCase() === lower)) return cat.number;
  }
  return null;
}

function fibersFromText(text: string | null): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  for (const fibers of Object.values(FIBER_FAMILIES)) {
    for (const fiber of fibers) {
      if (new RegExp(`\\b${fiber}\\b`).test(lower)) hits.add(fiber);
    }
  }
  return [...hits];
}

function familiesOf(fibers: string[]): Set<string> {
  const out = new Set<string>();
  for (const fiber of fibers) {
    for (const [family, members] of Object.entries(FIBER_FAMILIES)) {
      if (members.includes(fiber)) out.add(family);
    }
  }
  return out;
}

/** Reduce dimension levels to an overall status (unknown dims don't penalize). */
function combineDimensions(...levels: DimLevel[]): LightLevel {
  const relevant = levels.filter((l): l is LightLevel => l !== 'unknown');
  if (relevant.length === 0) return 'yellow'; // nothing evaluable — ambiguous
  if (relevant.includes('red')) return 'red';
  if (relevant.includes('yellow')) return 'yellow';
  return 'green';
}

/** Reduce a set of per-needle-size tool matches to an overall tool status. */
function aggregateToolStatus(toolMatches: ToolMatch[]): LightLevel {
  if (toolMatches.length === 0) return 'yellow';
  const statuses = toolMatches.map((t) => t.status);
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  return 'green';
}

/**
 * Compute the overall traffic-light verdict for one pattern against a
 * preloaded stash + tools list. Pure — no DB access. Shared between the
 * detail report (`getFeasibility`) and the batch summary
 * (`getFeasibilityBatch`) so both always agree.
 */
export function computePatternOverallStatus(
  pattern: {
    yarn_requirements: string | null;
    estimated_yardage?: number | null;
    needle_sizes: string | null;
  },
  stash: YarnStashRow[],
  tools: ToolRow[],
): LightLevel {
  const yarnReq = parseYarnRequirements(pattern.yarn_requirements, pattern.estimated_yardage);
  const needleReq = parseNeedleSizes(pattern.needle_sizes);
  const yarnResult = matchYarn(yarnReq, stash);
  const toolMatches = matchTools(needleReq.sizesMm, tools);
  return combineDimensions(yarnResult.status, aggregateToolStatus(toolMatches));
}

export function scoreYarnCandidate(
  req: ParsedYarnRequirement,
  yarn: YarnStashRow,
): YarnMatchCandidate {
  const reasons: string[] = [];
  let score = 0;

  // --- Weight dimension (0-60 pts) ---
  let weightLevel: DimLevel = 'unknown';
  const stashWeightNumber = weightNumberFromYarnWeight(yarn.weight);
  if (req.weightNumber != null && stashWeightNumber != null) {
    const gap = Math.abs(req.weightNumber - stashWeightNumber);
    if (gap === 0) {
      score += 60;
      weightLevel = 'green';
      reasons.push(`Weight matches (${yarn.weight})`);
    } else if (gap === 1) {
      score += 30;
      weightLevel = 'yellow';
      reasons.push(`Weight one step off (${yarn.weight} vs. ${req.weightName})`);
    } else {
      weightLevel = 'red';
      reasons.push(`Weight mismatch (${yarn.weight} vs. ${req.weightName})`);
    }
  } else if (req.weightNumber == null) {
    reasons.push('Pattern did not specify a weight');
  } else {
    reasons.push(`Stash yarn has no recognizable weight (${yarn.weight ?? 'blank'})`);
  }

  // --- Yardage dimension (0-30 pts) ---
  let yardageLevel: DimLevel = 'unknown';
  if (req.totalYardage != null && yarn.yards_remaining != null) {
    const ratio = yarn.yards_remaining / req.totalYardage;
    if (ratio >= 1.0) {
      score += 30;
      yardageLevel = 'green';
      reasons.push(`Enough yardage (${yarn.yards_remaining} / ${req.totalYardage} yds)`);
    } else if (ratio >= 0.8) {
      score += 18;
      yardageLevel = 'yellow';
      reasons.push(`Close on yardage (${yarn.yards_remaining} / ${req.totalYardage} yds)`);
    } else if (ratio >= 0.5) {
      score += 6;
      yardageLevel = 'yellow';
      reasons.push(`Short on yardage but usable (${yarn.yards_remaining} / ${req.totalYardage} yds)`);
    } else {
      yardageLevel = 'red';
      reasons.push(`Well short on yardage (${yarn.yards_remaining} / ${req.totalYardage} yds)`);
    }
  } else if (req.totalYardage == null) {
    reasons.push('Pattern did not specify yardage');
  }

  // --- Fiber dimension (0-10 pts) ---
  let fiberLevel: DimLevel = 'unknown';
  if (req.fiberHints.length > 0) {
    const stashFibers = fibersFromText(yarn.fiber_content);
    const overlap = req.fiberHints.filter((f) => stashFibers.includes(f));
    if (overlap.length === req.fiberHints.length) {
      score += 10;
      fiberLevel = 'green';
      reasons.push(`Fiber matches (${overlap.join(', ')})`);
    } else if (overlap.length > 0) {
      score += 6;
      fiberLevel = 'yellow';
      reasons.push(`Partial fiber overlap (${overlap.join(', ')})`);
    } else {
      const sharedFamily = [...familiesOf(req.fiberHints)].some((f) =>
        familiesOf(stashFibers).has(f),
      );
      if (sharedFamily) {
        score += 3;
        fiberLevel = 'yellow';
        reasons.push('Similar fiber family');
      } else {
        fiberLevel = 'red';
        reasons.push(`Different fiber (${yarn.fiber_content ?? 'unknown'})`);
      }
    }
  }

  const level = combineDimensions(weightLevel, yardageLevel, fiberLevel);

  return {
    yarnId: yarn.id,
    name: yarn.name,
    brand: yarn.brand,
    weight: yarn.weight,
    fiberContent: yarn.fiber_content,
    yardsRemaining: yarn.yards_remaining,
    dyeLot: yarn.dye_lot,
    color: yarn.color,
    score,
    level,
    weightLevel,
    yardageLevel,
    fiberLevel,
    reasons,
  };
}

export function matchYarn(
  req: ParsedYarnRequirement,
  stash: YarnStashRow[],
): YarnRequirementResult {
  const active = stash.filter((y) => y.is_stash !== false);
  const scored = active
    .map((yarn) => scoreYarnCandidate(req, yarn))
    .sort((a, b) => b.score - a.score);

  const best = scored.length > 0 ? scored[0] : null;
  const status: LightLevel = best ? best.level : 'red';

  let message: string;
  if (!best) {
    message = 'No yarn in your stash — nothing to match against.';
  } else if (status === 'green') {
    message = `"${best.name}" is a strong match for this pattern.`;
  } else if (status === 'yellow') {
    message = `"${best.name}" is a possible substitute. Check the caveats.`;
  } else {
    message = 'No close match in your stash — consider buying yarn for this pattern.';
  }

  // Only return top candidates to keep payloads small; all scored yarns are
  // already ranked by score.
  const candidates = scored.slice(0, 5);

  return { status, requirement: req, bestCandidate: best, candidates, message };
}

export function matchTools(sizesMm: number[], tools: ToolRow[]): ToolMatch[] {
  const available = tools.filter((t) => t.is_available !== false && t.size_mm != null);

  return sizesMm.map((required) => {
    const withOffsets = available
      .map((t) => ({
        toolId: t.id,
        name: t.name,
        sizeMm: t.size_mm,
        type: t.type,
        offsetMm: Math.abs((t.size_mm as number) - required),
      }))
      .sort((a, b) => a.offsetMm - b.offsetMm);

    const exact = withOffsets.filter((m) => m.offsetMm <= TOOL_TOLERANCE_GREEN_MM);
    const near = withOffsets.filter(
      (m) => m.offsetMm > TOOL_TOLERANCE_GREEN_MM && m.offsetMm <= TOOL_TOLERANCE_YELLOW_MM,
    );

    let status: LightLevel;
    let matches: ToolMatch['matches'];
    let message: string;
    if (exact.length > 0) {
      status = 'green';
      matches = exact.slice(0, 5);
      message = `You have ${exact.length} tool${exact.length === 1 ? '' : 's'} at ${required}mm.`;
    } else if (near.length > 0) {
      status = 'yellow';
      matches = near.slice(0, 5);
      message = `Closest tool is ${near[0].offsetMm.toFixed(2)}mm off — usable but will shift gauge.`;
    } else {
      status = 'red';
      matches = [];
      message = `No tool close to ${required}mm — add to shopping list.`;
    }

    return { sizeMm: required, status, matches, message };
  });
}

export function buildShoppingList(
  yarn: YarnRequirementResult,
  tools: ToolRequirementResult,
): ShoppingListItem[] {
  const items: ShoppingListItem[] = [];

  if (yarn.status !== 'green') {
    const req = yarn.requirement;
    const parts: string[] = [];
    if (req.weightName) parts.push(`${req.weightName.toLowerCase()} weight`);
    if (req.fiberHints.length > 0) parts.push(req.fiberHints.join('/'));
    parts.push('yarn');
    if (req.totalYardage) parts.push(`(~${req.totalYardage} yds)`);
    if (req.skeinCount) parts.push(`— ~${req.skeinCount} skeins`);

    items.push({
      kind: 'yarn',
      description: parts.join(' '),
      reason:
        yarn.status === 'red'
          ? 'No close match in stash.'
          : `Best candidate is a partial match: "${yarn.bestCandidate?.name ?? 'unknown'}".`,
    });
  }

  for (const tool of tools.requirements) {
    if (tool.status === 'red') {
      items.push({
        kind: 'tool',
        description: `Needle/hook at ${tool.sizeMm}mm`,
        reason: 'No matching tool in your collection.',
      });
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// DB orchestrator
// ---------------------------------------------------------------------------

/**
 * Fetch a pattern + the user's stash + tools, then compute a feasibility
 * report. Throws `NotFoundError` if the pattern doesn't exist or belongs to
 * another user.
 */
export async function getFeasibility(userId: string, patternId: string): Promise<FeasibilityReport> {
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  const [stash, tools] = await Promise.all([
    db('yarn')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .select(
        'id',
        'name',
        'brand',
        'weight',
        'fiber_content',
        'yards_remaining',
        'dye_lot',
        'color',
        'is_stash',
      ),
    db('tools')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .select('id', 'name', 'type', 'size', 'size_mm', 'is_available'),
  ]);

  const yarnReq = parseYarnRequirements(pattern.yarn_requirements, pattern.estimated_yardage);
  const needleReq = parseNeedleSizes(pattern.needle_sizes);

  const yarnResult = matchYarn(yarnReq, stash as YarnStashRow[]);
  const toolMatches = matchTools(needleReq.sizesMm, tools as ToolRow[]);

  const toolResult: ToolRequirementResult = {
    status: aggregateToolStatus(toolMatches),
    requirements: toolMatches,
    rawText: needleReq.rawText,
  };

  const overall: LightLevel = combineDimensions(yarnResult.status, toolResult.status);
  const shoppingList = buildShoppingList(yarnResult, toolResult);

  return {
    patternId: pattern.id,
    patternName: pattern.name,
    overallStatus: overall,
    yarn: yarnResult,
    tools: toolResult,
    shoppingList,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Compute overall verdicts for many (project, pattern) pairs in one go.
 * Loads the user's stash + tools + patterns once, then evaluates each pair
 * with the same parsers/matchers as `getFeasibility`. Pairs whose pattern
 * is missing or soft-deleted are skipped.
 */
export async function getFeasibilityBatch(
  userId: string,
  items: Array<{ projectId: string; patternId: string }>,
): Promise<Array<{ projectId: string; patternId: string; overallStatus: LightLevel }>> {
  if (items.length === 0) return [];

  const patternIds = [...new Set(items.map((i) => i.patternId))];

  const [patterns, stash, tools] = await Promise.all([
    db('patterns')
      .where({ user_id: userId })
      .whereIn('id', patternIds)
      .whereNull('deleted_at')
      .select('id', 'yarn_requirements', 'estimated_yardage', 'needle_sizes'),
    db('yarn')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .select(
        'id',
        'name',
        'brand',
        'weight',
        'fiber_content',
        'yards_remaining',
        'dye_lot',
        'color',
        'is_stash',
      ),
    db('tools')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .select('id', 'name', 'type', 'size', 'size_mm', 'is_available'),
  ]);

  const patternMap = new Map(patterns.map((p: any) => [p.id, p]));
  const stashRows = stash as YarnStashRow[];
  const toolRows = tools as ToolRow[];

  const summaries: Array<{ projectId: string; patternId: string; overallStatus: LightLevel }> = [];
  for (const { projectId, patternId } of items) {
    const pattern = patternMap.get(patternId);
    if (!pattern) continue;
    summaries.push({
      projectId,
      patternId,
      overallStatus: computePatternOverallStatus(pattern, stashRows, toolRows),
    });
  }

  return summaries;
}
