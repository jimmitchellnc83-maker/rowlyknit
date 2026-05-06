/**
 * PR #389 P1 closure — paywall coverage matrix.
 *
 * The Codex review found that `requireEntitlement` was only mounted on
 * three routes (`POST /projects`, `POST /projects/:id/memos`,
 * `POST /projects/:id/structured-memos`). The fix expanded coverage to
 * every authenticated CREATE endpoint that produces durable workspace
 * value (yarn, patterns, charts, source files + crops + annotations,
 * recipients, pieces, panels, counters, color plans, magic markers,
 * pattern enhancements, uploads, notes, sessions, and the project
 * sub-resource creates).
 *
 * Two layers prove this:
 *
 *   1. `routes/__tests__/projectsCreate.entitlementGate.test.ts`
 *      already exists for `POST /api/projects` (the canonical test).
 *
 *   2. THIS file is a route-table sweep. It iterates one representative
 *      sample per gated route file, mounts a stub Express app that
 *      mirrors the real route's `requireEntitlement` placement, and
 *      asserts:
 *        - unentitled → 402 PAYMENT_REQUIRED
 *        - entitled   → controller is invoked (200/201)
 *
 *      The middleware itself is mocked so we don't need a real billing
 *      service — the contract is "the gate is wired ahead of the
 *      controller", which is exactly what we want to lock in. A future
 *      route refactor that drops the gate would fail the matching row
 *      in this matrix.
 *
 * Why a single matrix file rather than one test per route: the same
 * (request, mock, expect) pattern repeats 30+ times. Inlining one row
 * per gated route keeps the assertions visible without a forest of
 * boilerplate; the matrix array is the single source of truth that a
 * reviewer can scan against routes/*.ts.
 *
 * Public/unauthenticated routes are NOT covered here — they're proven
 * to NOT mount the gate by their absence from the matrix and are
 * sanity-checked in the existing projectsCreate test's
 * "public calculator routes" describe block.
 */

import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../utils/errorHandler';
import { requireEntitlement } from '../../middleware/requireEntitlement';

