import { describe, it, expect } from 'vitest';
import {
  detectCrochetDialect,
  convertCrochetDialect,
  autoConvertCrochet,
} from './crochetDialect';

describe('detectCrochetDialect', () => {
  it('flags US when sc / hdc dominate', () => {
    const r = detectCrochetDialect(
      'Row 1: ch 20, sc in 2nd ch from hook and across (19 sc).\n' +
      'Row 2: hdc in each sc across.\n' +
      'Row 3: sc, sc, hdc, sc.',
    );
    expect(r.dialect).toBe('us');
    expect(r.usScore).toBeGreaterThan(0);
    expect(r.ukScore).toBe(0);
    expect(r.confidence).toBe(1);
  });

  it('flags UK when htr / tension appear', () => {
    const r = detectCrochetDialect(
      'Tension: 18 sts and 24 rows = 10 cm. ' +
      'Row 1: ch 20, htr in each ch.\n' +
      'Row 2: htr across.\n' +
      'Yarn: DK weight.',
    );
    expect(r.dialect).toBe('uk');
    expect(r.ukScore).toBeGreaterThan(0);
    expect(r.usScore).toBe(0);
    expect(r.confidence).toBe(1);
  });

  it('returns unknown when there are no strong signals', () => {
    const r = detectCrochetDialect(
      'Row 1: ch 20, work across in pattern. Repeat row 2 ten times.',
    );
    expect(r.dialect).toBe('unknown');
    expect(r.usScore).toBe(0);
    expect(r.ukScore).toBe(0);
    expect(r.confidence).toBe(0);
  });

  it('treats dc / tr as ambiguous and surfaces them in the report', () => {
    const r = detectCrochetDialect('Row 1: ch 12, dc in 4th ch from hook, tr at end.');
    expect(r.ambiguous.sort()).toEqual(['dc', 'tr']);
    // No strong signals → unknown.
    expect(r.dialect).toBe('unknown');
  });

  it('weights confidence by ratio when both sides have signals', () => {
    const r = detectCrochetDialect(
      'sc sc sc sc sc htr',
    );
    // 5 sc (US) vs 1 htr (UK) → 5/6 ≈ 0.833
    expect(r.dialect).toBe('us');
    expect(r.usScore).toBe(5);
    expect(r.ukScore).toBe(1);
    expect(r.confidence).toBeCloseTo(5 / 6, 5);
  });

  it('handles uppercase tokens', () => {
    expect(detectCrochetDialect('SC, HDC').dialect).toBe('us');
  });

  it('returns the empty result for empty / non-string input', () => {
    expect(detectCrochetDialect('').dialect).toBe('unknown');
    expect(detectCrochetDialect(null as any).dialect).toBe('unknown');
    expect(detectCrochetDialect(undefined as any).dialect).toBe('unknown');
  });

  it("ignores 'sc' inside another word like 'score'", () => {
    // The token regex matches alphanumerics greedy, so "score" is ONE
    // token. It is NOT in STRONG_US_TOKENS, so does not vote.
    const r = detectCrochetDialect('Final score: not a stitch pattern.');
    expect(r.usScore).toBe(0);
    expect(r.ukScore).toBe(0);
  });
});

