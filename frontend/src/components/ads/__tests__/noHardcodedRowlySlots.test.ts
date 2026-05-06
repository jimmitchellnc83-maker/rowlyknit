/**
 * Regression guard: every JSX call site that passes a `slot` prop to
 * `PublicAdSection` (or directly to `PublicAdSlot`) must source the id
 * through `getAdSlotId(<tool>)` from `adsenseSlots.ts`. A hardcoded
 * `rowly-<tool>` literal in a page or non-test component means the
 * site-wide env-var wiring is bypassed — the dashboard's AdSense
 * readiness card will go green when the operator provisions the env
 * vars, but the actual `<ins data-ad-slot>` will still ship the
 * placeholder, so the slot will never fill.
 *
 * Test behavior: scan every `*.tsx` / `*.ts` file under
 * `frontend/src/pages` and `frontend/src/components` (excluding test
 * files and __tests__ directories) for the JSX-prop pattern
 * `slot="rowly-..."` (no spaces — JSX props don't use spaces around
 * `=`, so this avoids matching default-parameter syntax like
 * `slot = 'rowly-public-default'` in component definitions).
 * Anything found fails the test.
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const SCAN_DIRS = ['pages', 'components'].map((d) => path.join(ROOT, d));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(entry.name)) continue;
    if (/\.test\.(tsx|ts)$/.test(entry.name)) continue;
    if (full.includes(`${path.sep}__tests__${path.sep}`)) continue;
    out.push(full);
  }
  return out;
}

// JSX prop form: `slot="rowly-..."` or `slot='rowly-...'`. No spaces
// around `=` — that's how JSX writes props. This explicitly does NOT
// match `slot = 'rowly-public-default'` (default-parameter syntax with
// spaces) used inside component definitions.
const HARDCODED_SLOT = /slot=["']rowly-/;

// Strip block (`/* … */`) and line (`// …`) comments so prose in
// docstrings that quotes the forbidden pattern verbatim doesn't trip
// the guard. Cheap and good enough — we don't need to handle every
// edge case (template-literal-embedded comments etc.) because we're
// scanning our own source.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('Hardcoded rowly-* slot literal regression guard', () => {
  it('no source file under pages/ or components/ ships slot="rowly-..." (must use getAdSlotId)', () => {
    const offenders: string[] = [];
    for (const root of SCAN_DIRS) {
      if (!fs.existsSync(root)) continue;
      for (const file of walk(root)) {
        const raw = fs.readFileSync(file, 'utf8');
        const code = stripComments(raw);
        if (HARDCODED_SLOT.test(code)) {
          offenders.push(path.relative(ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
