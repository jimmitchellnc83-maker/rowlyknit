/**
 * Platform Hardening Sprint 2026-05-05 — finding #2.
 *
 * `POST /api/projects/:id/yarn` and `PUT /api/projects/:id/yarn/:yarnId`
 * historically used `body('yardsUsed').isNumeric()` with no min, so a
 * negative value survived the validator and reached the stash-adjust
 * transaction. On the update path, the diff arithmetic
 * `yardsUsed - projectYarn.yards_used` would go negative and the stash
 * UPDATE would CREDIT yards back into `yarn.yards_remaining` — a value
 * never bought, never knit, never owned.
 *
 * The fix is two layers:
 *   1. Route validator: `body('yardsUsed').isFloat({ min: 0 })`
 *   2. Controller guard: `assertNonNegativeYarnUsage` runs BEFORE the
 *      first DB read so a hostile request cannot probe project / yarn
 *      existence with a poisoned numeric value.
 *
 * This file pins layer 2. The route validator surface is exercised
 * separately in `routes/__tests__/projects.yarnNegativeValidator.test.ts`.
 */

const dbCall = jest.fn();
const txCall = jest.fn();

jest.mock('../../config/database', () => {
  const fn: any = (table: string) => dbCall(table);
  fn.transaction = (cb: (trx: any) => Promise<unknown>) => {
    txCall();
    return cb({} as any);
  };
  return { default: fn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/inputSanitizer', () => ({
  sanitizeSearchQuery: (s: string) => s,
}));

jest.mock('../../services/feasibilityService', () => ({
  getFeasibilityBatch: jest.fn(),
}));

jest.mock('../../services/needleInventoryService', () => ({
  checkNeedleInventory: jest.fn(),
}));

jest.mock('../../services/projectDuplicationService', () => ({
  duplicateProject: jest.fn(),
}));

jest.mock('../../services/patternService', () => ({
  materializeLegacyStubForCanonical: jest.fn(),
}));

import { addYarnToProject, updateProjectYarn } from '../projectsController';
import { ValidationError } from '../../utils/errorHandler';

function makeReq(body: any, params: any = {}): any {
  return { body, params, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('addYarnToProject — non-negative usage guard', () => {
  it('rejects negative yardsUsed BEFORE touching the DB', async () => {
    await expect(
      addYarnToProject(
        makeReq(
          { yarnId: 'yarn-1', yardsUsed: -10, skeinsUsed: 0 },
          { id: 'project-1' },
        ),
        makeRes(),
      ),
    ).rejects.toThrow(ValidationError);

    // Critical: the guard must fire BEFORE any project / yarn lookup
    // so a hostile request can't probe existence with a poisoned value.
    expect(dbCall).not.toHaveBeenCalled();
    expect(txCall).not.toHaveBeenCalled();
  });

  it('rejects negative skeinsUsed BEFORE touching the DB', async () => {
    await expect(
      addYarnToProject(
        makeReq(
          { yarnId: 'yarn-1', yardsUsed: 0, skeinsUsed: -1 },
          { id: 'project-1' },
        ),
        makeRes(),
      ),
    ).rejects.toThrow(ValidationError);
    expect(dbCall).not.toHaveBeenCalled();
    expect(txCall).not.toHaveBeenCalled();
  });

  it('rejects fractional negative yardsUsed', async () => {
    await expect(
      addYarnToProject(
        makeReq(
          { yarnId: 'yarn-1', yardsUsed: -0.5, skeinsUsed: 0 },
          { id: 'project-1' },
        ),
        makeRes(),
      ),
    ).rejects.toThrow(/yardsUsed/);
    expect(dbCall).not.toHaveBeenCalled();
  });

  it('rejects -Infinity yardsUsed (defensive against odd JSON parses)', async () => {
    await expect(
      addYarnToProject(
        makeReq(
          { yarnId: 'yarn-1', yardsUsed: -Infinity },
          { id: 'project-1' },
        ),
        makeRes(),
      ),
    ).rejects.toThrow(ValidationError);
    expect(dbCall).not.toHaveBeenCalled();
  });

  // Happy-path coverage (zero / positive values reaching the controller)
  // lives in `routes/__tests__/projects.yarnNegativeValidator.test.ts`,
  // which exercises the real Express validator chain end-to-end. Pulling
  // it in here would force a full DB-mock build-out for the transaction
  // path, which adds maintenance load without a meaningful contract win.
});

describe('updateProjectYarn — non-negative usage guard', () => {
  it('rejects negative yardsUsed BEFORE touching the DB', async () => {
    await expect(
      updateProjectYarn(
        makeReq(
          { yardsUsed: -100, skeinsUsed: 0 },
          { id: 'project-1', yarnId: 'yarn-1' },
        ),
        makeRes(),
      ),
    ).rejects.toThrow(ValidationError);

    // The whole point: a hostile -100 was previously credited to the
    // stash via the diff arithmetic. The guard must short-circuit
    // every DB touch including the project lookup.
    expect(dbCall).not.toHaveBeenCalled();
    expect(txCall).not.toHaveBeenCalled();
  });

  it('rejects negative skeinsUsed BEFORE touching the DB', async () => {
    await expect(
      updateProjectYarn(
        makeReq(
          { yardsUsed: 0, skeinsUsed: -3 },
          { id: 'project-1', yarnId: 'yarn-1' },
        ),
        makeRes(),
      ),
    ).rejects.toThrow(ValidationError);
    expect(dbCall).not.toHaveBeenCalled();
    expect(txCall).not.toHaveBeenCalled();
  });

  it('does NOT mutate yarn-remaining when rejecting a negative update', async () => {
    // Belt + suspenders: even if a future refactor adds a DB read
    // before the guard, the guard must throw before any UPDATE writes.
    // This test pins the contract that the request fails closed.
    dbCall.mockImplementation((table: string) => {
      const chain = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(0),
      };
      return chain;
    });

    await expect(
      updateProjectYarn(
        makeReq(
          { yardsUsed: -50, skeinsUsed: 0 },
          { id: 'project-1', yarnId: 'yarn-1' },
        ),
        makeRes(),
      ),
    ).rejects.toThrow(ValidationError);
    expect(txCall).not.toHaveBeenCalled();
  });
});
