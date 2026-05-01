import axios from 'axios';

/**
 * Compact Ravelry pattern shape returned by the backend's normalized response
 * (GET /api/ravelry/patterns/search, GET /api/ravelry/favorites, GET /api/ravelry/patterns/:id).
 *
 * This mirrors the inline interface in RavelryPatternSearch.tsx. Kept here so sync/favorites
 * pages can consume the same type without depending on a modal component.
 */
export interface RavelryPattern {
  id: number;
  name: string;
  designer: string | null;
  difficultyAverage: number | null;
  ratingAverage: number | null;
  yarnWeight: string | null;
  yardageMax: number | null;
  photoUrl: string | null;
  photoSquareUrl: string | null;
  categories: string[];
  craft: string | null;
  description?: string | null;
  gauge?: string | null;
  needleSizes?: any[] | null;
  sizesAvailable?: any[] | null;
  yarnSuggestions?: Array<{ yarnName?: string; yarnCompany?: string; quantity?: string }>;
}

/**
 * Shape the Rowly POST /api/patterns endpoint expects (minus fields we don't touch).
 */
export interface RavelryPatternImportData {
  name: string;
  designer: string;
  difficulty: string;
  category: string;
  description: string;
  photoUrl?: string;
  needleSizes?: string;
  sizesAvailable?: string;
  yarnRequirements?: string;
  estimatedYardage?: number;
  gauge?: string;
  sourceUrl?: string;
}

export function ravelryPatternSourceUrl(id: number): string {
  return `https://www.ravelry.com/patterns/library/${id}`;
}

/**
 * Extract the Ravelry pattern ID from a `source_url` string, if it matches the
 * ravelry.com/patterns/library/<id> format. Returns null otherwise.
 */
export function extractRavelryIdFromSourceUrl(sourceUrl: string | null | undefined): number | null {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/ravelry\.com\/patterns\/library\/(\d+)/);
  return match ? Number(match[1]) : null;
}

// Maps Ravelry's 1–10 difficulty average onto Rowly's CYC-aligned 4 tiers.
export function difficultyFromAverage(avg: number | null | undefined): string {
  if (avg == null) return 'intermediate';
  if (avg <= 2.5) return 'basic';
  if (avg <= 5) return 'easy';
  if (avg <= 7.5) return 'intermediate';
  return 'complex';
}

const CATEGORY_MAP: Record<string, string> = {
  Pullover: 'sweater',
  Cardigan: 'sweater',
  Sweater: 'sweater',
  Scarf: 'scarf',
  Cowl: 'scarf',
  Hat: 'hat',
  Beanie: 'hat',
  Blanket: 'blanket',
  Afghan: 'blanket',
  Socks: 'socks',
  Shawl: 'shawl',
  Wrap: 'shawl',
  Toy: 'toy',
  Softies: 'toy',
};

function categoryFromRavelry(categories: string[] | undefined | null): string {
  if (!categories) return 'other';
  for (const cat of categories) {
    const mapped = CATEGORY_MAP[cat];
    if (mapped) return mapped;
  }
  return 'other';
}

function flattenList(val: any): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    if (val.length === 0) return undefined;
    const parts = val
      .map((x: any) => (typeof x === 'string' ? x : x?.name || null))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : undefined;
  }
  return undefined;
}

function flattenYarnRequirements(val: any): string | undefined {
  if (!val || !Array.isArray(val) || val.length === 0) return undefined;
  const lines = val
    .map((y: any) => {
      if (typeof y === 'string') return y;
      const parts = [y.yarnName, y.yarnCompany, y.quantity].filter(Boolean);
      return parts.join(' — ');
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : undefined;
}

/**
 * Convert a Ravelry pattern (compact or detailed) to the shape POST /api/patterns
 * accepts. If `detail` is provided, non-null fields from the detail response override
 * the compact fields (same merge strategy as RavelryPatternSearch.handleImport).
 */
export function normalizeRavelryPatternForImport(
  pattern: RavelryPattern,
  detail?: Partial<RavelryPattern> | null
): RavelryPatternImportData {
  const merged: any = { ...pattern };
  if (detail) {
    for (const key of Object.keys(detail) as (keyof RavelryPattern)[]) {
      const val = (detail as any)[key];
      if (val !== null && val !== undefined && val !== '') {
        merged[key] = val;
      }
    }
  }

  return {
    name: merged.name || '',
    designer: merged.designer || '',
    difficulty: difficultyFromAverage(merged.difficultyAverage),
    category: categoryFromRavelry(merged.categories),
    description: merged.description || '',
    photoUrl: merged.photoUrl || merged.photoSquareUrl || undefined,
    needleSizes: flattenList(merged.needleSizes),
    sizesAvailable: flattenList(merged.sizesAvailable),
    yarnRequirements: flattenYarnRequirements(merged.yarnSuggestions),
    estimatedYardage: merged.yardageMax || undefined,
    gauge: typeof merged.gauge === 'string' ? merged.gauge : undefined,
    sourceUrl: pattern.id ? ravelryPatternSourceUrl(pattern.id) : undefined,
  };
}

/**
 * Normalize a Ravelry pattern and create a Rowly pattern via POST /api/patterns.
 *
 * When `fetchDetail` is true (default), first calls GET /api/ravelry/patterns/:id to
 * get a richer object including description/gauge/notes_html. When false (used by the
 * bulk sync path to avoid rate limits), imports the compact data only.
 */
export async function importRavelryPatternToRowly(
  pattern: RavelryPattern,
  opts?: { fetchDetail?: boolean }
): Promise<any> {
  const fetchDetail = opts?.fetchDetail ?? true;

  let detail: Partial<RavelryPattern> | null = null;
  if (fetchDetail) {
    try {
      const response = await axios.get(`/api/ravelry/patterns/${pattern.id}`);
      if (response.data?.success) {
        detail = response.data.data.pattern as Partial<RavelryPattern>;
      }
    } catch {
      // Falls back to compact import — the pattern will still be created.
    }
  }

  const payload = normalizeRavelryPatternForImport(pattern, detail);
  const createResponse = await axios.post('/api/patterns', payload);
  return createResponse.data?.data?.pattern ?? null;
}
