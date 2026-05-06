/**
 * Pin the frontend pricing constants and prove they match the backend.
 * Drift on any of these → drift in the dashboard math, the page copy,
 * or the LS variant — all of which are bad.
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { PRICING_USD } from '../pricing';

describe('frontend pricing', () => {
  it('annual is $80, monthly is $12', () => {
    expect(PRICING_USD.annual).toBe(80);
    expect(PRICING_USD.monthly).toBe(12);
  });

  it('matches the backend `config/pricing.ts` constants', () => {
    const bePath = path.resolve(__dirname, '../../../../backend/src/config/pricing.ts');
    const be = fs.readFileSync(bePath, 'utf8');
    expect(be).toMatch(/monthly:\s*12/);
    expect(be).toMatch(/annual:\s*80/);
  });
});
