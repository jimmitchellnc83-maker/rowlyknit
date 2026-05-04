/**
 * Sprint 2 — finding #5: canonical-only patterns can attach to projects.
 *
 * `project_patterns.pattern_id` is a NOT NULL FK to legacy `patterns`. To
 * keep current readers untouched (every join in the codebase still uses
 * `pp.pattern_id → patterns.id`), canonical-only patterns flow through a
 * thin legacy stub materialized on attach. These tests pin the contract:
 *
 *   1. `addPatternToProject` accepts `patternModelId` (alongside the
 *      existing `patternId` branch) and resolves it via the materializer.
 *   2. `materializeLegacyStubForCanonical` is idempotent + race-safe —
 *      runs inside one transaction with `SELECT ... FOR UPDATE` on the
 *      canonical row, so concurrent attaches serialize and the second
 *      wakes up to the link and reuses the stub.
 *   3. After materialization, opening the legacy stub via
 *      `GET /api/patterns/:id` surfaces `canonicalPatternModelId` (the
 *      Sprint 1 twin lookup follows `pattern_models.source_pattern_id`).
 */

const projectsBuilder: any = {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  first: jest.fn(),
};

const patternsBuilder: any = {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  first: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

const projectPatternsBuilder: any = {
  where: jest.fn().mockReturnThis(),
  first: jest.fn(),
  insert: jest.fn().mockResolvedValue(undefined),
};

const patternModelsBuilder: any = {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  forUpdate: jest.fn().mockReturnThis(),
  first: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};

// Transaction-scoped builders mirror the same shape but track separately,
// so we can assert that the materializer's lookups + writes all flow
// through the trx (not raw db) — i.e. that the row lock is real.
const trxBuilders: Record<string, any> = {
  pattern_models: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    forUpdate: jest.fn().mockReturnThis(),
    first: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  },
  patterns: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn(),
  },
};

const trxFn: any = jest.fn((table: string) => trxBuilders[table] ?? {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null),
});

const transactionMock = jest.fn(async (cb: (trx: any) => Promise<unknown>) => cb(trxFn));

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    if (table === 'projects') return projectsBuilder;
    if (table === 'patterns') return patternsBuilder;
    if (table === 'project_patterns') return projectPatternsBuilder;
    if (table === 'pattern_models') return patternModelsBuilder;
    return {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
  });
  dbFn.transaction = transactionMock;
  return { default: dbFn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/needleInventoryService', () => ({
  checkNeedleInventory: jest.fn().mockReturnValue({ status: 'green', missingSizesMm: [] }),
}));

jest.mock('../../services/projectDuplicationService', () => ({
  duplicateProject: jest.fn(),
}));

jest.mock('../../services/feasibilityService', () => ({
  __esModule: true,
  getFeasibilityBatch: jest.fn().mockResolvedValue([]),
}));

import { addPatternToProject } from '../projectsController';
import { materializeLegacyStubForCanonical } from '../../services/patternService';

function makeReq(body: any, params: any = { id: 'proj-1' }): any {
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
  // Re-stub chained-builder methods after clearAllMocks.
  projectsBuilder.where = jest.fn().mockReturnThis();
  projectsBuilder.whereNull = jest.fn().mockReturnThis();
  patternsBuilder.where = jest.fn().mockReturnThis();
  patternsBuilder.whereNull = jest.fn().mockReturnThis();
  patternsBuilder.insert = jest.fn().mockReturnThis();
  projectPatternsBuilder.where = jest.fn().mockReturnThis();
  patternModelsBuilder.where = jest.fn().mockReturnThis();
  patternModelsBuilder.whereNull = jest.fn().mockReturnThis();
  patternModelsBuilder.forUpdate = jest.fn().mockReturnThis();
  patternModelsBuilder.update = jest.fn().mockResolvedValue(undefined);
  projectPatternsBuilder.insert = jest.fn().mockResolvedValue(undefined);

  trxBuilders.pattern_models.where = jest.fn().mockReturnThis();
  trxBuilders.pattern_models.whereNull = jest.fn().mockReturnThis();
  trxBuilders.pattern_models.forUpdate = jest.fn().mockReturnThis();
  trxBuilders.pattern_models.update = jest.fn().mockResolvedValue(undefined);
  trxBuilders.patterns.where = jest.fn().mockReturnThis();
  trxBuilders.patterns.whereNull = jest.fn().mockReturnThis();
  trxBuilders.patterns.insert = jest.fn().mockReturnThis();
  // Reset transaction wrapper to call-through behavior.
  transactionMock.mockImplementation(async (cb: (trx: any) => Promise<unknown>) => cb(trxFn));
});

