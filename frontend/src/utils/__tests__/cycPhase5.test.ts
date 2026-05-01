import { describe, it, expect } from 'vitest';
import {
  CARE_SYMBOL_PRESETS,
  careGlyph,
  sanitizeCareSymbols,
  type CareSymbol,
} from '../careSymbols';
import {
  validateCrochetHookSize,
  verifyInvertedSteelNumbering,
} from '../crochetHookValidator';

describe('CARE_SYMBOL_PRESETS', () => {
  it('covers every category with at least one preset and a "do not" variant', () => {
    const categories = new Set(CARE_SYMBOL_PRESETS.map((p) => p.category));
    expect(categories).toEqual(new Set(['wash', 'bleach', 'dry', 'iron', 'dryClean']));
    for (const cat of categories) {
      const inCat = CARE_SYMBOL_PRESETS.filter((p) => p.category === cat);
      expect(inCat.some((p) => !p.prohibited)).toBe(true);
      expect(inCat.some((p) => p.prohibited)).toBe(true);
    }
  });

  it('every preset has a non-empty label', () => {
    for (const p of CARE_SYMBOL_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it('is frozen so callers can iterate without copying', () => {
    expect(Object.isFrozen(CARE_SYMBOL_PRESETS)).toBe(true);
  });
});

describe('careGlyph', () => {
  it('returns the bare glyph for non-prohibited symbols', () => {
    const wash = CARE_SYMBOL_PRESETS.find((p) => p.category === 'wash' && !p.prohibited)!;
    expect(careGlyph(wash)).not.toContain('̸');
  });

  it('appends the combining-slash overlay for prohibited symbols', () => {
    const noBleach = CARE_SYMBOL_PRESETS.find((p) => p.category === 'bleach' && p.prohibited)!;
    expect(careGlyph(noBleach)).toContain('̸');
  });
});

describe('sanitizeCareSymbols', () => {
  it('passes recognized presets through', () => {
    const input = [
      CARE_SYMBOL_PRESETS[0],
      CARE_SYMBOL_PRESETS[5],
    ];
    expect(sanitizeCareSymbols(input)).toEqual(input);
  });

  it('drops entries with unknown categories', () => {
    expect(
      sanitizeCareSymbols([{ category: 'bogus', prohibited: false, label: 'x' }]),
    ).toEqual([]);
  });

  it('drops entries with non-boolean prohibited', () => {
    expect(
      sanitizeCareSymbols([
        { category: 'wash', prohibited: 'yes', modifier: 'hand', label: 'Hand wash' },
      ]),
    ).toEqual([]);
  });

  it('drops entries with non-string label', () => {
    expect(
      sanitizeCareSymbols([
        { category: 'wash', prohibited: false, modifier: 'hand', label: 42 },
      ]),
    ).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(sanitizeCareSymbols(null)).toEqual([]);
    expect(sanitizeCareSymbols('xyz')).toEqual([]);
    expect(sanitizeCareSymbols({})).toEqual([]);
  });

  it('drops unknown (category, modifier, prohibited) combos in strict mode', () => {
    expect(
      sanitizeCareSymbols([
        { category: 'wash', prohibited: false, modifier: 'tropical', label: 'Wash tropical' },
      ]),
    ).toEqual([]);
  });

  it('keeps unknown combos when strict is false (advanced editor mode)', () => {
    const novel: CareSymbol = {
      category: 'wash',
      prohibited: false,
      modifier: 'tropical',
      label: 'Wash tropical',
    };
    expect(sanitizeCareSymbols([novel], { strict: false })).toEqual([novel]);
  });
});

describe('validateCrochetHookSize', () => {
  it('flags bare "7" as ambiguous (Steel 7 vs standard 7)', () => {
    const r = validateCrochetHookSize('7');
    expect(r.status).toBe('ambiguous');
    expect(r.candidates.length).toBe(2);
    const families = r.candidates.map((c) => c.family).sort();
    expect(families).toEqual(['standard', 'steel']);
    expect(r.guidance).toContain('inverted from standard');
  });

  it('resolves "Steel 7" to a unique 1.1mm hook', () => {
    const r = validateCrochetHookSize('Steel 7');
    expect(r.status).toBe('unique');
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({ mm: 1.1, family: 'steel' });
  });

  it('resolves "standard 7" to the 4.5mm hook', () => {
    const r = validateCrochetHookSize('standard 7');
    expect(r.status).toBe('unique');
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({ mm: 4.5, family: 'standard' });
  });

  it('resolves a letter-only input "H" to a unique hook', () => {
    const r = validateCrochetHookSize('H');
    expect(r.status).toBe('unique');
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({ mm: 5.0, family: 'standard' });
  });

  it('resolves "F/5" to a unique standard hook', () => {
    const r = validateCrochetHookSize('F/5');
    expect(r.status).toBe('unique');
    expect(r.candidates[0]).toMatchObject({ mm: 3.75, family: 'standard' });
  });

  it('returns unknown for nonsense input', () => {
    const r = validateCrochetHookSize('Z');
    expect(r.status).toBe('unknown');
    expect(r.guidance).toBeTruthy();
  });

  it('returns unknown for empty string', () => {
    expect(validateCrochetHookSize('').status).toBe('unknown');
    expect(validateCrochetHookSize('   ').status).toBe('unknown');
  });
});

describe('verifyInvertedSteelNumbering', () => {
  it('confirms the published steel-hook table preserves the inverted-numbering invariant', () => {
    const r = verifyInvertedSteelNumbering();
    expect(r.valid).toBe(true);
    expect(r.violations).toEqual([]);
  });
});
