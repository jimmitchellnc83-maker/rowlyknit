import { describe, it, expect } from 'vitest';
import { parseYarnLabel } from './labelOcrParser';

describe('parseYarnLabel', () => {
  it('returns all-null for empty input', () => {
    const r = parseYarnLabel('');
    expect(r.dyeLot).toBeNull();
    expect(r.colorCode).toBeNull();
    expect(r.colorName).toBeNull();
    expect(r.weight).toBeNull();
  });

  it('extracts "Dye Lot: 1234AB"', () => {
    const r = parseYarnLabel('Cascade 220\nDye Lot: 1234AB\n100% wool');
    expect(r.dyeLot).toBe('1234AB');
  });

  it('extracts "Lot # A123-456" with the hyphen', () => {
    const r = parseYarnLabel('Lot # A123-456');
    expect(r.dyeLot).toBe('A123-456');
  });

  it('extracts "Batch: 998877"', () => {
    const r = parseYarnLabel('BATCH: 998877');
    expect(r.dyeLot).toBe('998877');
  });

  it('ignores lone short codes that could be noise', () => {
    // "Lot: AB" is too short (2 chars); require at least 3 alphanumerics.
    const r = parseYarnLabel('Lot: AB');
    expect(r.dyeLot).toBeNull();
  });

  it('extracts "Color: 2450"', () => {
    const r = parseYarnLabel('Color: 2450');
    expect(r.colorCode).toBe('2450');
  });

  it('extracts "Colour No. B54"', () => {
    const r = parseYarnLabel('Colour No. B54');
    expect(r.colorCode).toBe('B54');
  });

  it('extracts a standalone "#1234" near the color line', () => {
    const r = parseYarnLabel('Shade #1234');
    expect(r.colorCode).toBe('1234');
  });

  it('extracts color name "Heather Grey"', () => {
    const r = parseYarnLabel('Color: Heather Grey\nLot 1234');
    expect(r.colorName).toBe('Heather Grey');
  });

  it('does not mistake "Color code" for a color name', () => {
    const r = parseYarnLabel('Color code: 2450');
    expect(r.colorName).toBeNull();
    expect(r.colorCode).toBe('2450');
  });

  it('detects "worsted" weight', () => {
    const r = parseYarnLabel('100% wool — worsted weight — 200 yards');
    expect(r.weight).toBe('Medium');
  });

  it('detects "DK" weight', () => {
    const r = parseYarnLabel('Merino DK, 240m per skein');
    expect(r.weight).toBe('Light');
  });

  it('prefers "super fine" over "fine"', () => {
    const r = parseYarnLabel('Super fine sock yarn');
    expect(r.weight).toBe('Super Fine');
  });

  it('returns null weight when no alias matches', () => {
    const r = parseYarnLabel('Some random text');
    expect(r.weight).toBeNull();
  });

  it('preserves the raw text trimmed', () => {
    const r = parseYarnLabel('   hello   ');
    expect(r.rawText).toBe('hello');
  });

  it('parses a realistic multi-line yarn label', () => {
    const r = parseYarnLabel(`
      CASCADE 220
      100% Peruvian Highland Wool
      Color: Heather Grey
      Color code: 8401
      Dye lot: A9-7766
      220 yds / 200 m
      worsted weight
    `);
    expect(r.dyeLot).toBe('A9-7766');
    expect(r.colorCode).toBe('8401');
    expect(r.colorName).toBe('Heather Grey');
    expect(r.weight).toBe('Medium');
  });
});