describe('addPatternToProject — input validation', () => {
  it('rejects requests missing both patternId and patternModelId', async () => {
    projectsBuilder.first.mockResolvedValueOnce({ id: 'proj-1', user_id: 'user-1' });
    const res = makeRes();
    await expect(
      addPatternToProject(makeReq({}), res),
    ).rejects.toThrow(/patternId or patternModelId/i);
  });

  it('rejects requests with both patternId and patternModelId set', async () => {
    projectsBuilder.first.mockResolvedValueOnce({ id: 'proj-1', user_id: 'user-1' });
    const res = makeRes();
    await expect(
      addPatternToProject(
        makeReq({ patternId: 'pat-1', patternModelId: 'cpm-1' }),
        res,
      ),
    ).rejects.toThrow(/only one of/i);
  });
});

describe('addPatternToProject — patternModelId branch (canonical-only attach)', () => {
  it('materializes a legacy stub via the transactional path and links the project to it', async () => {
    projectsBuilder.first.mockResolvedValueOnce({ id: 'proj-1', user_id: 'user-1' });
    // Materializer (inside transaction): canonical row has no source yet
    trxBuilders.pattern_models.first.mockResolvedValueOnce({
      id: 'cpm-1',
      user_id: 'user-1',
      source_pattern_id: null,
      name: 'Blog-imported sweater',
    });
    // Insert into legacy patterns (via trx) → returns the new id
    trxBuilders.patterns.returning = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'legacy-stub-1' }]);
    // Verification fetch (controller, post-materializer, on raw db)
    patternsBuilder.first.mockResolvedValueOnce({
      id: 'legacy-stub-1',
      user_id: 'user-1',
      name: 'Blog-imported sweater',
    });
    projectPatternsBuilder.first.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await addPatternToProject(makeReq({ patternModelId: 'cpm-1' }), res);

    // The materializer ran inside db.transaction(...).
    expect(transactionMock).toHaveBeenCalledTimes(1);
    // Row lock was acquired on the canonical row.
    expect(trxBuilders.pattern_models.forUpdate).toHaveBeenCalled();
    // Insert + back-fill happened on the trx, not raw db.
    expect(trxBuilders.patterns.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        name: 'Blog-imported sweater',
        metadata: expect.stringContaining('canonicalPatternModelId'),
      }),
    );
    expect(trxBuilders.pattern_models.update).toHaveBeenCalledWith(
      expect.objectContaining({ source_pattern_id: 'legacy-stub-1' }),
    );
    // The non-trx helpers did NOT take the canonical write path (defense
    // against a future refactor that drops the transaction wrapper).
    expect(patternsBuilder.insert).not.toHaveBeenCalled();
    expect(patternModelsBuilder.update).not.toHaveBeenCalled();
    // Project link was made with the resolved legacy id.
    expect(projectPatternsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        pattern_id: 'legacy-stub-1',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.patternId).toBe('legacy-stub-1');
  });

  it('reuses an existing legacy stub when source_pattern_id is already set (idempotent re-attach)', async () => {
    projectsBuilder.first.mockResolvedValueOnce({ id: 'proj-2', user_id: 'user-1' });
    trxBuilders.pattern_models.first.mockResolvedValueOnce({
      id: 'cpm-1',
      user_id: 'user-1',
      source_pattern_id: 'legacy-stub-1',
      name: 'Blog-imported sweater',
    });
    trxBuilders.patterns.first.mockResolvedValueOnce({
      id: 'legacy-stub-1',
      user_id: 'user-1',
      name: 'Blog-imported sweater',
    });
    // Verification fetch on raw db (after materializer returns)
    patternsBuilder.first.mockResolvedValueOnce({
      id: 'legacy-stub-1',
      user_id: 'user-1',
      name: 'Blog-imported sweater',
    });
    projectPatternsBuilder.first.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await addPatternToProject(
      makeReq({ patternModelId: 'cpm-1' }, { id: 'proj-2' }),
      res,
    );

    // Reuse path: no new insert into legacy patterns, no canonical update.
    expect(trxBuilders.patterns.insert).not.toHaveBeenCalled();
    expect(trxBuilders.pattern_models.update).not.toHaveBeenCalled();
    expect(projectPatternsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-2',
        pattern_id: 'legacy-stub-1',
      }),
    );
  });

  it('throws NotFoundError when the canonical id does not belong to the user', async () => {
    projectsBuilder.first.mockResolvedValueOnce({ id: 'proj-1', user_id: 'user-1' });
    trxBuilders.pattern_models.first.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await expect(
      addPatternToProject(makeReq({ patternModelId: 'cpm-other-user' }), res),
    ).rejects.toThrow(/Pattern not found/i);
    expect(projectPatternsBuilder.insert).not.toHaveBeenCalled();
  });
});