describe('convertCrochetDialect', () => {
  it('converts a US row to UK in one shot', () => {
    const out = convertCrochetDialect(
      'Row 1: sc in next st, hdc in next, dc in next, tr in next.',
      'us',
      'uk',
    );
    expect(out).toBe(
      'Row 1: dc in next st, htr in next, tr in next, dtr in next.',
    );
  });

  it('converts UK back to US round-trips', () => {
    const ukText =
      'Row 1: dc in next st, htr in next, tr in next, dtr in next.';
    const us = convertCrochetDialect(ukText, 'uk', 'us');
    expect(us).toBe(
      'Row 1: sc in next st, hdc in next, dc in next, tr in next.',
    );
  });

  it('replaces gauge / tension', () => {
    expect(convertCrochetDialect('Gauge: 16 sts.', 'us', 'uk')).toBe(
      'Tension: 16 sts.',
    );
    expect(convertCrochetDialect('Tension: 16 sts.', 'uk', 'us')).toBe(
      'Gauge: 16 sts.',
    );
  });

  it('handles 2tog decreases without breaking the sc/dc/etc rename', () => {
    // sc2tog → dc2tog (both are decrease forms).
    const out = convertCrochetDialect(
      'Row 5: sc2tog, sc, sc, sc2tog. Then dc2tog.',
      'us',
      'uk',
    );
    expect(out).toBe(
      'Row 5: dc2tog, dc, dc, dc2tog. Then tr2tog.',
    );
  });

  it('handles post stitches', () => {
    const out = convertCrochetDialect(
      'Row 6: FPdc in each st, BPdc in each st.',
      'us',
      'uk',
    );
    expect(out).toBe(
      'Row 6: FPtr in each st, BPtr in each st.',
    );
  });

  it("does NOT chain-rename (the dc→tr→dtr trap)", () => {
    // Legitimate edge case: a US pattern with both `dc` and `tr`. The
    // naive "swap each pair sequentially" approach would convert dc→tr,
    // then re-convert tr→dtr, yielding dtr where the user wrote dc.
    // Our placeholder pass should produce tr for dc and dtr for tr.
    const out = convertCrochetDialect('dc and tr', 'us', 'uk');
    expect(out).toBe('tr and dtr');
  });

  it('returns the original text when source and target dialect match', () => {
    const text = 'Row 1: sc, hdc.';
    expect(convertCrochetDialect(text, 'us', 'us')).toBe(text);
  });

  it('returns empty string for non-string input', () => {
    expect(convertCrochetDialect(null as any, 'us', 'uk')).toBe('');
  });

  it("doesnt rewrite words that contain a stitch token (score, dco, etc)", () => {
    expect(convertCrochetDialect('Final score: 10.', 'us', 'uk')).toBe(
      'Final score: 10.',
    );
  });
});

describe('autoConvertCrochet', () => {
  it('returns the converted text when dialect mismatches and confidence is high', () => {
    const text =
      'Tension: 16 sts. Row 1: htr in next, htr in next.';
    const r = autoConvertCrochet(text, 'us');
    expect(r.detection.dialect).toBe('uk');
    expect(r.changed).toBe(true);
    expect(r.converted).toContain('Gauge:');
    expect(r.converted).toContain('hdc');
  });

  it('no-ops when the detected dialect already matches the target', () => {
    const r = autoConvertCrochet('sc sc sc sc', 'us');
    expect(r.detection.dialect).toBe('us');
    expect(r.changed).toBe(false);
    expect(r.converted).toBe('sc sc sc sc');
  });

  it('no-ops when detection is below the confidence threshold', () => {
    // 1 sc + 1 htr = ratio 0.5 → below 0.7 default threshold.
    const r = autoConvertCrochet('sc htr', 'us');
    expect(r.detection.confidence).toBeLessThan(0.7);
    expect(r.changed).toBe(false);
  });

  it('respects an overridden threshold', () => {
    // 2-sc + 1-htr = ratio 0.667. Default threshold 0.7 would skip;
    // lowering to 0.4 still no-ops because dialect already matches target.
    const r = autoConvertCrochet('sc sc htr', 'us', { threshold: 0.4 });
    expect(r.detection.dialect).toBe('us');
    expect(r.changed).toBe(false); // already US, target is US

    // Same input with target=uk DOES trigger conversion at threshold 0.4
    // even though confidence is only 0.667.
    const r2 = autoConvertCrochet('sc sc htr', 'uk', { threshold: 0.4 });
    expect(r2.changed).toBe(true);
  });

  it('no-ops when detection is unknown', () => {
    const r = autoConvertCrochet('Row 1: ch 20, work in pattern.', 'us');
    expect(r.detection.dialect).toBe('unknown');
    expect(r.changed).toBe(false);
  });
});
