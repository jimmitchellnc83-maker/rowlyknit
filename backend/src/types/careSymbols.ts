/**
 * Yarn care symbols — server-side mirror of
 * `frontend/src/utils/careSymbols.ts`. The wire format is JSONB on
 * `yarn.care_symbols`. We sanitize on write (whitelist the canonical
 * preset combos) so the column doesn't accumulate junk.
 */

export type CareCategory = 'wash' | 'bleach' | 'dry' | 'iron' | 'dryClean';

export interface CareSymbol {
  category: CareCategory;
  prohibited: boolean;
  modifier: string | null;
  label: string;
}

const VALID_CATEGORIES = new Set<CareCategory>(['wash', 'bleach', 'dry', 'iron', 'dryClean']);

interface PresetKey {
  category: CareCategory;
  prohibited: boolean;
  modifier: string | null;
}

const VALID_PRESETS: PresetKey[] = [
  { category: 'wash', prohibited: false, modifier: 'hand' },
  { category: 'wash', prohibited: false, modifier: 'machine-cold' },
  { category: 'wash', prohibited: false, modifier: 'machine-30' },
  { category: 'wash', prohibited: false, modifier: 'machine-40' },
  { category: 'wash', prohibited: false, modifier: 'machine-60' },
  { category: 'wash', prohibited: false, modifier: 'gentle' },
  { category: 'wash', prohibited: true, modifier: null },
  { category: 'bleach', prohibited: false, modifier: 'any' },
  { category: 'bleach', prohibited: false, modifier: 'oxygen-only' },
  { category: 'bleach', prohibited: true, modifier: null },
  { category: 'dry', prohibited: false, modifier: 'tumble-low' },
  { category: 'dry', prohibited: false, modifier: 'tumble-medium' },
  { category: 'dry', prohibited: false, modifier: 'tumble-high' },
  { category: 'dry', prohibited: false, modifier: 'line' },
  { category: 'dry', prohibited: false, modifier: 'flat' },
  { category: 'dry', prohibited: false, modifier: 'shade' },
  { category: 'dry', prohibited: true, modifier: 'tumble' },
  { category: 'iron', prohibited: false, modifier: 'low' },
  { category: 'iron', prohibited: false, modifier: 'medium' },
  { category: 'iron', prohibited: false, modifier: 'high' },
  { category: 'iron', prohibited: true, modifier: null },
  { category: 'dryClean', prohibited: false, modifier: 'any' },
  { category: 'dryClean', prohibited: false, modifier: 'P' },
  { category: 'dryClean', prohibited: false, modifier: 'F' },
  { category: 'dryClean', prohibited: false, modifier: 'W' },
  { category: 'dryClean', prohibited: true, modifier: null },
];

/**
 * Filter an arbitrary JSONB value to known CYC care presets. Drops
 * unknown categories, non-boolean prohibited flags, missing labels,
 * and combinations that don't match a published preset.
 */
export function sanitizeCareSymbols(raw: unknown): CareSymbol[] {
  if (!Array.isArray(raw)) return [];
  const out: CareSymbol[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (!VALID_CATEGORIES.has(e.category as CareCategory)) continue;
    if (typeof e.prohibited !== 'boolean') continue;
    const label = typeof e.label === 'string' ? e.label : null;
    if (!label) continue;
    const modifier = typeof e.modifier === 'string' ? e.modifier : null;
    const known = VALID_PRESETS.some(
      (p) =>
        p.category === e.category &&
        p.prohibited === e.prohibited &&
        p.modifier === modifier,
    );
    if (!known) continue;
    out.push({
      category: e.category as CareCategory,
      prohibited: e.prohibited,
      modifier,
      label,
    });
  }
  return out;
}