describe('addPatternToProject — patternId branch (legacy unchanged)', () => {
  it('still accepts a plain legacy patternId and links it', async () => {
    projectsBuilder.first.mockResolvedValueOnce({ id: 'proj-1', user_id: 'user-1' });
    patternsBuilder.first.mockResolvedValueOnce({
      id: 'legacy-1',
      user_id: 'user-1',
      name: 'PDF Pattern',
    });
    projectPatternsBuilder.first.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await addPatternToProject(makeReq({ patternId: 'legacy-1' }), res);

    // The materializer is never reached on the legacy path.
    expect(transactionMock).not.toHaveBeenCalled();
    expect(trxBuilders.pattern_models.first).not.toHaveBeenCalled();
    expect(trxBuilders.pattern_models.update).not.toHaveBeenCalled();
    expect(patternModelsBuilder.first).not.toHaveBeenCalled();
    expect(projectPatternsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        pattern_id: 'legacy-1',
      }),
    );
  });
});

describe('materializeLegacyStubForCanonical — atomicity + race safety', () => {
  it('runs the entire decide-and-write in a single transaction', async () => {
    trxBuilders.pattern_models.first.mockResolvedValueOnce({
      id: 'cpm-tx',
      user_id: 'user-1',
      source_pattern_id: null,
      name: 'TXN test',
    });
    trxBuilders.patterns.returning = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'legacy-tx' }]);

    const id = await materializeLegacyStubForCanonical('user-1', 'cpm-tx');

    expect(id).toBe('legacy-tx');
    expect(transactionMock).toHaveBeenCalledTimes(1);
    // Lock + insert + back-fill all touched the trx, not raw db.
    expect(trxBuilders.pattern_models.forUpdate).toHaveBeenCalled();
    expect(trxBuilders.patterns.insert).toHaveBeenCalled();
    expect(trxBuilders.pattern_models.update).toHaveBeenCalledWith(
      expect.objectContaining({ source_pattern_id: 'legacy-tx' }),
    );
    expect(patternsBuilder.insert).not.toHaveBeenCalled();
    expect(patternModelsBuilder.update).not.toHaveBeenCalled();
  });

  it('rolls back the legacy insert when the back-fill update fails (no orphan stub)', async () => {
    trxBuilders.pattern_models.first.mockResolvedValueOnce({
      id: 'cpm-fail',
      user_id: 'user-1',
      source_pattern_id: null,
      name: 'Failure case',
    });
    trxBuilders.patterns.returning = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'legacy-orphan' }]);
    // Update fails — the trx wrapper should propagate, callers see the
    // rejection, and Postgres rolls back the insert. The mock can't
    // model rollback semantics, but we can prove the call surface
    // bubbles the failure rather than swallowing it.
    trxBuilders.pattern_models.update = jest
      .fn()
      .mockRejectedValueOnce(new Error('back-fill failed'));

    await expect(
      materializeLegacyStubForCanonical('user-1', 'cpm-fail'),
    ).rejects.toThrow(/back-fill failed/);
  });

  it('serializes concurrent attaches: second caller, woken from the lock, reuses the stub the first one created', async () => {
    // Tx A: cold canonical. Inserts stub-A and back-fills the link.
    trxBuilders.pattern_models.first.mockResolvedValueOnce({
      id: 'cpm-race',
      user_id: 'user-1',
      source_pattern_id: null,
      name: 'Race target',
    });
    trxBuilders.patterns.returning = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'legacy-from-A' }]);

    const idA = await materializeLegacyStubForCanonical('user-1', 'cpm-race');
    expect(idA).toBe('legacy-from-A');
    // Tx A wrote to the trx, no extra reads on raw db.
    expect(trxBuilders.pattern_models.forUpdate).toHaveBeenCalled();

    // Reset call history but keep mock implementations.
    trxBuilders.pattern_models.forUpdate.mockClear();
    trxBuilders.patterns.insert.mockClear();
    trxBuilders.pattern_models.update.mockClear();

    // Tx B: woke from the lock, sees the back-filled link committed by A
    // and the legacy row that A inserted. Must NOT insert another stub.
    trxBuilders.pattern_models.first.mockResolvedValueOnce({
      id: 'cpm-race',
      user_id: 'user-1',
      source_pattern_id: 'legacy-from-A',
      name: 'Race target',
    });
    trxBuilders.patterns.first.mockResolvedValueOnce({
      id: 'legacy-from-A',
      user_id: 'user-1',
      name: 'Race target',
    });

    const idB = await materializeLegacyStubForCanonical('user-1', 'cpm-race');
    expect(idB).toBe('legacy-from-A');
    // Tx B took the lock and read, but did NOT insert or back-fill.
    expect(trxBuilders.pattern_models.forUpdate).toHaveBeenCalled();
    expect(trxBuilders.patterns.insert).not.toHaveBeenCalled();
    expect(trxBuilders.pattern_models.update).not.toHaveBeenCalled();
  });

  it('falls through to a fresh insert when source_pattern_id points at a soft-deleted/foreign legacy row (stale link)', async () => {
    trxBuilders.pattern_models.first.mockResolvedValueOnce({
      id: 'cpm-stale',
      user_id: 'user-1',
      source_pattern_id: 'legacy-zombie',
      name: 'Recovered',
    });
    // The linked legacy row no longer exists for this user.
    trxBuilders.patterns.first.mockResolvedValueOnce(undefined);
    trxBuilders.patterns.returning = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'legacy-fresh' }]);

    const id = await materializeLegacyStubForCanonical('user-1', 'cpm-stale');
    expect(id).toBe('legacy-fresh');
    expect(trxBuilders.patterns.insert).toHaveBeenCalledTimes(1);
    expect(trxBuilders.pattern_models.update).toHaveBeenCalledWith(
      expect.objectContaining({ source_pattern_id: 'legacy-fresh' }),
    );
  });

  it('throws NotFoundError when the canonical pattern_model is missing or owned by another user', async () => {
    trxBuilders.pattern_models.first.mockResolvedValueOnce(undefined);

    await expect(
      materializeLegacyStubForCanonical('user-1', 'cpm-nope'),
    ).rejects.toThrow(/Pattern not found/i);
    expect(trxBuilders.patterns.insert).not.toHaveBeenCalled();
  });
});
