/**
 * Regression — PR #389 review fix.
 *
 * The frontend entitlement gate previously hardcoded the founder's
 * email as a fallback owner identifier. That had two issues:
 *
 *   1. Privacy — the literal email shipped in every JS bundle, so
 *      anyone who downloaded the SPA could read it.
 *   2. Operational — the env-driven allowlist could not actually
 *      revoke owner access from the founder, because the bundle
 *      always agreed with itself.
 *
 * After the fix, owner status comes ONLY from `VITE_OWNER_EMAIL`.
 * This test statically asserts that the founder email no longer
 * appears anywhere in `frontend/src/lib/entitlement.ts`. Future
 * "convenience fallbacks" that re-introduce a literal are caught at
 * test time rather than at bundle time.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('frontend entitlement gate — no founder email literal', () => {
  it('does not contain the founder email anywhere in entitlement.ts', () => {
    const entitlementPath = join(__dirname, '..', 'entitlement.ts');
    const source = readFileSync(entitlementPath, 'utf8').toLowerCase();
    expect(source).not.toContain('jimmitchellnc83@gmail.com');
    expect(source).not.toContain('jimmitchellnc83');
  });

  it('does not redefine a hardcoded BUILTIN_OWNER constant', () => {
    const entitlementPath = join(__dirname, '..', 'entitlement.ts');
    const source = readFileSync(entitlementPath, 'utf8');
    expect(source).not.toMatch(/const\s+BUILTIN_OWNER\s*=/);
  });
});
