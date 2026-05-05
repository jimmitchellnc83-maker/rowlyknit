/**
 * PR #384/#385 follow-up — finding #1.
 *
 * `PUT /api/projects/:id/yarn/:yarnId` accepts a partial body; callers
 * may send only `yardsUsed`, only `skeinsUsed`, or both. Pre-fix the
 * controller computed
 *
 *   yardsDiff  = (yardsUsed  || 0) - (existing.yards_used  || 0)
 *   skeinsDiff = (skeinsUsed || 0) - (existing.skeins_used || 0)
 *
 * which folded `undefined` and `0` into the same value. A frontend
 * sending `{ skeinsUsed: 4 }` would see `yardsUsed=undefined` collapse
 * to 0, producing a negative `yardsDiff` and CREDITING the user's
 * stash for every yard the project had previously consumed.
 *
 * Post-fix:
 *   - omitted fields fall back to the existing row's value (no diff)
 *   - both fields undefined → 400 (loud no-op rejection)
 *   - effective values feed both the project_yarn UPDATE and the
 *     stash adjustment, so partial bodies are internally consistent.
 *
 * This file exercises the controller directly with mocked db so the
 * stash-adjust SQL is observable in spies.
 */

const dbCall = jest.fn();
const trxYarnUpdate = jest.fn();
const trxProjectYarnUpdate = jest.fn();
const trxRaw = jest.fn((sql: string, bindings: unknown[]) => ({ sql, bindings }));