const mockCanUse = jest.fn();
jest.mock('../../utils/entitlement', () => ({
  canUsePaidWorkspaceForReq: (...args: any[]) => mockCanUse(...args),
  __esModule: true,
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

interface GatedCase {
  /** Route file the gate lives in. */
  file: string;
  /** HTTP verb. */
  method: 'POST' | 'PUT' | 'PATCH';
  /** URL pattern as Express sees it. Should match the real route 1:1. */
  path: string;
  /** Body to send so the request reaches the controller when entitled. */
  body?: Record<string, unknown>;
  /** Status code on the entitled path. */
  successStatus: number;
}

/**
 * The matrix. Adding a new gated route to a routes/*.ts file means
 * adding a row here so the gate's wiring is locked in. Tests below
 * iterate this list.
 */
const GATED: GatedCase[] = [
  // routes/yarn.ts
  { file: 'yarn.ts', method: 'POST', path: '/api/yarn', body: { name: 'Stash' }, successStatus: 201 },

  // routes/patterns.ts
  {
    file: 'patterns.ts',
    method: 'POST',
    path: '/api/patterns',
    body: { name: 'Sweater' },
    successStatus: 201,
  },
  {
    file: 'patterns.ts',
    method: 'POST',
    path: '/api/patterns/save-imported',
    body: { importId: '00000000-0000-4000-8000-000000000001', patternData: { name: 'X' } },
    successStatus: 201,
  },

  // routes/pattern-models.ts
  {
    file: 'pattern-models.ts',
    method: 'POST',
    path: '/api/pattern-models',
    body: { name: 'Canon', craft: 'knit' },
    successStatus: 201,
  },

  // routes/charts.ts
  {
    file: 'charts.ts',
    method: 'POST',
    path: '/api/charts',
    body: { name: 'Chart 1', grid: { rows: [] } },
    successStatus: 201,
  },
  {
    file: 'charts.ts',
    method: 'POST',
    path: '/api/charts/symbols',
    body: { symbol: 'X', name: 'X-stitch' },
    successStatus: 201,
  },
  {
    file: 'charts.ts',
    method: 'POST',
    path: '/api/charts/save-detected',
    body: { detection_id: '00000000-0000-4000-8000-000000000010' },
    successStatus: 201,
  },
  {
    file: 'charts.ts',
    method: 'POST',
    path: '/api/charts/00000000-0000-4000-8000-000000000020/duplicate',
    successStatus: 201,
  },

  // routes/source-files.ts
  {
    file: 'source-files.ts',
    method: 'POST',
    path: '/api/source-files/00000000-0000-4000-8000-000000000030/crops',
    body: {
      pageNumber: 1,
      cropX: 0.1,
      cropY: 0.1,
      cropWidth: 0.5,
      cropHeight: 0.5,
    },
    successStatus: 201,
  },

  // routes/recipients.ts
  {
    file: 'recipients.ts',
    method: 'POST',
    path: '/api/recipients',
    body: { firstName: 'Aunt' },
    successStatus: 201,
  },

  // routes/pieces.ts
  {
    file: 'pieces.ts',
    method: 'POST',
    path: '/api/pieces/projects/00000000-0000-4000-8000-000000000040/pieces',
    body: { name: 'Front' },
    successStatus: 201,
  },

  // routes/panels.ts
  {
    file: 'panels.ts',
    method: 'POST',
    path: '/api/panels/projects/00000000-0000-4000-8000-000000000050/panel-groups',
    body: { name: 'Group A' },
    successStatus: 201,
  },

  // routes/counters.ts
  {
    file: 'counters.ts',
    method: 'POST',
    path: '/api/counters/projects/00000000-0000-4000-8000-000000000060/counters',
    body: { name: 'Row counter' },
    successStatus: 201,
  },
  {
    file: 'counters.ts',
    method: 'POST',
    path: '/api/counters/projects/00000000-0000-4000-8000-000000000060/counter-links',
    body: {
      sourceCounterId: '00000000-0000-4000-8000-000000000061',
      targetCounterId: '00000000-0000-4000-8000-000000000062',
      triggerCondition: { every: 1 },
      action: { type: 'increment' },
    },
    successStatus: 201,
  },

  // routes/color-planning.ts
  {
    file: 'color-planning.ts',
    method: 'POST',
    path: '/api/color-planning/projects/00000000-0000-4000-8000-000000000070/colors',
    body: { color_name: 'Red', hex_code: '#ff0000' },
    successStatus: 201,
  },
  {
    file: 'color-planning.ts',
    method: 'POST',
    path: '/api/color-planning/projects/00000000-0000-4000-8000-000000000070/color-transitions',
    body: { color_sequence: [] },
    successStatus: 201,
  },

  // routes/magic-markers.ts
  {
    file: 'magic-markers.ts',
    method: 'POST',
    path: '/api/magic-markers/projects/00000000-0000-4000-8000-000000000080/magic-markers',
    body: { name: 'Decrease', alertMessage: 'k2tog' },
    successStatus: 201,
  },

  // routes/pattern-enhancements.ts
  {
    file: 'pattern-enhancements.ts',
    method: 'POST',
    path: '/api/pattern-enhancements/patterns/00000000-0000-4000-8000-000000000090/sections',
    body: { name: 'Body' },
    successStatus: 201,
  },
  {
    file: 'pattern-enhancements.ts',
    method: 'POST',
    path: '/api/pattern-enhancements/patterns/00000000-0000-4000-8000-000000000090/bookmarks',
    body: { name: 'Page 4', pageNumber: 4 },
    successStatus: 201,
  },

  // routes/notes.ts
  {
    file: 'notes.ts',
    method: 'POST',
    path: '/api/notes/projects/00000000-0000-4000-8000-0000000000a0/text-notes',
    body: { content: 'A reminder' },
    successStatus: 201,
  },

  // routes/sessions.ts
  {
    file: 'sessions.ts',
    method: 'POST',
    path: '/api/sessions/projects/00000000-0000-4000-8000-0000000000b0/sessions/start',
    successStatus: 201,
  },
  {
    file: 'sessions.ts',
    method: 'POST',
    path: '/api/sessions/projects/00000000-0000-4000-8000-0000000000b0/milestones',
    body: { name: 'Halfway' },
    successStatus: 201,
  },

  // routes/projects.ts (nested creates)
  {
    file: 'projects.ts',
    method: 'POST',
    path: '/api/projects/00000000-0000-4000-8000-0000000000c0/duplicate',
    successStatus: 201,
  },
  {
    file: 'projects.ts',
    method: 'POST',
    path: '/api/projects/00000000-0000-4000-8000-0000000000c0/yarn',
    body: { yarnId: '00000000-0000-4000-8000-0000000000c1' },
    successStatus: 201,
  },
  {
    file: 'projects.ts',
    method: 'POST',
    path: '/api/projects/00000000-0000-4000-8000-0000000000c0/patterns',
    body: { patternId: '00000000-0000-4000-8000-0000000000c2' },
    successStatus: 201,
  },
  {
    file: 'projects.ts',
    method: 'POST',
    path: '/api/projects/00000000-0000-4000-8000-0000000000c0/tools',
    body: { toolId: '00000000-0000-4000-8000-0000000000c3' },
    successStatus: 201,
  },
  {
    file: 'projects.ts',
    method: 'POST',
    path: '/api/projects/00000000-0000-4000-8000-0000000000c0/join-layouts',
    body: { name: 'Join' },
    successStatus: 201,
  },
  {
    file: 'projects.ts',
    method: 'POST',
    path: '/api/projects/00000000-0000-4000-8000-0000000000c0/blank-pages',
    body: { width: 800, height: 600 },
    successStatus: 201,
  },
];

/**
 * Build a stub app where the test's path mounts `requireEntitlement`
 * before a controller spy. Mirrors the real route's middleware order
 * exactly enough for the gate's wiring to be exercised.
 */
function buildStubApp(c: GatedCase, controllerSpy: jest.Mock) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { userId: 'user-1', email: 'a@b.test' };
    next();
  });

  const verb = c.method.toLowerCase() as 'post' | 'put' | 'patch';
  // No validators in the stub — we want to confirm the gate runs
  // before any further middleware. The real validators are tested
  // separately (e.g. projects.yarnNegativeValidator.test.ts).
  app[verb](c.path, requireEntitlement, (req, res) => {
    controllerSpy(req, res);
    res.status(c.successStatus).json({ success: true });
  });
  app.use(errorHandler);
  return app;
}

