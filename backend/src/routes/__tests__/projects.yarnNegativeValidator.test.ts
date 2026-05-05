/**
 * Platform Hardening Sprint 2026-05-05 — finding #2 (validator surface).
 *
 * Pins the route-level rejection of negative `yardsUsed` / `skeinsUsed`
 * on `POST /api/projects/:id/yarn` and `PUT /api/projects/:id/yarn/:yarnId`.
 * Companion to `controllers/__tests__/projectsController.yarnNegative.test.ts`,
 * which covers the controller-side guard. Two layers because either
 * one alone is insufficient: the route layer can be skipped if a future
 * refactor changes how the controller is invoked, and the controller
 * layer can be skipped if a future route bypasses validate().
 *
 * Mounts the validator chain on a stub Express app (no auth, no CSRF,
 * no DB) so the test focuses purely on the validator. The chain MUST
 * stay byte-for-byte aligned with the real route validators in
 * `routes/projects.ts`.
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

const controllerSpy = jest.fn(
  (_req: express.Request, res: express.Response) => {
    res.status(201).json({ success: true });
  },
);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { userId: 'user-1' };
    next();
  });

  // Mirror the real `POST /api/projects/:id/yarn` validator chain.
  app.post(
    '/api/projects/:id/yarn',
    [
      validateUUID('id'),
      body('yarnId').notEmpty().isUUID(),
      body('yardsUsed').optional({ values: 'falsy' }).isFloat({ min: 0 }),
      body('skeinsUsed').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    ],
    validate,
    controllerSpy,
  );

  // Mirror the real `PUT /api/projects/:id/yarn/:yarnId` validator chain.
  app.put(
    '/api/projects/:id/yarn/:yarnId',
    [
      validateUUID('id'),
      validateUUID('yarnId'),
      body('yardsUsed').optional({ values: 'falsy' }).isFloat({ min: 0 }),
      body('skeinsUsed').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    ],
    validate,
    controllerSpy,
  );

  app.use(errorHandler);
  return app;
}

const PROJECT_ID = '00000000-0000-4000-8000-000000000001';
const YARN_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  controllerSpy.mockClear();
});

describe('POST /api/projects/:id/yarn — negative-usage rejection', () => {
  it('rejects negative yardsUsed with 400 and never reaches the controller', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/yarn`)
      .send({ yarnId: YARN_ID, yardsUsed: -10, skeinsUsed: 0 });

    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('rejects negative skeinsUsed with 400', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/yarn`)
      .send({ yarnId: YARN_ID, yardsUsed: 0, skeinsUsed: -1 });

    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('rejects fractional negatives (e.g. -0.5 from a slider drag)', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/yarn`)
      .send({ yarnId: YARN_ID, yardsUsed: -0.5 });

    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('accepts 0 (valid: attach yarn before tracking usage)', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/yarn`)
      .send({ yarnId: YARN_ID, yardsUsed: 0, skeinsUsed: 0 });

    expect(res.status).toBe(201);
    expect(controllerSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts a positive yardsUsed', async () => {
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/yarn`)
      .send({ yarnId: YARN_ID, yardsUsed: 50.25, skeinsUsed: 1 });

    expect(res.status).toBe(201);
    expect(controllerSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts the empty-string skip semantics (.optional({ values: "falsy" }))', async () => {
    // Frontend forms send '' for unfilled numeric inputs; the route
    // validator's `optional({ values: 'falsy' })` skips those. Locks
    // in that we didn't accidentally tighten this contract while
    // adding the min-0 check.
    const res = await request(buildApp())
      .post(`/api/projects/${PROJECT_ID}/yarn`)
      .send({ yarnId: YARN_ID, yardsUsed: '', skeinsUsed: '' });

    expect(res.status).toBe(201);
    expect(controllerSpy).toHaveBeenCalledTimes(1);
  });
});

describe('PUT /api/projects/:id/yarn/:yarnId — negative-usage rejection', () => {
  it('rejects negative yardsUsed with 400 and never reaches the controller', async () => {
    const res = await request(buildApp())
      .put(`/api/projects/${PROJECT_ID}/yarn/${YARN_ID}`)
      .send({ yardsUsed: -100, skeinsUsed: 0 });

    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('rejects negative skeinsUsed with 400', async () => {
    const res = await request(buildApp())
      .put(`/api/projects/${PROJECT_ID}/yarn/${YARN_ID}`)
      .send({ yardsUsed: 0, skeinsUsed: -3 });

    expect(res.status).toBe(400);
    expect(controllerSpy).not.toHaveBeenCalled();
  });

  it('accepts a positive update and reaches the controller', async () => {
    const res = await request(buildApp())
      .put(`/api/projects/${PROJECT_ID}/yarn/${YARN_ID}`)
      .send({ yardsUsed: 200, skeinsUsed: 2 });

    expect(res.status).toBe(201);
    expect(controllerSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts updates that omit both fields (e.g. metadata-only patch)', async () => {
    // The validator marks both fields optional with falsy-skip, so an
    // empty body still passes through. The controller has its own logic
    // for what to do with an empty update; the validator's job is just
    // not to false-reject.
    const res = await request(buildApp())
      .put(`/api/projects/${PROJECT_ID}/yarn/${YARN_ID}`)
      .send({});

    expect(res.status).toBe(201);
    expect(controllerSpy).toHaveBeenCalledTimes(1);
  });
});
