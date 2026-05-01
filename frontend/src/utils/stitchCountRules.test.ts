import { describe, it, expect } from 'vitest';
import {
  TURNING_CHAIN_RULES,
  getTurningChainRule,
  slipKnotCountsAsStitch,
  adjustedRowCount,
  workedFromTotal,
  getCraftCountingRules,
} from './stitchCountRules';

describe('slipKnotCountsAsStitch', () => {
  it('counts the slip-knot as a stitch in knit', () => {
    expect(slipKnotCountsAsStitch('knit')).toBe(true);
  });

  it('does NOT count the slip-knot as a stitch in crochet', () => {
    expect(slipKnotCountsAsStitch('crochet')).toBe(false);
  });
});

describe('TURNING_CHAIN_RULES', () => {
  it('encodes the standard crochet turning-chain conventions', () => {
    expect(TURNING_CHAIN_RULES.sc).toMatchObject({
      chainCount: 1,
      countsAsStitch: false,
    });
    expect(TURNING_CHAIN_RULES.hdc).toMatchObject({
      chainCount: 2,
      countsAsStitch: false,
    });
    expect(TURNING_CHAIN_RULES.dc).toMatchObject({
      chainCount: 3,
      countsAsStitch: true,
    });
    expect(TURNING_CHAIN_RULES.tr).toMatchObject({
      chainCount: 4,
      countsAsStitch: true,
    });
    expect(TURNING_CHAIN_RULES.dtr).toMatchObject({
      chainCount: 5,
      countsAsStitch: true,
    });
  });

  it('exposes a human-readable note for every rule', () => {
    for (const rule of Object.values(TURNING_CHAIN_RULES)) {
      expect(rule.note.length).toBeGreaterThan(20);
    }
  });
});

describe('getTurningChainRule', () => {
  it('returns the rule for a known base stitch', () => {
    expect(getTurningChainRule('dc')!.countsAsStitch).toBe(true);
    expect(getTurningChainRule('sc')!.countsAsStitch).toBe(false);
  });

  it('handles uppercase + whitespace', () => {
    expect(getTurningChainRule('  DC  ')!.chainCount).toBe(3);
  });

  it('returns NULL for unrecognized stitches', () => {
    expect(getTurningChainRule('bobble')).toBeNull();
    expect(getTurningChainRule('FPdc')).toBeNull();
    expect(getTurningChainRule('')).toBeNull();
  });

  it('returns NULL for non-string input', () => {
    expect(getTurningChainRule(null as any)).toBeNull();
    expect(getTurningChainRule(42 as any)).toBeNull();
  });
});

describe('adjustedRowCount', () => {
  it('adds 1 when the turning chain counts as a stitch', () => {
    expect(adjustedRowCount(19, TURNING_CHAIN_RULES.dc)).toBe(20);
    expect(adjustedRowCount(0, TURNING_CHAIN_RULES.dc)).toBe(1);
  });

  it('passes through when the turning chain does not count', () => {
    expect(adjustedRowCount(20, TURNING_CHAIN_RULES.sc)).toBe(20);
  });

  it('clamps negative input to zero', () => {
    expect(adjustedRowCount(-5, TURNING_CHAIN_RULES.dc)).toBe(0);
  });
});

describe('workedFromTotal', () => {
  it('subtracts 1 when the turning chain counts as a stitch', () => {
    expect(workedFromTotal(20, TURNING_CHAIN_RULES.dc)).toBe(19);
    expect(workedFromTotal(20, TURNING_CHAIN_RULES.tr)).toBe(19);
  });

  it('passes through when the turning chain does not count', () => {
    expect(workedFromTotal(20, TURNING_CHAIN_RULES.sc)).toBe(20);
    expect(workedFromTotal(20, TURNING_CHAIN_RULES.hdc)).toBe(20);
  });

  it('clamps to zero when the total is one but the chain counts (no stitches actually worked)', () => {
    expect(workedFromTotal(1, TURNING_CHAIN_RULES.dc)).toBe(0);
  });

  it('round-trips with adjustedRowCount', () => {
    for (const rule of Object.values(TURNING_CHAIN_RULES)) {
      for (const total of [10, 25, 100]) {
        expect(adjustedRowCount(workedFromTotal(total, rule), rule)).toBe(total);
      }
    }
  });
});

describe('getCraftCountingRules', () => {
  it('returns knit rules with no turning chains', () => {
    const r = getCraftCountingRules('knit');
    expect(r.craft).toBe('knit');
    expect(r.slipKnotCountsAsStitch).toBe(true);
    expect(r.turningChainRules).toEqual([]);
  });

  it('returns crochet rules with all five turning chains', () => {
    const r = getCraftCountingRules('crochet');
    expect(r.craft).toBe('crochet');
    expect(r.slipKnotCountsAsStitch).toBe(false);
    expect(r.turningChainRules.length).toBe(5);
    const baseStitches = r.turningChainRules.map((tc) => tc.baseStitch).sort();
    expect(baseStitches).toEqual(['dc', 'dtr', 'hdc', 'sc', 'tr']);
  });
});