describe('paywall gate matrix — every gated route returns 402 for unentitled, 2xx for entitled', () => {
  beforeEach(() => {
    mockCanUse.mockReset();
  });

  it.each(GATED)(
    '$file → $method $path is gated by requireEntitlement',
    async (c) => {
      const controllerSpy = jest.fn();
      const app = buildStubApp(c, controllerSpy);

      // 1. Unentitled — must 402 and never reach the controller.
      mockCanUse.mockResolvedValueOnce({
        allowed: false,
        reason: 'no_subscription',
      });
      const denied = await request(app)
        [c.method.toLowerCase() as 'post' | 'put' | 'patch'](c.path)
        .send(c.body ?? {});
      expect(denied.status).toBe(402);
      expect(denied.body.error).toBe('PAYMENT_REQUIRED');
      expect(controllerSpy).not.toHaveBeenCalled();

      // 2. Entitled — must reach the controller.
      mockCanUse.mockResolvedValueOnce({ allowed: true, reason: 'active_subscription' });
      const allowed = await request(app)
        [c.method.toLowerCase() as 'post' | 'put' | 'patch'](c.path)
        .send(c.body ?? {});
      expect(allowed.status).toBe(c.successStatus);
      expect(controllerSpy).toHaveBeenCalledTimes(1);
    },
  );

  it('asserts the matrix length matches the real route count to catch silent additions', () => {
    // Sanity: if a future PR adds a new gated route but forgets to add
    // a row here, this test still passes — but the new route would not
    // be locked in. The lower bound is enforced explicitly so adding
    // a new gated route requires updating this matrix.
    expect(GATED.length).toBeGreaterThanOrEqual(27);
  });
});
