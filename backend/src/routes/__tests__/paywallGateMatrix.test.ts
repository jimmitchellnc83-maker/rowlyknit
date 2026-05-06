/**
 * PR #389 P1 closure pass 2 — paywall coverage matrix as a STATIC ROUTE
 * SCAN against real route files.
 *
 * Pass 1 (PR #389) used a stub Express app that mounted
 * `requireEntitlement` itself, then asserted the stub returned 402 for
 * unentitled callers. That proved the middleware's behavior in
 * isolation but did NOT prove that any real `routes/*.ts` file
 * actually mounts the middleware in front of its create handlers — a
 * regression that removed `requireEntitlement` from a route would not
 * fail the test, because the test never read the route file.
 *
 * Codex flagged that as false confidence. This pass replaces the stub
 * with a string-level scan of the actual route source files:
 *
 *   For each gated `(file, method, path)` in the matrix:
 *     1. Read `backend/src/routes/<file>` from disk.
 *     2. Find the `router.<method>(<path>, ...)` declaration block by
 *        counting balanced parens from the opening `(`.
 *     3. Assert the captured block contains the literal token
 *        `requireEntitlement` AND that token appears BEFORE the
 *        first `asyncHandler(` reference.
 *     4. For routes that also mount multer (file-upload routes), assert
 *        `requireEntitlement` appears BEFORE the multer middleware
 *        reference too — so multer never streams an unentitled upload
 *        to disk / memory.
 *     5. Assert each gated file imports `requireEntitlement` from
 *        `../middleware/requireEntitlement` so we don't get a runtime
 *        ReferenceError after a refactor.
 *
 * If a future PR removes `requireEntitlement` from a real route, the
 * scan over THAT file will fail. If a refactor reorders middleware so
 * the gate runs after multer, the multer-before assertion fires.
 *
 * The matrix lower-bound assertion at the bottom catches the symmetric
 * mistake: adding a new gated route file but forgetting to register a
 * matrix row.
 */

import fs from 'fs';
import path from 'path';

const ROUTES_DIR = path.resolve(__dirname, '..');

interface GatedRoute {
  /** Basename inside backend/src/routes/. */
  file: string;
  /** HTTP verb as written in the route file (lowercase preferred). */
  method: 'post' | 'put' | 'patch';
  /**
   * The path string passed to `router.METHOD(...)` in the source file,
   * NOT the full /api/... URL. Must match the file 1:1.
   */
  pathInFile: string;
  /**
   * Optional: when set, assert `requireEntitlement` appears in the
   * route declaration BEFORE this literal token. Used for upload
   * routes so multer can never run on an unentitled request.
   */
  multerToken?: string;
  /**
   * Optional human description for the matrix; surfaced in the it.each
   * test name so a regression failure is self-documenting.
   */
  note?: string;
}

