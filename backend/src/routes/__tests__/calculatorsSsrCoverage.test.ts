/**
 * PR #389 final-pass P2 — public-tool SSR coverage matrix.
 *
 * Every entry in `frontend/src/lib/publicTools.ts` that emits a public
 * route (i.e. doesn't require auth) MUST have:
 *
 *   1. A SSR JSON-LD payload registered in `routes/calculators-ssr.ts`
 *      (so non-JS crawlers see structured data on first parse).
 *   2. An exact-match nginx `location =` block in the prod nginx
 *      config that proxies to the backend (so the SSR payload is
 *      actually served instead of falling through to the SPA).
 *
 * Forgetting either half ships a tool with no Bing / Pinterest / FB
 * structured data. This test reads three files from disk and asserts
 * coverage across them.
 *
 * The yarn-sub tool is intentionally NOT covered: it ranks a user's
 * stash and is auth-only. `robots.txt` disallows it. The list of
 * public-eligible routes therefore excludes it.
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const PUBLIC_TOOLS_FILE = path.join(REPO_ROOT, 'frontend/src/lib/publicTools.ts');
const SSR_ROUTE_FILE = path.join(REPO_ROOT, 'backend/src/routes/calculators-ssr.ts');
const NGINX_CONF_FILE = path.join(REPO_ROOT, 'deployment/nginx/conf.d/rowlyknit.conf');

/** Tool ids that intentionally remain auth-only (no public SSR). */
const AUTH_ONLY_TOOLS = new Set<string>([
  // Yarn-substitution ranks the user's own stash.
  'yarn-sub',
]);

function readPublicToolRoutes(): string[] {
  const src = fs.readFileSync(PUBLIC_TOOLS_FILE, 'utf8');
  const idMatches = Array.from(src.matchAll(/\bid:\s*['"]([a-z][a-z0-9-]*)['"]/g));
  const routeMatches = Array.from(src.matchAll(/\broute:\s*['"]([^'"]+)['"]/g));
  // The two arrays are in declaration order in PUBLIC_TOOLS, so zip
  // them to map id → route.
  const tools: { id: string; route: string }[] = [];
  for (let i = 0; i < idMatches.length && i < routeMatches.length; i++) {
    tools.push({ id: idMatches[i][1], route: routeMatches[i][1] });
  }
  return tools
    .filter((t) => !AUTH_ONLY_TOOLS.has(t.id))
    .filter((t) => t.route.startsWith('/calculators/'))
    .map((t) => t.route);
}

describe('calculators-ssr + nginx — every public tool has SSR JSON-LD and an nginx exact location', () => {
  let publicRoutes: string[];
  let ssrSource: string;
  let nginxSource: string;

  beforeAll(() => {
    publicRoutes = readPublicToolRoutes();
    ssrSource = fs.readFileSync(SSR_ROUTE_FILE, 'utf8');
    nginxSource = fs.readFileSync(NGINX_CONF_FILE, 'utf8');
  });

  it('parses at least three public tool routes from publicTools.ts', () => {
    // Sanity bound — fewer means we missed the registry shape.
    expect(publicRoutes.length).toBeGreaterThanOrEqual(3);
    expect(publicRoutes).toEqual(expect.arrayContaining(['/calculators/gauge', '/calculators/size']));
  });

  it.each(['/calculators/yardage', '/calculators/row-repeat', '/calculators/shaping'])(
    'Sprint-1 tool %s is registered in calculators-ssr.ts ROUTE_PAYLOADS',
    (route) => {
      expect(ssrSource).toContain(`'${route}'`);
    },
  );

  it.each(['/calculators/yardage', '/calculators/row-repeat', '/calculators/shaping'])(
    'Sprint-1 tool %s has an exact nginx location =',
    (route) => {
      const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`location\\s*=\\s*${escaped}\\s*\\{`);
      expect(re.test(nginxSource)).toBe(true);
    },
  );

  it('every public tool route from publicTools.ts is registered in calculators-ssr.ts', () => {
    for (const route of publicRoutes) {
      // We accept either the canonical `/calculators/size` mapping or
      // the gift-size alias path; tests above already pin the new tools.
      expect(ssrSource).toContain(`'${route}'`);
    }
  });

  it('every public tool route from publicTools.ts has a matching nginx exact location', () => {
    for (const route of publicRoutes) {
      const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`location\\s*=\\s*${escaped}\\s*\\{`);
      expect(re.test(nginxSource)).toBe(true);
    }
  });
});
