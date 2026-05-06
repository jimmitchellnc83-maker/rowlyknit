/**
 * Platform Hardening Sprint 2026-05-05 — finding #3 (route middleware).
 *
 * Pins the route-level parent gate on every nested
 * `/api/source-files/:id/crops/:cropId/...` mutation:
 *   - PATCH/DELETE crop
 *   - POST/GET annotations, PATCH/DELETE annotation-by-id
 *   - PATCH quickkey
 *   - PUT/GET alignment
 *   - POST magic-marker/sample, /match, /confirm
 *
 * For each route, verify:
 *   - When the URL parent matches the crop's actual source_file_id:
 *     middleware passes through, controller is invoked.
 *   - When the URL parent DOES NOT match: middleware throws
 *     NotFoundError → 404, controller is NOT invoked, no DB write
 *     reaches the underlying tables.
 *
 * The DB layer is mocked at the service-import boundary
 * (`getCropForParent`) so the test focuses purely on the route +
 * middleware wiring. A separate unit suite
 * (`services/__tests__/sourceFileService.test.ts`) pins the SQL
 * shape that getCropForParent emits.
 */

import express from 'express';
import request from 'supertest';

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock the service so the test doesn't need a live DB. The mock returns
// a stub crop when (sourceFileId, cropId, userId) matches the canonical
// ('sf-real', 'crop-real', 'user-1') triple, and null otherwise.
const getCropForParent = jest.fn();
jest.mock('../../services/sourceFileService', () => ({
  __esModule: true,
  getCropForParent,
}));

// Mock the controllers so we observe whether the middleware short-circuited
// or let the request through.
const updateSourceFileCrop = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'patch-crop' }),
);
const deleteSourceFileCrop = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'delete-crop' }),
);
const createAnnotationHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'create-ann' }),
);
const listAnnotationsHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'list-ann' }),
);
const updateAnnotationHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'update-ann' }),
);
const deleteAnnotationHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'delete-ann' }),
);
const setQuickKeyHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'quickkey' }),
);
const setAlignmentHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'set-align' }),
);
const getAlignmentHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'get-align' }),
);
const recordSampleHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'mm-sample' }),
);
const findMatchesHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'mm-match' }),
);
const confirmMatchesHandler = jest.fn(
  (_req: express.Request, res: express.Response) => res.json({ success: true, ctrl: 'mm-confirm' }),
);

jest.mock('../../controllers/sourceFilesController', () => ({
  __esModule: true,
  uploadSourceFileMiddleware: (_req: any, _res: any, next: any) => next(),
  uploadSourceFile: jest.fn(),
  listSourceFiles: jest.fn(),
  getSourceFile: jest.fn(),
  streamSourceFileBytes: jest.fn(),
  deleteSourceFile: jest.fn(),
  createSourceFileCrop: jest.fn(),
  listSourceFileCrops: jest.fn(),
  updateSourceFileCrop,
  deleteSourceFileCrop,
}));

jest.mock('../../controllers/annotationsController', () => ({
  __esModule: true,
  createAnnotationHandler,
  listAnnotationsHandler,
  updateAnnotationHandler,
  deleteAnnotationHandler,
  setQuickKeyHandler,
  listQuickKeysHandler: jest.fn(),
}));

jest.mock('../../controllers/chartAlignmentController', () => ({
  __esModule: true,
  setAlignmentHandler,
  getAlignmentHandler,
  recordSampleHandler,
  findMatchesHandler,
  confirmMatchesHandler,
}));

// Bypass JWT — every request gets the same user id.
jest.mock('../../middleware/auth', () => ({
  __esModule: true,
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

// PR #389 paywall closure added `requireEntitlement` to
// POST /:id/crops and POST /:id/crops/:cropId/annotations. Those gates
// run BEFORE the parent ownership check; this suite is testing the
// parent gate, not entitlement, so we stub the entitlement helper to
// always allow. Cross-cutting paywall coverage lives in
// paywallGateMatrix.test.ts.
jest.mock('../../utils/entitlement', () => ({
  __esModule: true,
  canUsePaidWorkspaceForReq: jest.fn(async () => ({
    allowed: true,
    reason: 'active_subscription',
  })),
}));

import sourceFilesRouter from '../source-files';
import { errorHandler } from '../../utils/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/source-files', sourceFilesRouter);
  app.use(errorHandler);
  return app;
}

const SF_REAL = '00000000-0000-4000-8000-00000000aaaa';
const SF_OTHER = '00000000-0000-4000-8000-00000000bbbb';
const CROP_REAL = '00000000-0000-4000-8000-00000000cccc';
const CROP_BOGUS = '00000000-0000-4000-8000-00000000dddd';
const ANN_ID = '00000000-0000-4000-8000-00000000eeee';
const CHART_ID = '00000000-0000-4000-8000-00000000ffff';
const ALIGN_ID = '00000000-0000-4000-8000-000000010000';

const REAL_CROP = {
  id: CROP_REAL,
  sourceFileId: SF_REAL,
  userId: 'user-1',
  patternId: null,
  patternSectionId: null,
  pageNumber: 1,
  cropX: 0.1,
  cropY: 0.1,
  cropWidth: 0.5,
  cropHeight: 0.5,
  label: null,
  chartId: null,
  isQuickKey: false,
  quickKeyPosition: null,
  metadata: {},
  createdAt: '2026-05-05T00:00:00Z',
  updatedAt: '2026-05-05T00:00:00Z',
  deletedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: only the canonical (SF_REAL, CROP_REAL) triple resolves.
  getCropForParent.mockImplementation(
    async (sourceFileId: string, cropId: string, userId: string) => {
      if (
        sourceFileId === SF_REAL &&
        cropId === CROP_REAL &&
        userId === 'user-1'
      ) {
        return REAL_CROP;
      }
      return null;
    },
  );
});

