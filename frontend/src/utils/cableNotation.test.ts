import { describe, it, expect } from 'vitest';
import { parseCable, cableInstruction, isCableNotation } from './cableNotation';

describe('parseCable — slash form', () => {
  it('parses a symmetric right cross "2/2 RC"', () => {
    expect(parseCable('2/2 RC')).toEqual({
      totalStitches: 4,
      frontCount: 2,
      backCount: 2,
      direction: 'right',
      variant: 'cross',
      raw: '2/2 RC',
      canonical: '2/2 RC',
    });
  });

  it('parses a symmetric left cross "3/3 LC"', () => {
    const r = parseCable('3/3 LC')!;
    expect(r.totalStitches).toBe(6);
    expect(r.direction).toBe('left');
    expect(r.variant).toBe('cross');
    expect(r.canonical).toBe('3/3 LC');
  });

  it('parses asymmetric "2/1 RC" preserving both sides', () => {
    const r = parseCable('2/1 RC')!;
    expect(r.totalStitches).toBe(3);
    expect(r.frontCount).toBe(2);
    expect(r.backCount).toBe(1);
    expect(r.canonical).toBe('2/1 RC');
  });

  it('parses purl variants RPC / LPC', () => {
    expect(parseCable('1/1 RPC')!.variant).toBe('purl-cross');
    expect(parseCable('2/2 LPC')!.variant).toBe('purl-cross');
  });

  it('parses small twists RT / LT', () => {
    const rt = parseCable('1/1 RT')!;
    expect(rt.variant).toBe('twist');
    expect(rt.direction).toBe('right');
  });

  it('tolerates extra whitespace and lowercase suffixes', () => {
    expect(parseCable('  2 / 2  rc  ')!.canonical).toBe('2/2 RC');
    expect(parseCable('1/1 lpc')!.canonical).toBe('1/1 LPC');
  });

  it('returns NULL for an unknown suffix', () => {
    expect(parseCable('2/2 ZZ')).toBeNull();
  });

  it('returns NULL for zero counts', () => {
    expect(parseCable('0/2 RC')).toBeNull();
    expect(parseCable('2/0 LC')).toBeNull();
  });
});

describe('parseCable — stitch-count form', () => {
  it('parses "4-st RC" and splits 2/2 in canonical form', () => {
    expect(parseCable('4-st RC')).toEqual({
      totalStitches: 4,
      frontCount: 2,
      backCount: 2,
      direction: 'right',
      variant: 'cross',
      raw: '4-st RC',
      canonical: '2/2 RC',
    });
  });

  it('parses "6-st LPC" with even split', () => {
    const r = parseCable('6-st LPC')!;
    expect(r.canonical).toBe('3/3 LPC');
  });

  it('handles "6 st RC" without dash', () => {
    expect(parseCable('6 st RC')!.canonical).toBe('3/3 RC');
  });

  it('returns NULL counts for an odd-total stitch-count cable (cant split symmetrically)', () => {
    const r = parseCable('5-st RC')!;
    expect(r.totalStitches).toBe(5);
    expect(r.frontCount).toBeNull();
    expect(r.backCount).toBeNull();
    expect(r.canonical).toBe('5-st RC');
  });

  it('rejects negative or zero total', () => {
    expect(parseCable('0-st RC')).toBeNull();
  });
});

describe('parseCable — equivalence between forms', () => {
  it('"2/2 LC" and "4-st LC" produce equivalent canonical output', () => {
    const slash = parseCable('2/2 LC')!;
    const stitchCount = parseCable('4-st LC')!;
    expect(slash.canonical).toBe(stitchCount.canonical);
    expect(slash.totalStitches).toBe(stitchCount.totalStitches);
    expect(slash.direction).toBe(stitchCount.direction);
  });

  it('"3/3 RC" and "6-st RC" agree on totals', () => {
    expect(parseCable('3/3 RC')!.totalStitches).toBe(parseCable('6-st RC')!.totalStitches);
  });
});

describe('parseCable — defensive', () => {
  it('returns NULL for empty / whitespace input', () => {
    expect(parseCable('')).toBeNull();
    expect(parseCable('   ')).toBeNull();
  });

  it('returns NULL for non-string input', () => {
    expect(parseCable(null as any)).toBeNull();
    expect(parseCable(undefined as any)).toBeNull();
    expect(parseCable(42 as any)).toBeNull();
  });

  it('returns NULL for noise that is neither slash nor stitch-count form', () => {
    expect(parseCable('k2tog')).toBeNull();
    expect(parseCable('cable')).toBeNull();
    expect(parseCable('2-2 RC')).toBeNull();
  });
});

describe('isCableNotation', () => {
  it('flags slash form', () => {
    expect(isCableNotation('2/2 RC')).toBe(true);
    expect(isCableNotation('1/1 LPC')).toBe(true);
  });

  it('flags stitch-count form', () => {
    expect(isCableNotation('4-st RC')).toBe(true);
    expect(isCableNotation('6 st LC')).toBe(true);
  });

  it('rejects non-cable strings', () => {
    expect(isCableNotation('k2tog')).toBe(false);
    expect(isCableNotation('')).toBe(false);
    expect(isCableNotation(null as any)).toBe(false);
  });
});

describe('cableInstruction', () => {
  it('builds a right-cross instruction (cn held to back)', () => {
    const inst = cableInstruction(parseCable('2/2 RC')!)!;
    expect(inst).toContain('Slip 2 sts to cn');
    expect(inst).toContain('hold to back');
    expect(inst).toContain('k2');
    expect(inst).toContain('k2 from cn');
  });

  it('builds a left-cross instruction (cn held to front)', () => {
    const inst = cableInstruction(parseCable('3/3 LC')!)!;
    expect(inst).toContain('Slip 3 sts to cn');
    expect(inst).toContain('hold to front');
    expect(inst).toContain('k3');
    expect(inst).toContain('k3 from cn');
  });

  it('uses purl on the held side for RPC', () => {
    const inst = cableInstruction(parseCable('1/1 RPC')!)!;
    expect(inst).toContain('p1 from cn');
  });

  it('uses the no-cn pattern for RT / LT', () => {
    const rt = cableInstruction(parseCable('1/1 RT')!)!;
    expect(rt).toContain('RT');
    expect(rt).not.toContain('cn');
  });

  it('returns NULL when the cable counts are unknown (odd stitch-count form)', () => {
    expect(cableInstruction(parseCable('5-st RC')!)).toBeNull();
  });
});
