/**
 * Yarn care symbols — CYC's five shape categories.
 *
 * CYC's "Care Symbols" page groups the textile-care symbol families
 * into five shapes:
 *
 *   - **Wash** (washtub) — wash temperature + agitation level
 *   - **Bleach** (triangle) — chlorine / oxygen-only / none
 *   - **Dry** (square) — tumble / line / flat / shade
 *   - **Iron** (iron) — low / medium / high
 *   - **Dry-clean** (circle) — any / P / F / W
 *
 * Each category has a "do not X" variant rendered with a slash through
 * the base shape. Full per-symbol detail (over 30 ISO 3758 / ASTM
 * D5489 variants) is intentionally OUT OF SCOPE for this module — we
 * surface the categories knitters actually use day-to-day so a yarn
 * label scan or a manual entry can capture the load-bearing care
 * info, with a clear path to extend later.
 *
 * Source: Craft Yarn Council of America's www.YarnStandards.com
 * "Care Symbols" page; full set defers to ISO 3758 / ASTM D5489.
 */

export type CareCategory = 'wash' | 'bleach' | 'dry' | 'iron' | 'dryClean';

export interface CareSymbol {
  category: CareCategory;
  /** Whether this is the "do not X" (prohibited) variant. */
  prohibited: boolean;
  /** Per-category modifier. NULL = the bare category symbol with no
   *  qualifier (e.g. plain washtub = "wash"). */
  modifier: string | null;
  /** Plain-language label suitable for tooltip / accessible-name. */
  label: string;
}

const PRESETS: ReadonlyArray<CareSymbol> = [
  // Wash
  { category: 'wash', prohibited: false, modifier: 'hand', label: 'Hand wash' },
  { category: 'wash', prohibited: false, modifier: 'machine-cold', label: 'Machine wash cold' },
  { category: 'wash', prohibited: false, modifier: 'machine-30', label: 'Machine wash 30°C' },
  { category: 'wash', prohibited: false, modifier: 'machine-40', label: 'Machine wash 40°C' },
  { category: 'wash', prohibited: false, modifier: 'machine-60', label: 'Machine wash 60°C' },
  { category: 'wash', prohibited: false, modifier: 'gentle', label: 'Machine wash, gentle cycle' },
  { category: 'wash', prohibited: true, modifier: null, label: 'Do not wash' },

  // Bleach
  { category: 'bleach', prohibited: false, modifier: 'any', label: 'Any bleach when needed' },
  { category: 'bleach', prohibited: false, modifier: 'oxygen-only', label: 'Non-chlorine (oxygen) bleach only' },
  { category: 'bleach', prohibited: true, modifier: null, label: 'Do not bleach' },

  // Dry
  { category: 'dry', prohibited: false, modifier: 'tumble-low', label: 'Tumble dry low' },
  { category: 'dry', prohibited: false, modifier: 'tumble-medium', label: 'Tumble dry medium' },
  { category: 'dry', prohibited: false, modifier: 'tumble-high', label: 'Tumble dry high' },
  { category: 'dry', prohibited: false, modifier: 'line', label: 'Line dry' },
  { category: 'dry', prohibited: false, modifier: 'flat', label: 'Dry flat' },
  { category: 'dry', prohibited: false, modifier: 'shade', label: 'Dry in shade' },
  { category: 'dry', prohibited: true, modifier: 'tumble', label: 'Do not tumble dry' },

  // Iron
  { category: 'iron', prohibited: false, modifier: 'low', label: 'Iron low (110°C / 230°F)' },
  { category: 'iron', prohibited: false, modifier: 'medium', label: 'Iron medium (150°C / 300°F)' },
  { category: 'iron', prohibited: false, modifier: 'high', label: 'Iron high (200°C / 390°F)' },
  { category: 'iron', prohibited: true, modifier: null, label: 'Do not iron' },

  // Dry-clean
  { category: 'dryClean', prohibited: false, modifier: 'any', label: 'Dry-clean (any solvent)' },
  { category: 'dryClean', prohibited: false, modifier: 'P', label: 'Dry-clean (P — perchloroethylene)' },
  { category: 'dryClean', prohibited: false, modifier: 'F', label: 'Dry-clean (F — petroleum solvent)' },
  { category: 'dryClean', prohibited: false, modifier: 'W', label: 'Wet-clean (professional)' },
  { category: 'dryClean', prohibited: true, modifier: null, label: 'Do not dry-clean' },
];

/** Frozen list of canonical CYC care presets. Suitable for a picker
 *  UI that lets the user click their way through label entry. */
export const CARE_SYMBOL_PRESETS: ReadonlyArray<CareSymbol> = Object.freeze(PRESETS);

/** Glyph mapping per category, for terse renders that don't pull in an
 *  icon library. Knitters recognize these textually too — we use the
 *  Unicode shapes that match the ISO/CYC families (closest available
 *  in standard fonts). The "prohibited" prefix is the slash-through. */
const CATEGORY_GLYPH: Record<CareCategory, string> = {
  wash: '🜄',
  bleach: '△',
  dry: '□',
  iron: '⌷',
  dryClean: '○',
};

/**
 * Compose a glyph string for a care symbol. Prohibited variants get
 * the combining-slash overlay (U+0338) so any font renders them as
 * "shape with slash" without bespoke artwork.
 */
export function careGlyph(symbol: CareSymbol): string {
  const base = CATEGORY_GLYPH[symbol.category];
  return symbol.prohibited ? `${base}̸` : base;
}

interface SanitizeOpts {
  /** When true (default), drop unknown modifiers rather than letting
   *  them through. Tests use this to verify the validator semantics. */
  strict?: boolean;
}

const VALID_CATEGORIES = new Set<CareCategory>(['wash', 'bleach', 'dry', 'iron', 'dryClean']);

/**
 * Filter an arbitrary input array down to recognized `CareSymbol`
 * entries, dropping anything that doesn't match the schema. Used on
 * the wire / persistence boundary so the JSONB column doesn't
 * accumulate junk.
 */
export function sanitizeCareSymbols(
  raw: unknown,
  opts: SanitizeOpts = {},
): CareSymbol[] {
  if (!Array.isArray(raw)) return [];
  const strict = opts.strict ?? true;
  const out: CareSymbol[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (!VALID_CATEGORIES.has(e.category as CareCategory)) continue;
    if (typeof e.prohibited !== 'boolean') continue;
    const label = typeof e.label === 'string' ? e.label : null;
    if (!label) continue;
    const modifier = typeof e.modifier === 'string' ? e.modifier : null;
    if (strict) {
      const known = PRESETS.some(
        (p) =>
          p.category === e.category &&
          p.prohibited === e.prohibited &&
          p.modifier === modifier,
      );
      if (!known) continue;
    }
    out.push({
      category: e.category as CareCategory,
      prohibited: e.prohibited,
      modifier,
      label,
    });
  }
  return out;
}
