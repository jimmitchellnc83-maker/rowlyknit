/**
 * Tests for the technique rules engine — PR 2 of the Designer rebuild.
 *
 * Coverage strategy: matrix tests over (craft × technique) for the four
 * facets, plus targeted tests for the convenience helpers consumers
 * actually call (`isRightSideRow`, `buildRowPrefix`,
 * `shouldReverseCellOrder`, `resolveDialectAbbreviation`,
 * `getRelevantSymbolCategories`).
 */

import { describe, it, expect } from 'vitest';
import {
  buildRowPrefix,
  getReadingDirection,
  getRelevantSymbolCategories,
  getRepeatSemantics,
  getTechniqueRules,
  getTerminology,
  getValidationRules,
  isRightSideRow,
  resolveDialectAbbreviation,
  shouldReverseCellOrder,
} from '../techniqueRules';
import type { Craft, Technique } from '../../types/pattern';

const ALL_CRAFTS: Craft[] = ['knit', 'crochet'];
const ALL_TECHNIQUES: Technique[] = [
  'standard',
  'lace',
  'cables',
  'colorwork',
  'tapestry',
  'filet',
  'tunisian',
];

// ---------------------------------------------------------------------------
// Matrix coverage — every craft × technique pair returns a complete
// rule set with no missing facets.
// ---------------------------------------------------------------------------

