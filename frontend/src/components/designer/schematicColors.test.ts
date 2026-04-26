import { describe, it, expect } from 'vitest';
import { paletteFromMainColor, luminance } from './schematicColors';

const FALLBACK = { fill: '#F5F3FF', stroke: '#7C3AED', accent: '#DDD6FE' };

describe('paletteFromMainColor', () => {
  it('returns fallback when no main color is set', () => {
    const p = paletteFromMainColor(null, FALLBACK);
    expect(p.fill).toBe('#F5F3FF');
    expect(p.stroke).toBe('#7C3AED');
    expect(p.accent).toBe('#DDD6FE');
  });

  it('returns fallback when main color is empty/invalid', () => {
    expect(paletteFromMainColor('', FALLBACK).fill).toBe('#F5F3FF');
    expect(paletteFromMainColor('not-a-color', FALLBACK).fill).toBe('#F5F3FF');
    expect(paletteFromMainColor(undefined, FALLBACK).fill).toBe('#F5F3FF');
  });

  it('uses main color as fill when supplied', () => {
    const p = paletteFromMainColor('#DC2626', FALLBACK);
    expect(p.fill).toBe('#DC2626');
  });

  it('derives a darker stroke from the main color', () => {
    const p = paletteFromMainColor('#DC2626', FALLBACK);
    // stroke is 35% mixed toward black, so each channel should be lower
    expect(luminance(p.stroke)).toBeLessThan(luminance('#DC2626'));
  });

  it('picks black text on light fill, white text on dark fill', () => {
    expect(paletteFromMainColor('#FFFFFF', FALLBACK).onFill).toBe('#111');
    expect(paletteFromMainColor('#000000', FALLBACK).onFill).toBe('#FFF');
  });
});
