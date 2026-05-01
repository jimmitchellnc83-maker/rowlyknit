import { intOrNull, numOrNull } from '../numericInput';

describe('intOrNull', () => {
  it('returns null for empty string', () => {
    expect(intOrNull('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(intOrNull('   ')).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(intOrNull(null)).toBeNull();
    expect(intOrNull(undefined)).toBeNull();
  });

  it('returns null for non-numeric strings (does not throw)', () => {
    expect(intOrNull('abc')).toBeNull();
  });

  it('parses integer strings', () => {
    expect(intOrNull('42')).toBe(42);
    expect(intOrNull('  100  ')).toBe(100);
  });

  it('truncates float strings to integers', () => {
    expect(intOrNull('3.7')).toBe(3);
    expect(intOrNull('-1.9')).toBe(-1);
  });

  it('passes through finite JS numbers (truncated)', () => {
    expect(intOrNull(7)).toBe(7);
    expect(intOrNull(7.9)).toBe(7);
  });

  it('returns null for NaN, Infinity, -Infinity', () => {
    expect(intOrNull(NaN)).toBeNull();
    expect(intOrNull(Infinity)).toBeNull();
    expect(intOrNull(-Infinity)).toBeNull();
  });
});

describe('numOrNull', () => {
  it('returns null for empty string and whitespace', () => {
    expect(numOrNull('')).toBeNull();
    expect(numOrNull('   ')).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(numOrNull(null)).toBeNull();
    expect(numOrNull(undefined)).toBeNull();
  });

  it('preserves decimal precision', () => {
    expect(numOrNull('1.99')).toBe(1.99);
    expect(numOrNull('  -0.5  ')).toBe(-0.5);
  });

  it('passes through finite JS numbers', () => {
    expect(numOrNull(3.14)).toBe(3.14);
  });

  it('returns null for NaN', () => {
    expect(numOrNull('not-a-number')).toBeNull();
    expect(numOrNull(NaN)).toBeNull();
  });
});