const GATED: GatedRoute[] = [
  // routes/yarn.ts
  { file: 'yarn.ts', method: 'post', pathInFile: '/' },

  // routes/patterns.ts
  { file: 'patterns.ts', method: 'post', pathInFile: '/' },
  { file: 'patterns.ts', method: 'post', pathInFile: '/save-imported' },
  {
    file: 'patterns.ts',
    method: 'post',
    pathInFile: '/import-from-url',
    note: 'outbound fetch + pattern_imports row write',
  },

  // routes/pattern-models.ts
  { file: 'pattern-models.ts', method: 'post', pathInFile: '/' },

  // routes/charts.ts
  { file: 'charts.ts', method: 'post', pathInFile: '/' },
  { file: 'charts.ts', method: 'post', pathInFile: '/symbols' },
  { file: 'charts.ts', method: 'post', pathInFile: '/save-detected' },
  { file: 'charts.ts', method: 'post', pathInFile: '/:chartId/duplicate' },
  {
    file: 'charts.ts',
    method: 'post',
    pathInFile: '/detect-from-image',
    multerToken: 'upload.single',
    note: 'multer-before-gate would let unentitled callers buffer image to memory',
  },
  {
    file: 'charts.ts',
    method: 'post',
    pathInFile: '/detection/:detectionId/correct',
    note: 'mutates detected_charts.grid + corrections',
  },

  // routes/source-files.ts
  {
    file: 'source-files.ts',
    method: 'post',
    pathInFile: '/',
    multerToken: 'sf.uploadSourceFileMiddleware',
    note: 'multer streams PDFs to disk — gate must run first',
  },
  { file: 'source-files.ts', method: 'post', pathInFile: '/:id/crops' },
  { file: 'source-files.ts', method: 'post', pathInFile: '/:id/crops/:cropId/annotations' },

  // routes/tools.ts
  { file: 'tools.ts', method: 'post', pathInFile: '/' },

  // routes/recipients.ts
  { file: 'recipients.ts', method: 'post', pathInFile: '/' },

  // routes/pieces.ts
  { file: 'pieces.ts', method: 'post', pathInFile: '/projects/:id/pieces' },

  // routes/panels.ts
  { file: 'panels.ts', method: 'post', pathInFile: '/projects/:id/panel-groups' },

  // routes/counters.ts
  { file: 'counters.ts', method: 'post', pathInFile: '/projects/:id/counters' },
  { file: 'counters.ts', method: 'post', pathInFile: '/projects/:id/counter-links' },

  // routes/color-planning.ts
  { file: 'color-planning.ts', method: 'post', pathInFile: '/projects/:projectId/colors' },
  { file: 'color-planning.ts', method: 'post', pathInFile: '/projects/:projectId/color-transitions' },

  // routes/magic-markers.ts
  { file: 'magic-markers.ts', method: 'post', pathInFile: '/projects/:id/magic-markers' },

  // routes/pattern-enhancements.ts
  { file: 'pattern-enhancements.ts', method: 'post', pathInFile: '/patterns/:patternId/sections' },
  { file: 'pattern-enhancements.ts', method: 'post', pathInFile: '/patterns/:patternId/bookmarks' },

  // routes/notes.ts
  { file: 'notes.ts', method: 'post', pathInFile: '/projects/:id/text-notes' },

  // routes/sessions.ts
  { file: 'sessions.ts', method: 'post', pathInFile: '/projects/:id/sessions/start' },
  { file: 'sessions.ts', method: 'post', pathInFile: '/projects/:id/milestones' },

  // routes/projects.ts (top-level + nested creates)
  { file: 'projects.ts', method: 'post', pathInFile: '/' },
  { file: 'projects.ts', method: 'post', pathInFile: '/:id/duplicate' },
  { file: 'projects.ts', method: 'post', pathInFile: '/:id/yarn' },
  { file: 'projects.ts', method: 'post', pathInFile: '/:id/patterns' },
  { file: 'projects.ts', method: 'post', pathInFile: '/:id/tools' },
  { file: 'projects.ts', method: 'post', pathInFile: '/:id/join-layouts' },
  { file: 'projects.ts', method: 'post', pathInFile: '/:id/blank-pages' },

  // routes/ravelry.ts (bulk imports — each writes durable rows)
  {
    file: 'ravelry.ts',
    method: 'post',
    pathInFile: '/stash/import',
    note: 'Ravelry stash import — bulk yarn rows',
  },
  {
    file: 'ravelry.ts',
    method: 'post',
    pathInFile: '/projects/import',
    note: 'Ravelry projects import — bulk project rows',
  },
  {
    file: 'ravelry.ts',
    method: 'post',
    pathInFile: '/favorites/yarns/import',
    note: 'Ravelry favourited-yarns import — wishlist yarn rows',
  },
  {
    file: 'ravelry.ts',
    method: 'post',
    pathInFile: '/queue/import',
    note: 'Ravelry queue import — bulk bookmark rows',
  },
  {
    file: 'ravelry.ts',
    method: 'post',
    pathInFile: '/library/import',
    note: 'Ravelry library import — bulk bookmark rows',
  },
];

/**
 * Cache file reads — most files have multiple matrix entries.
 */
const fileCache = new Map<string, string>();
function readRouteFile(file: string): string {
  let cached = fileCache.get(file);
  if (cached === undefined) {
    cached = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
    fileCache.set(file, cached);
  }
  return cached;
}

/**
 * Find the full text of `router.METHOD('PATH', ...)` declaration by
 * counting balanced parentheses from the opening paren after the verb.
 *
 * Returns the captured body (everything between the opening and closing
 * parens, exclusive) so callers don't need to strip the call signature
 * before searching for tokens.
 */
