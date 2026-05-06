/**
 * PR #389 final-pass P2 — static-scan proof that source-file uploads
 * mount uploadLimiter BEFORE multer.
 *
 * The actual middleware-stack ordering matters here: multer streams the
 * uploaded file to disk as it parses the multipart body, so any gate
 * that runs after multer has already let the bytes hit the filesystem.
 * Both `requireEntitlement` (auth/billing) and `uploadLimiter` (per-user
 * abuse cap) must therefore run before `sf.uploadSourceFileMiddleware`.
 *
 * Reads `routes/source-files.ts` from disk and asserts the literal
 * tokens appear in the right order in the POST `/` route declaration.
 * If a future refactor reorders or removes either gate, the scan over
 * this file fails.
 */

import fs from 'fs';
import path from 'path';

const ROUTE_FILE = path.resolve(
  __dirname,
  '..',
  'source-files.ts',
);

describe('source-files POST / — uploadLimiter and requireEntitlement run before multer', () => {
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(ROUTE_FILE, 'utf8');
  });

  it("imports uploadLimiter from '../middleware/rateLimiter'", () => {
    expect(content).toMatch(/from\s+['"]\.\.\/middleware\/rateLimiter['"]/);
    expect(content).toContain('uploadLimiter');
  });

  it("imports requireEntitlement from '../middleware/requireEntitlement'", () => {
    expect(content).toMatch(/from\s+['"]\.\.\/middleware\/requireEntitlement['"]/);
    expect(content).toContain('requireEntitlement');
  });

  it("declares POST '/' with requireEntitlement → uploadLimiter → multer ordering", () => {
    // Find the body of `router.post('/', ...)` declaration.
    const opener = /router\.post\s*\(\s*(['"`])\/\1/g;
    const m = opener.exec(content);
    expect(m).not.toBeNull();

    // Walk parens to find the call body.
    let i = m!.index;
    while (i < content.length && content[i] !== '(') i++;
    const openParenIdx = i;
    let depth = 0;
    let endIdx = -1;
    for (; i < content.length; i++) {
      const c = content[i];
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    expect(endIdx).toBeGreaterThan(openParenIdx);

    const body = content.substring(openParenIdx + 1, endIdx);

    const entitlementIdx = body.indexOf('requireEntitlement');
    const limiterIdx = body.indexOf('uploadLimiter');
    const multerIdx = body.indexOf('sf.uploadSourceFileMiddleware');

    expect(entitlementIdx).toBeGreaterThanOrEqual(0);
    expect(limiterIdx).toBeGreaterThanOrEqual(0);
    expect(multerIdx).toBeGreaterThanOrEqual(0);

    // Required ordering: entitlement → limiter → multer. The first two
    // can swap (both must precede multer) but the spec asks for
    // entitlement first; pin it to lock convention across the codebase.
    expect(entitlementIdx).toBeLessThan(limiterIdx);
    expect(limiterIdx).toBeLessThan(multerIdx);
  });
});
