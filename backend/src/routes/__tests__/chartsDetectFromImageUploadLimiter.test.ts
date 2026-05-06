/**
 * Static-scan proof that POST /api/charts/detect-from-image mounts
 * `uploadLimiter` BEFORE `upload.single('image')`.
 *
 * Multer streams the uploaded image into memory storage as it parses
 * the multipart body. `requireEntitlement` already gates the route so
 * unentitled callers can never reach the parser, but an authed-and-
 * entitled user could still flood memory by repeatedly POSTing 10MB
 * images. `uploadLimiter` (default 20/hour, keyed by user) is the
 * mitigation — it must run before multer so refused requests don't
 * waste the buffer.
 *
 * If a future refactor reorders or removes the limiter, this scan over
 * `routes/charts.ts` fails.
 */

import fs from 'fs';
import path from 'path';

const ROUTE_FILE = path.resolve(__dirname, '..', 'charts.ts');

describe('charts POST /detect-from-image — uploadLimiter and requireEntitlement run before multer', () => {
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(ROUTE_FILE, 'utf8');
  });

  it("imports uploadLimiter from '../middleware/rateLimiter'", () => {
    expect(content).toMatch(/from\s+['"]\.\.\/middleware\/rateLimiter['"]/);
    expect(content).toContain('uploadLimiter');
  });

  it("declares POST '/detect-from-image' with requireEntitlement → uploadLimiter → multer ordering", () => {
    // Find the route declaration.
    const opener = /router\.post\s*\(\s*(['"`])\/detect-from-image\1/g;
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
    const multerIdx = body.indexOf("upload.single('image')");

    expect(entitlementIdx).toBeGreaterThanOrEqual(0);
    expect(limiterIdx).toBeGreaterThanOrEqual(0);
    expect(multerIdx).toBeGreaterThanOrEqual(0);

    // Required ordering: entitlement → limiter → multer.
    expect(entitlementIdx).toBeLessThan(limiterIdx);
    expect(limiterIdx).toBeLessThan(multerIdx);
  });
});