function extractRouteBody(
  fileContent: string,
  method: GatedRoute['method'],
  pathInFile: GatedRoute['pathInFile'],
): string | null {
  // Quote-style varies — match single, double, or backtick quotes. The
  // path itself is escaped for regex literal use.
  const escapedPath = pathInFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const opener = new RegExp(
    String.raw`router\.${method}\s*\(\s*(['"\`])${escapedPath}\1`,
    'g',
  );
  const m = opener.exec(fileContent);
  if (!m) return null;

  // Walk from m.index forward, find the first `(` (the call open),
  // then count parens to find its match.
  let i = m.index;
  while (i < fileContent.length && fileContent[i] !== '(') i++;
  if (i >= fileContent.length) return null;

  const openParenIdx = i;
  let depth = 0;
  for (; i < fileContent.length; i++) {
    const c = fileContent[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) {
        return fileContent.substring(openParenIdx + 1, i);
      }
    }
  }
  return null;
}

const uniqueGatedFiles = Array.from(new Set(GATED.map((g) => g.file)));

describe('paywall gate matrix — static scan of real route files', () => {
  it.each(uniqueGatedFiles)(
    '%s imports requireEntitlement from ../middleware/requireEntitlement',
    (file) => {
      const content = readRouteFile(file);
      // Allow any named-import form. Whitespace inside the brace
      // clause is tolerated; the path string is what we anchor on.
      expect(content).toMatch(/from\s+['"]\.\.\/middleware\/requireEntitlement['"]/);
      expect(content).toContain('requireEntitlement');
    },
  );

  it.each(GATED)(
    '$file: $method $pathInFile mounts requireEntitlement before asyncHandler',
    (route) => {
      const content = readRouteFile(route.file);
      const body = extractRouteBody(content, route.method, route.pathInFile);

      // 1. Route must exist as written in the matrix. Failure here means
      //    the path/method drifted — update the matrix to match.
      if (body === null) {
        throw new Error(
          `Could not locate router.${route.method}('${route.pathInFile}', ...) in routes/${route.file}. ` +
            'Did the path or method change? Update the matrix to match.',
        );
      }

      // 2. The gate must be present in the route's argument list.
      const gateIdx = body.indexOf('requireEntitlement');
      if (gateIdx < 0) {
        throw new Error(
          `routes/${route.file} → ${route.method.toUpperCase()} ${route.pathInFile} ` +
            'is missing requireEntitlement. Re-add the middleware before the controller. ' +
            (route.note ? `Why this route is gated: ${route.note}.` : ''),
        );
      }

      // 3. The gate must run BEFORE the asyncHandler-wrapped controller.
      const handlerIdx = body.indexOf('asyncHandler(');
      if (handlerIdx <= 0) {
        throw new Error(
          `Expected asyncHandler(...) in router.${route.method}('${route.pathInFile}', ...). ` +
            'This scanner assumes all gated routes wrap their controllers in asyncHandler.',
        );
      }
      if (gateIdx > handlerIdx) {
        throw new Error(
          `routes/${route.file} → ${route.method.toUpperCase()} ${route.pathInFile} ` +
            'mounts requireEntitlement AFTER asyncHandler — gate must run before the controller.',
        );
      }

      // 4. For upload routes, the gate must also precede multer so
      //    unentitled requests never hit memory/disk.
      if (route.multerToken) {
        const multerIdx = body.indexOf(route.multerToken);
        if (multerIdx <= 0) {
          throw new Error(
            `Expected '${route.multerToken}' inside router.${route.method}('${route.pathInFile}', ...). ` +
              'If the multer middleware was renamed, update the matrix.',
          );
        }
        if (gateIdx > multerIdx) {
          throw new Error(
            `routes/${route.file} → ${route.method.toUpperCase()} ${route.pathInFile} ` +
              `mounts requireEntitlement AFTER ${route.multerToken} — multer would buffer/disk-write ` +
              'an unentitled upload before the gate fires.',
          );
        }
      }

      // 5. Sanity asserts (so the test still appears in the green list
      //    when everything is in order).
      expect(gateIdx).toBeGreaterThanOrEqual(0);
      expect(gateIdx).toBeLessThan(handlerIdx);
    },
  );

  it('matrix size enforces lower bound — adding new gated routes requires updating this file', () => {
    // Was 27 in pass 1. Pass 2 adds chart detect-from-image, chart
    // correct, patterns import-from-url, tools, and 5 Ravelry imports
    // = +9. The lower bound here doubles as a "did you forget to add a
    // row?" signal — adding a new gated route to a routes/*.ts file
    // means appending to GATED above. This assertion catches the
    // symmetric mistake of adding the gate without locking it in.
    expect(GATED.length).toBeGreaterThanOrEqual(36);
  });
});
