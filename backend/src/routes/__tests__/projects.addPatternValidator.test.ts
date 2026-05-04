/**
 * Sprint 2 fix-up: route validator for POST /api/projects/:id/patterns
 * must enforce the XOR contract (`patternId` XOR `patternModelId`)
 * BEFORE the controller runs (Codex re-review on PR #375 head a8cde1e).
 *
 * The previous validator was `body('patternId').notEmpty().isUUID()`,
 * which rejected `{ patternModelId }` requests with a 422 before the
 * controller's XOR branch could resolve the canonical id. This test
 * suite proves the new validator:
 *   1. Accepts `{ patternId }` (legacy unchanged).
 *   2. Accepts `{ patternModelId }` (canonical-only attach).
 *   3. Rejects an empty body.
 *   4. Rejects both fields set.
 *   5. Rejects an invalid UUID in either field.
 *
 * Mounts the route on a stub Express app with a passthrough
 * `authenticate` and a controller spy — keeps the test DB-free and
 * focused on the validator surface.
 */

import express from 'express';
import request from 'supertest';
import { body } from 'express-validator';
import { validate, validateUUID } from '../../middleware/validator';
import { errorHandler } from '../../utils/errorHandler';

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Capture controller invocations so each test can assert whether the
// request reached the controller (= validator passed) or not.
const controllerSpy = jest.fn(
  (_req: express.Request, res: express.Response) => {
    res.status(201).json({ success: true });
  },
);

// Minimal app that mirrors the relevant route line from src/routes/projects.ts.
// Re-implementing the validator chain inline (rather than importing the real
// router) avoids pulling the rest of the backend's route surface — including
// the heavy authenticate / CSRF / sanitize middleware — into this unit test.
// The chain MUST stay byte-for-byte aligned with the real route validator;
// drift here would silently let production break this contract again.
function buildApp() {
  const app = express();
  app.use(express.json());

  // The real router calls authenticate first; we no-op it here so we
  // can hit the validator without minting a JWT.
  app.use((req, _res, next) => {
    (req as any).user = { userId: 'user-1' };
    next();
  });

  app.post(
    '/api/projects/:id/patterns',
    [
      validateUUID('id'),
      body('patternId')
        .optional({ values: 'null' })
        .isUUID()
        .withMessage('patternId must be a UUID'),
      body('patternModelId')
        .optional({ values: 'null' })
        .isUUID()
        .withMessage('patternModelId must be a UUID'),
      body('modifications').optional({ values: 'null' }).isString(),
      body().custom((value) => {
        const has = (k: string) =>
          value &&
          typeof value === 'object' &&
          value[k] !== undefined &&
          value[k] !== null &&
          value[k] !== '';
        const hasLegacy = has('patternId');
        const hasCanonical = has('patternModelId');
        if (!hasLegacy && !hasCanonical) {
          throw new Error('Either patternId or patternModelId is required');
        }
        if (hasLegacy && hasCanonical) {
          throw new Error(
            'Provide only one of patternId or patternModelId, not both',
          );
        }
        return true;
      }),
    ],
    validate,
    controllerSpy,
  );

  // Use the real errorHandler so this test exercises the same status
  // code mapping production does. ValidationError → 400 via AppError.
  app.use(errorHandler);

  return app;
}

const PROJECT_ID = '00000000-0000-4000-8000-000000000001';
const LEGACY_ID = '11111111-1111-4111-8111-111111111111';
const CANONICAL_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  controllerSpy.mockClear();
});

describe('POST /api/projects/:id/patterns — validator XOR contract', () => {
  it('accepts { patternId } (legacy attach unchanged)', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/patterns`)
      .send({ patternId: LEGACY_ID });

    expect(res.status).toBe(201);
    expect(controllerSpy).toHaveBeenCalledTimes(1);
    expect(controllerSpy.mock.calls[0][0].body).toEqual({ patternId: LEGACY_ID });
  });

  it('accepts { patternModelId } (canonical-only attach reaches the controller)', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/patterns`)
      .send({ patternModelId: CANONICAL_ID });

    expect(res.status).toBe(201);
    expect(controllerSpy).toHaveBeenCalledTimes(1);
    expect(controllerSpy.mock.calls[0][0].body).toEqual({ patternModelId: CANONICAL_ID });
  });

  it('rejects an empty body (neither field set) before the controller runs', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/patterns`)
      .send({});

    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('rejects both fields set (XOR violation)', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/patterns`)
      .send({ patternId: LEGACY_ID, patternModelId: CANONICAL_ID });

    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid UUID in patternId', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/patterns`)
      .send({ patternId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid UUID in patternModelId', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/patterns`)
      .send({ patternModelId: 'also-not-a-uuid' });

    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('passes optional modifications through to the controller alongside patternId', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/patterns`)
      .send({ patternId: LEGACY_ID, modifications: 'Sleeve length +2 in' });

    expect(res.status).toBe(201);
    expect(controllerSpy.mock.calls[0][0].body.modifications).toBe('Sleeve length +2 in');
  });

  it('rejects when patternId is an empty string (notEmpty equivalent via XOR check)', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/patterns`)
      .send({ patternId: '' });

    // Empty string fails the XOR "neither set" branch — neither field
    // counts as present, so the validator rejects. This pins the
    // historical "notEmpty" guarantee that the previous validator chain
    // gave us, even though the new chain expresses it via the custom
    // body-level check rather than per-field `.notEmpty()`.
    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });
});