jest.mock('../../config/database', () => {
  const fn: any = (table: string) => dbCall(table);
  fn.transaction = (cb: (trx: any) => Promise<unknown>) => {
    const trx: any = (table: string) => {
      if (table === 'project_yarn') {
        return {
          where: jest.fn().mockReturnThis(),
          update: trxProjectYarnUpdate,
        };
      }
      if (table === 'yarn') {
        return {
          where: jest.fn().mockReturnThis(),
          update: trxYarnUpdate,
          first: jest.fn().mockResolvedValue({
            yards_remaining: 1000,
            skeins_remaining: 5,
            low_stock_alert: false,
          }),
        };
      }
      return { where: jest.fn().mockReturnThis() };
    };
    trx.raw = trxRaw;
    return cb(trx);
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

import { updateProjectYarn } from '../projectsController';
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

/**
 * Wire `dbCall` so it returns canned project + project_yarn + yarn rows.
 * The existing project_yarn row is `{ yards_used: 200, skeins_used: 2 }`
 * and the parent yarn has `yards_remaining: 1000, skeins_remaining: 5`.
 */
function wireDbHappyPath(opts: {
  existingYards?: number;
  existingSkeins?: number;
  yardsRemaining?: number;
  skeinsRemaining?: number;
} = {}): void {
  const existingYards = opts.existingYards ?? 200;
  const existingSkeins = opts.existingSkeins ?? 2;
  const yardsRemaining = opts.yardsRemaining ?? 1000;
  const skeinsRemaining = opts.skeinsRemaining ?? 5;

  dbCall.mockImplementation((table: string) => {
    if (table === 'projects') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest
          .fn()
          .mockResolvedValue({ id: 'project-1', user_id: 'user-1' }),
      };
    }
    if (table === 'project_yarn') {
      return {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          project_id: 'project-1',
          yarn_id: 'yarn-1',
          yards_used: existingYards,
          skeins_used: existingSkeins,
        }),
      };
    }
    if (table === 'yarn') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'yarn-1',
          user_id: 'user-1',
          yards_remaining: yardsRemaining,
          skeins_remaining: skeinsRemaining,
          low_stock_alert: false,
        }),
      };
    }
    return { where: jest.fn().mockReturnThis() };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateProjectYarn — partial body contract', () => {
  it('rejects a request with neither yardsUsed nor skeinsUsed (400, no DB touch)', async () => {
    await expect(
      updateProjectYarn(
        makeReq({}, { id: 'project-1', yarnId: 'yarn-1' }),
        makeRes(),
      ),
    ).rejects.toThrow(ValidationError);

    // Critical: no project / yarn lookup ran. A misformed body must
    // fail loudly before any side effect.
    expect(dbCall).not.toHaveBeenCalled();
  });

  it('rejects an explicit `{ yardsUsed: null, skeinsUsed: null }` body', async () => {
    await expect(
      updateProjectYarn(
        makeReq(
          { yardsUsed: null, skeinsUsed: null },
          { id: 'project-1', yarnId: 'yarn-1' },
        ),
        makeRes(),
      ),
    ).rejects.toThrow(/At least one of yardsUsed or skeinsUsed must be provided/);
    expect(dbCall).not.toHaveBeenCalled();
  });

  it('partial update with ONLY skeinsUsed does NOT credit stash for omitted yardsUsed', async () => {
    // Existing row consumes 200 yards / 2 skeins. Caller increments
    // skeins to 4 without touching yards. Pre-fix this would have
    // computed yardsDiff = 0 - 200 = -200 and ADDED 200 yards back
    // to `yarn.yards_remaining`. Post-fix yardsDiff = 0.
    wireDbHappyPath({ existingYards: 200, existingSkeins: 2 });

    await updateProjectYarn(
      makeReq(
        { skeinsUsed: 4 },
        { id: 'project-1', yarnId: 'yarn-1' },
      ),
      makeRes(),
    );

    // The project_yarn row is rewritten with effective values: yards
    // unchanged at 200, skeins moves 2 → 4.
    expect(trxProjectYarnUpdate).toHaveBeenCalledTimes(1);
    expect(trxProjectYarnUpdate).toHaveBeenCalledWith({
      yards_used: 200,
      skeins_used: 4,
    });

    // The stash UPDATE must subtract diff(2 skeins) and zero yards.
    // The diff bindings carry into trx.raw.
    expect(trxRaw).toHaveBeenCalledWith(
      'yards_remaining - ?',
      [0],
    );
    expect(trxRaw).toHaveBeenCalledWith(
      'skeins_remaining - ?',
      [2],
    );
    // `remaining_length_m` is the meters mirror of yards. With
    // yardsDiff = 0, the meters delta must also be 0.
    expect(trxRaw).toHaveBeenCalledWith(
      'GREATEST(0, COALESCE(remaining_length_m, 0) - ?)',
      [0],
    );
  });

  it('partial update with ONLY yardsUsed does NOT credit stash for omitted skeinsUsed', async () => {
    // Mirror case: caller updates yards only, skeins must stay still.
    wireDbHappyPath({ existingYards: 200, existingSkeins: 2 });

    await updateProjectYarn(
      makeReq(
        { yardsUsed: 350 },
        { id: 'project-1', yarnId: 'yarn-1' },
      ),
      makeRes(),
    );

    expect(trxProjectYarnUpdate).toHaveBeenCalledWith({
      yards_used: 350,
      skeins_used: 2,
    });

    expect(trxRaw).toHaveBeenCalledWith(
      'yards_remaining - ?',
      [150], // 350 - 200
    );
    expect(trxRaw).toHaveBeenCalledWith(
      'skeins_remaining - ?',
      [0], // skeins unchanged
    );
  });

  it('full update with both fields still produces correct diffs', async () => {
    wireDbHappyPath({ existingYards: 200, existingSkeins: 2 });

    await updateProjectYarn(
      makeReq(
        { yardsUsed: 250, skeinsUsed: 3 },
        { id: 'project-1', yarnId: 'yarn-1' },
      ),
      makeRes(),
    );

    expect(trxProjectYarnUpdate).toHaveBeenCalledWith({
      yards_used: 250,
      skeins_used: 3,
    });
    expect(trxRaw).toHaveBeenCalledWith('yards_remaining - ?', [50]);
    expect(trxRaw).toHaveBeenCalledWith('skeins_remaining - ?', [1]);
  });

  it('decreasing both fields adds the difference back to stash (legitimate "I overestimated" case)', async () => {
    // Knitter realizes they used less than logged: 200→150 yards.
    // This is the one path where a NEGATIVE diff is correct, because
    // the user is genuinely returning unused yards to the stash.
    wireDbHappyPath({ existingYards: 200, existingSkeins: 2 });

    await updateProjectYarn(
      makeReq(
        { yardsUsed: 150, skeinsUsed: 2 },
        { id: 'project-1', yarnId: 'yarn-1' },
      ),
      makeRes(),
    );

    expect(trxRaw).toHaveBeenCalledWith('yards_remaining - ?', [-50]);
    // skeins unchanged → 0 diff (no credit)
    expect(trxRaw).toHaveBeenCalledWith('skeins_remaining - ?', [0]);
  });

  it('partial update with `yardsUsed: 0` is treated as an explicit zero, NOT a missing field', async () => {
    // The route validator uses `optional({ values: 'falsy' })` so 0
    // skips validation, but the controller must STILL apply it as an
    // explicit value (the user is saying "I used zero yards"), not as
    // "field omitted." Pre-fix this case happened to work because both
    // branches collapsed to 0; the new effective-value logic must
    // preserve it.
    wireDbHappyPath({ existingYards: 200, existingSkeins: 2 });

    await updateProjectYarn(
      makeReq(
        { yardsUsed: 0, skeinsUsed: 2 },
        { id: 'project-1', yarnId: 'yarn-1' },
      ),
      makeRes(),
    );

    // yardsDiff = 0 - 200 = -200 (returning all yards). This is the
    // correct interpretation of an explicit zero.
    expect(trxProjectYarnUpdate).toHaveBeenCalledWith({
      yards_used: 0,
      skeins_used: 2,
    });
    expect(trxRaw).toHaveBeenCalledWith('yards_remaining - ?', [-200]);
  });

  it('rejects when increasing yards beyond what stash has (insufficient-yarn guard still active)', async () => {
    // Existing 200 yards used, 100 yards remaining in stash. Caller
    // bumps to 400 → diff is 200 → exceeds stash.
    wireDbHappyPath({ existingYards: 200, yardsRemaining: 100 });

    await expect(
      updateProjectYarn(
        makeReq(
          { yardsUsed: 400 },
          { id: 'project-1', yarnId: 'yarn-1' },
        ),
        makeRes(),
      ),
    ).rejects.toThrow(/Insufficient yarn/);

    // The transaction never ran.
    expect(trxProjectYarnUpdate).not.toHaveBeenCalled();
  });
});