// ============================================================
// Each route checks two paths: (1) matching parent → controller
// runs; (2) wrong parent → 404, controller never runs.
// ============================================================

describe('PATCH /api/source-files/:id/crops/:cropId — parent gate', () => {
  it('passes through when parent matches', async () => {
    const res = await request(buildApp())
      .patch(`/api/source-files/${SF_REAL}/crops/${CROP_REAL}`)
      .send({ label: 'New label' });
    expect(res.status).toBe(200);
    expect(updateSourceFileCrop).toHaveBeenCalledTimes(1);
  });

  it('404s when parent mismatches and controller never runs', async () => {
    const res = await request(buildApp())
      .patch(`/api/source-files/${SF_OTHER}/crops/${CROP_REAL}`)
      .send({ label: 'Should not write' });
    expect(res.status).toBe(404);
    expect(updateSourceFileCrop).not.toHaveBeenCalled();
  });

  it('404s when crop id is unknown and controller never runs', async () => {
    const res = await request(buildApp())
      .patch(`/api/source-files/${SF_REAL}/crops/${CROP_BOGUS}`)
      .send({ label: 'X' });
    expect(res.status).toBe(404);
    expect(updateSourceFileCrop).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/source-files/:id/crops/:cropId — parent gate', () => {
  it('passes through when parent matches', async () => {
    const res = await request(buildApp()).delete(
      `/api/source-files/${SF_REAL}/crops/${CROP_REAL}`,
    );
    expect(res.status).toBe(200);
    expect(deleteSourceFileCrop).toHaveBeenCalledTimes(1);
  });

  it('404s when parent mismatches and controller never runs (no soft-delete)', async () => {
    const res = await request(buildApp()).delete(
      `/api/source-files/${SF_OTHER}/crops/${CROP_REAL}`,
    );
    expect(res.status).toBe(404);
    expect(deleteSourceFileCrop).not.toHaveBeenCalled();
  });
});

describe('annotations routes — parent gate', () => {
  it('POST /annotations passes when parent matches', async () => {
    const res = await request(buildApp())
      .post(`/api/source-files/${SF_REAL}/crops/${CROP_REAL}/annotations`)
      .send({ annotationType: 'pen', payload: { strokes: [] } });
    expect(res.status).toBe(200);
    expect(createAnnotationHandler).toHaveBeenCalledTimes(1);
  });

  it('POST /annotations 404s when parent mismatches', async () => {
    const res = await request(buildApp())
      .post(`/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/annotations`)
      .send({ annotationType: 'pen', payload: { strokes: [] } });
    expect(res.status).toBe(404);
    expect(createAnnotationHandler).not.toHaveBeenCalled();
  });

  it('GET /annotations passes when parent matches', async () => {
    const res = await request(buildApp()).get(
      `/api/source-files/${SF_REAL}/crops/${CROP_REAL}/annotations`,
    );
    expect(res.status).toBe(200);
    expect(listAnnotationsHandler).toHaveBeenCalledTimes(1);
  });

  it('GET /annotations 404s when parent mismatches', async () => {
    const res = await request(buildApp()).get(
      `/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/annotations`,
    );
    expect(res.status).toBe(404);
    expect(listAnnotationsHandler).not.toHaveBeenCalled();
  });

  it('PATCH /annotations/:annotationId 404s when parent mismatches', async () => {
    const res = await request(buildApp())
      .patch(
        `/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/annotations/${ANN_ID}`,
      )
      .send({ payload: { strokes: [] } });
    expect(res.status).toBe(404);
    expect(updateAnnotationHandler).not.toHaveBeenCalled();
  });

  it('PATCH /annotations/:annotationId passes when parent matches', async () => {
    const res = await request(buildApp())
      .patch(
        `/api/source-files/${SF_REAL}/crops/${CROP_REAL}/annotations/${ANN_ID}`,
      )
      .send({ payload: { strokes: [] } });
    expect(res.status).toBe(200);
    expect(updateAnnotationHandler).toHaveBeenCalledTimes(1);
  });

  it('DELETE /annotations/:annotationId 404s when parent mismatches', async () => {
    const res = await request(buildApp()).delete(
      `/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/annotations/${ANN_ID}`,
    );
    expect(res.status).toBe(404);
    expect(deleteAnnotationHandler).not.toHaveBeenCalled();
  });
});

describe('PATCH /quickkey — parent gate', () => {
  it('passes when parent matches', async () => {
    const res = await request(buildApp())
      .patch(`/api/source-files/${SF_REAL}/crops/${CROP_REAL}/quickkey`)
      .send({ isQuickKey: true, position: 0 });
    expect(res.status).toBe(200);
    expect(setQuickKeyHandler).toHaveBeenCalledTimes(1);
  });

  it('404s when parent mismatches and controller never runs', async () => {
    const res = await request(buildApp())
      .patch(`/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/quickkey`)
      .send({ isQuickKey: true, position: 0 });
    expect(res.status).toBe(404);
    expect(setQuickKeyHandler).not.toHaveBeenCalled();
  });
});

describe('alignment routes — parent gate', () => {
  it('PUT /alignment passes when parent matches', async () => {
    const res = await request(buildApp())
      .put(`/api/source-files/${SF_REAL}/crops/${CROP_REAL}/alignment`)
      .send({
        gridX: 0.1,
        gridY: 0.1,
        gridWidth: 0.5,
        gridHeight: 0.5,
        cellsAcross: 10,
        cellsDown: 10,
      });
    expect(res.status).toBe(200);
    expect(setAlignmentHandler).toHaveBeenCalledTimes(1);
  });

  it('PUT /alignment 404s when parent mismatches', async () => {
    const res = await request(buildApp())
      .put(`/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/alignment`)
      .send({
        gridX: 0.1,
        gridY: 0.1,
        gridWidth: 0.5,
        gridHeight: 0.5,
        cellsAcross: 10,
        cellsDown: 10,
      });
    expect(res.status).toBe(404);
    expect(setAlignmentHandler).not.toHaveBeenCalled();
  });

  it('GET /alignment 404s when parent mismatches', async () => {
    const res = await request(buildApp()).get(
      `/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/alignment`,
    );
    expect(res.status).toBe(404);
    expect(getAlignmentHandler).not.toHaveBeenCalled();
  });
});

describe('magic-marker routes — parent gate', () => {
  it('POST /magic-marker/sample passes when parent matches', async () => {
    const res = await request(buildApp())
      .post(
        `/api/source-files/${SF_REAL}/crops/${CROP_REAL}/magic-marker/sample`,
      )
      .send({
        chartAlignmentId: ALIGN_ID,
        symbol: 'k',
        gridRow: 0,
        gridCol: 0,
      });
    expect(res.status).toBe(200);
    expect(recordSampleHandler).toHaveBeenCalledTimes(1);
  });

  it('POST /magic-marker/sample 404s when parent mismatches', async () => {
    const res = await request(buildApp())
      .post(
        `/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/magic-marker/sample`,
      )
      .send({
        chartAlignmentId: ALIGN_ID,
        symbol: 'k',
        gridRow: 0,
        gridCol: 0,
      });
    expect(res.status).toBe(404);
    expect(recordSampleHandler).not.toHaveBeenCalled();
  });

  it('POST /magic-marker/match 404s when parent mismatches', async () => {
    const res = await request(buildApp())
      .post(
        `/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/magic-marker/match`,
      )
      .send({
        chartAlignmentId: ALIGN_ID,
        targetHash: 'a'.repeat(16),
      });
    expect(res.status).toBe(404);
    expect(findMatchesHandler).not.toHaveBeenCalled();
  });

  it('POST /magic-marker/confirm 404s when parent mismatches', async () => {
    const res = await request(buildApp())
      .post(
        `/api/source-files/${SF_OTHER}/crops/${CROP_REAL}/magic-marker/confirm`,
      )
      .send({
        chartId: CHART_ID,
        symbol: 'k',
        cells: [{ row: 0, col: 0 }],
      });
    expect(res.status).toBe(404);
    expect(confirmMatchesHandler).not.toHaveBeenCalled();
  });
});

describe('parent gate is universal across nested mutations', () => {
  // Cheap sanity check: the gate calls getCropForParent exactly once
  // per request. Any path that bypasses the call would have shown up
  // as a count mismatch.
  it('invokes getCropForParent exactly once per nested route call', async () => {
    await request(buildApp())
      .patch(`/api/source-files/${SF_REAL}/crops/${CROP_REAL}`)
      .send({ label: 'x' });
    expect(getCropForParent).toHaveBeenCalledTimes(1);
    expect(getCropForParent).toHaveBeenCalledWith(SF_REAL, CROP_REAL, 'user-1');
  });
});
