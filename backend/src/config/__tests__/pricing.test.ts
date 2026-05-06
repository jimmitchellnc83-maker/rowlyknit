/**
 * Pin the canonical pricing constants.
 *
 * If the operator changes the LS variant prices, both
 * `backend/src/config/pricing.ts` AND `frontend/src/lib/pricing.ts` must
 * change together. This test only proves the backend shape — the
 * frontend has its own `pricing.test.ts` that pins the same numbers
 * and an equality test below cross-references them.
 */

import { PRICING_USD, ANNUAL_AS_MONTHLY_USD } from '../pricing';
import * as fs from 'fs';
import * as path from 'path';

describe('PRICING_USD', () => {
  it('annual is 80 (matches UpgradePage and LS variant)', () => {
    expect(PRICING_USD.annual).toBe(80);
  });

  it('monthly is 12 (matches UpgradePage and LS variant)', () => {
    expect(PRICING_USD.monthly).toBe(12);
  });

  it('ANNUAL_AS_MONTHLY_USD is annual / 12 (used for MRR math)', () => {
    expect(ANNUAL_AS_MONTHLY_USD).toBeCloseTo(80 / 12, 6);
  });

  it('frontend mirror exposes the same numbers', () => {
    // Read the FE file from disk (no module resolution — it's a Vite
    // module that uses `import.meta.env`). Grep the literal numbers.
    const fePath = path.resolve(__dirname, '../../../../frontend/src/lib/pricing.ts');
    const fe = fs.readFileSync(fePath, 'utf8');
    expect(fe).toMatch(/monthly:\s*12/);
    expect(fe).toMatch(/annual:\s*80/);
  });
});