describe('getTechniqueRules — matrix coverage', () => {
  for (const craft of ALL_CRAFTS) {
    for (const technique of ALL_TECHNIQUES) {
      it(`returns a complete rule set for craft=${craft} technique=${technique}`, () => {
        const rules = getTechniqueRules(craft, technique);
        expect(rules.craft).toBe(craft);
        expect(rules.technique).toBe(technique);
        expect(rules.readingDirection).toBeDefined();
        expect(rules.repeatSemantics).toBeDefined();
        expect(rules.terminology).toBeDefined();
        expect(rules.validation).toBeDefined();
        expect(rules.validation.relevantSymbolCategories.size).toBeGreaterThan(0);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Reading direction — knit
// ---------------------------------------------------------------------------

describe('getReadingDirection — knit', () => {
  it('alternates RS/WS by default', () => {
    const r = getReadingDirection('knit', 'standard');
    expect(r.alternatesRsWs).toBe(true);
    expect(r.cellTraversal).toBe('right-to-left-on-rs');
    expect(r.roundsAreAllRs).toBe(true);
  });

  it('uses "Row" for flat work and "Round" in the round', () => {
    const r = getReadingDirection('knit', 'standard');
    expect(r.rowLabel.flat).toBe('Row');
    expect(r.rowLabel.inRound).toBe('Round');
  });

  it('cables technique inherits standard reading rules', () => {
    const r = getReadingDirection('knit', 'cables');
    expect(r.cellTraversal).toBe('right-to-left-on-rs');
  });
});

// ---------------------------------------------------------------------------
// Reading direction — crochet (including Tunisian)
// ---------------------------------------------------------------------------

describe('getReadingDirection — crochet', () => {
  it('reads every row right-to-left for standard crochet', () => {
    const r = getReadingDirection('crochet', 'standard');
    expect(r.cellTraversal).toBe('right-to-left-always');
  });

  it('switches to forward-and-return for Tunisian', () => {
    const r = getReadingDirection('crochet', 'tunisian');
    expect(r.cellTraversal).toBe('forward-and-return');
  });

  it('keeps the round-is-RS shortcut for crochet too', () => {
    const r = getReadingDirection('crochet', 'standard');
    expect(r.roundsAreAllRs).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Repeat semantics
// ---------------------------------------------------------------------------

describe('getRepeatSemantics', () => {
  it('knit supports between-marker repeats; crochet does not', () => {
    expect(getRepeatSemantics('knit', 'standard').supportsBetweenMarkers).toBe(true);
    expect(getRepeatSemantics('crochet', 'standard').supportsBetweenMarkers).toBe(false);
  });

  it('horizontal + vertical repeats are universal', () => {
    for (const craft of ALL_CRAFTS) {
      for (const technique of ALL_TECHNIQUES) {
        const r = getRepeatSemantics(craft, technique);
        expect(r.supportsHorizontalRepeats).toBe(true);
        expect(r.supportsVerticalRepeats).toBe(true);
      }
    }
  });

  it('motifs are supported across the matrix today', () => {
    for (const craft of ALL_CRAFTS) {
      for (const technique of ALL_TECHNIQUES) {
        expect(getRepeatSemantics(craft, technique).supportsMotifs).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Terminology
// ---------------------------------------------------------------------------

describe('getTerminology', () => {
  it('reports no dialect variants for any knit technique', () => {
    for (const technique of ALL_TECHNIQUES) {
      const t = getTerminology('knit', technique);
      expect(t.hasDialectVariants).toBe(false);
      expect(t.symbolDialect).toEqual({});
    }
  });

  it('reports US/UK dialect variants for crochet techniques', () => {
    for (const technique of ALL_TECHNIQUES) {
      const t = getTerminology('crochet', technique);
      expect(t.hasDialectVariants).toBe(true);
      expect(t.defaultDialect).toBe('us');
      // Always carries the canonical US/UK shifts for the seeded crochet
      // basics; future seeds extend the map.
      expect(t.symbolDialect.sc).toEqual({ us: 'sc', uk: 'dc' });
      expect(t.symbolDialect.dc).toEqual({ us: 'dc', uk: 'tr' });
    }
  });
});

describe('resolveDialectAbbreviation', () => {
  it('returns the symbol unchanged for knit (no dialect variants)', () => {
    expect(resolveDialectAbbreviation('k', 'knit', 'standard')).toBe('k');
    expect(resolveDialectAbbreviation('c4f', 'knit', 'cables')).toBe('c4f');
  });

  it('returns the US abbreviation by default for crochet', () => {
    expect(resolveDialectAbbreviation('sc', 'crochet', 'standard')).toBe('sc');
    expect(resolveDialectAbbreviation('dc', 'crochet', 'standard')).toBe('dc');
  });

  it('returns the UK abbreviation when dialect=uk', () => {
    expect(resolveDialectAbbreviation('sc', 'crochet', 'standard', 'uk')).toBe('dc');
    expect(resolveDialectAbbreviation('dc', 'crochet', 'standard', 'uk')).toBe('tr');
    expect(resolveDialectAbbreviation('hdc', 'crochet', 'standard', 'uk')).toBe('htr');
  });

  it('returns the symbol unchanged for unknown crochet symbols', () => {
    expect(resolveDialectAbbreviation('mystery', 'crochet', 'standard', 'uk')).toBe('mystery');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('getValidationRules', () => {
  it('flags knit cables as RS-only', () => {
    const v = getValidationRules('knit', 'cables');
    expect(v.rsOnlySymbols.has('c4f')).toBe(true);
    expect(v.rsOnlySymbols.has('c6b')).toBe(true);
    expect(v.rsOnlySymbols.has('rt')).toBe(true);
  });

  it('flags crochet front/back-post stitches as RS-only under the cables technique', () => {
    const v = getValidationRules('crochet', 'cables');
    expect(v.rsOnlySymbols.has('fpdc')).toBe(true);
    expect(v.rsOnlySymbols.has('bpsc')).toBe(true);
  });

  it('exposes a non-empty relevant-categories set for every combination', () => {
    for (const craft of ALL_CRAFTS) {
      for (const technique of ALL_TECHNIQUES) {
        const v = getValidationRules(craft, technique);
        expect(v.relevantSymbolCategories.size).toBeGreaterThan(0);
        // 'basic' is always part of the relevant set — every technique
        // builds on top of basic stitches.
        expect(v.relevantSymbolCategories.has('basic')).toBe(true);
      }
    }
  });

  it('keeps the cables category limited to knit-cables only', () => {
    expect(getValidationRules('knit', 'cables').relevantSymbolCategories.has('cable')).toBe(true);
    expect(getValidationRules('knit', 'standard').relevantSymbolCategories.has('cable')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Convenience helpers consumers actually call
// ---------------------------------------------------------------------------

describe('isRightSideRow', () => {
  it('alternates RS/WS for flat knit, starting with row 1 = RS', () => {
    expect(isRightSideRow(1, false, 'knit', 'standard')).toBe(true);
    expect(isRightSideRow(2, false, 'knit', 'standard')).toBe(false);
    expect(isRightSideRow(3, false, 'knit', 'standard')).toBe(true);
  });

  it('returns true for every row when worked in the round', () => {
    expect(isRightSideRow(2, true, 'knit', 'standard')).toBe(true);
    expect(isRightSideRow(2, true, 'crochet', 'standard')).toBe(true);
  });

  it('alternates RS/WS for flat crochet too', () => {
    expect(isRightSideRow(1, false, 'crochet', 'standard')).toBe(true);
    expect(isRightSideRow(2, false, 'crochet', 'standard')).toBe(false);
  });
});

describe('buildRowPrefix', () => {
  it('produces "Row N (RS|WS):" for flat knit', () => {
    expect(buildRowPrefix(1, false, 'knit', 'standard')).toBe('Row 1 (RS):');
    expect(buildRowPrefix(2, false, 'knit', 'standard')).toBe('Row 2 (WS):');
  });

  it('produces "Round N:" when worked in the round', () => {
    expect(buildRowPrefix(5, true, 'knit', 'standard')).toBe('Round 5:');
    expect(buildRowPrefix(5, true, 'crochet', 'standard')).toBe('Round 5:');
  });

  it('produces "Row N (forward|return):" for Tunisian when rowKind is provided', () => {
    expect(buildRowPrefix(3, false, 'crochet', 'tunisian', 'forward')).toBe('Row 3 (forward):');
    expect(buildRowPrefix(3, false, 'crochet', 'tunisian', 'return')).toBe('Row 3 (return):');
  });
});

describe('shouldReverseCellOrder', () => {
  it('reverses on RS rows for flat knit', () => {
    expect(shouldReverseCellOrder(true, false, 'knit', 'standard')).toBe(true);
    expect(shouldReverseCellOrder(false, false, 'knit', 'standard')).toBe(false);
  });

  it('always reverses for flat crochet', () => {
    expect(shouldReverseCellOrder(true, false, 'crochet', 'standard')).toBe(true);
    expect(shouldReverseCellOrder(false, false, 'crochet', 'standard')).toBe(true);
  });

  it('always reverses when worked in the round', () => {
    expect(shouldReverseCellOrder(false, true, 'knit', 'standard')).toBe(true);
    expect(shouldReverseCellOrder(false, true, 'crochet', 'standard')).toBe(true);
  });

  it('reverses on RS rows for Tunisian forward-and-return', () => {
    expect(shouldReverseCellOrder(true, false, 'crochet', 'tunisian')).toBe(true);
    expect(shouldReverseCellOrder(false, false, 'crochet', 'tunisian')).toBe(false);
  });
});

describe('getRelevantSymbolCategories', () => {
  it('includes "lace" for knit lace technique', () => {
    expect(getRelevantSymbolCategories('knit', 'lace').has('lace')).toBe(true);
  });

  it('includes "cable" + "twist" for knit cables technique', () => {
    const cats = getRelevantSymbolCategories('knit', 'cables');
    expect(cats.has('cable')).toBe(true);
    expect(cats.has('twist')).toBe(true);
  });

  it('includes "colorwork" for any colorwork technique', () => {
    expect(getRelevantSymbolCategories('knit', 'colorwork').has('colorwork')).toBe(true);
    expect(getRelevantSymbolCategories('crochet', 'colorwork').has('colorwork')).toBe(true);
    expect(getRelevantSymbolCategories('crochet', 'tapestry').has('colorwork')).toBe(true);
  });

  it('keeps filet narrowed to basic stitches only', () => {
    const cats = getRelevantSymbolCategories('crochet', 'filet');
    expect(cats.has('basic')).toBe(true);
    expect(cats.size).toBe(1);
  });
});
