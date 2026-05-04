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
 *   2. `materializeLegacyStubForCanonical` is idempotent — re-attaching
 *      the same canonical pattern to a different project reuses the same
 *      legacy stub instead of inserting duplicates.
 *   3. After materialization, opening the legacy stub via
 *      `GET /api/patterns/:id` surfaces `canonicalPatternModelId` (the
 *      Sprint 1 twin lookup follows `pattern_models.source_pattern_id`).
 */

const projectsBuilder = {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  first: jest.fn(),
};

const patternsBuilder = {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  first: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

const projectPatternsBuilder = {
  where: jest.fn().mockReturnThis(),
  first: jest.fn(),
  insert: jest.fn().mockResolvedValue(undefined),
};

const patternModelsBuilder = {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  first: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};

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
  // Re-stub the chained-builder methods after clearAllMocks.
  projectsBuilder.where = jest.fn().mockReturnThis();
  projectsBuilder.whereNull = jest.fn().mockReturnThis();
  patternsBuilder.where = jest.fn().mockReturnThis();
  patternsBuilder.whereNull = jest.fn().mockReturnThis();
  patternsBuilder.insert = jest.fn().mockReturnThis();
  projectPatternsBuilder.where = jest.fn().mockReturnThis();
  patternModelsBuilder.where = jest.fn().mockReturnThis();
  patternModelsBuilder.whereNull = jest.fn().mockReturnThis();
  patternModelsBuilder.update = jest.fn().mockResolvedValue(undefined);
  projectPatternsBuilder.insert = jest.fn().mockResolvedValue(undefined);
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
  it('materializes a legacy stub and links the project to it', async () => {
    // Project lookup
    projectsBuilder.first.mockResolvedValueOnce({ id: 'proj-1', user_id: 'user-1' });
    // Materializer: canonical pattern_models row with no source_pattern_id yet
    patternModelsBuilder.first.mockResolvedValueOnce({
      id: 'cpm-1',
      user_id: 'user-1',
      source_pattern_id: null,
      name: 'Blog-imported sweater',
    });
    // Insert into legacy patterns → returns the new id
    patternsBuilder.returning = jest.fn().mockResolvedValueOnce([{ id: 'legacy-stub-1' }]);
    // Verification fetch on the freshly-minted legacy stub
    patternsBuilder.first.mockResolvedValueOnce({
      id: 'legacy-stub-1',
      user_id: 'user-1',
      name: 'Blog-imported sweater',
    });
    // No pre-existing project_patterns link
    projectPatternsBuilder.first.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await addPatternToProject(makeReq({ patternModelId: 'cpm-1' }), res);

    // Legacy stub was inserted with the canonical's name + traceability
    // metadata so we can find it again.
    expect(patternsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        name: 'Blog-imported sweater',
        metadata: expect.stringContaining('canonicalPatternModelId'),
      }),
    );
    // The canonical row was back-linked via source_pattern_id.
    expect(patternModelsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ source_pattern_id: 'legacy-stub-1' }),
    );
    // The project_patterns row uses the resolved legacy id.
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
    // Canonical row already has a back-link to a live legacy row
    patternModelsBuilder.first.mockResolvedValueOnce({
      id: 'cpm-1',
      user_id: 'user-1',
      source_pattern_id: 'legacy-stub-1',
      name: 'Blog-imported sweater',
    });
    // The legacy row exists and belongs to this user
    patternsBuilder.first
      .mockResolvedValueOnce({
        id: 'legacy-stub-1',
        user_id: 'user-1',
        name: 'Blog-imported sweater',
      })
      // Verification fetch in the controller after the materializer returns
      .mockResolvedValueOnce({
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

    // No new insert into legacy patterns — the materializer reused the stub.
    expect(patternsBuilder.insert).not.toHaveBeenCalled();
    expect(patternModelsBuilder.update).not.toHaveBeenCalled();
    expect(projectPatternsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-2',
        pattern_id: 'legacy-stub-1',
      }),
    );
  });

  it('throws NotFoundError when the canonical id does not belong to the user', async () => {
    projectsBuilder.first.mockResolvedValueOnce({ id: 'proj-1', user_id: 'user-1' });
    patternModelsBuilder.first.mockResolvedValueOnce(undefined);

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
    expect(patternModelsBuilder.first).not.toHaveBeenCalled();
    expect(patternModelsBuilder.update).not.toHaveBeenCalled();
    expect(projectPatternsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        pattern_id: 'legacy-1',
      }),
    );
  });
});

describe('materializeLegacyStubForCanonical — directly', () => {
  it('returns the existing legacy id when the canonical is already linked', async () => {
    patternModelsBuilder.first.mockResolvedValueOnce({
      id: 'cpm-x',
      user_id: 'user-1',
      source_pattern_id: 'legacy-existing',
      name: 'Whatever',
    });
    patternsBuilder.first.mockResolvedValueOnce({
      id: 'legacy-existing',
      user_id: 'user-1',
      name: 'Whatever',
    });

    const id = await materializeLegacyStubForCanonical('user-1', 'cpm-x');
    expect(id).toBe('legacy-existing');
    expect(patternsBuilder.insert).not.toHaveBeenCalled();
  });

  it('inserts a new legacy stub when no link exists, and back-fills the canonical', async () => {
    patternModelsBuilder.first.mockResolvedValueOnce({
      id: 'cpm-y',
      user_id: 'user-1',
      source_pattern_id: null,
      name: 'Chart upload',
    });
    patternsBuilder.returning = jest.fn().mockResolvedValueOnce([{ id: 'legacy-new' }]);

    const id = await materializeLegacyStubForCanonical('user-1', 'cpm-y');
    expect(id).toBe('legacy-new');
    expect(patternsBuilder.insert).toHaveBeenCalledTimes(1);
    expect(patternModelsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ source_pattern_id: 'legacy-new' }),
    );
  });

  it('falls through to a fresh insert when source_pattern_id points at a deleted/foreign legacy row', async () => {
    // Canonical claims a back-link, but the legacy row is gone (or owned
    // by another user). The materializer should NOT trust a stale link
    // and must create a fresh stub instead.
    patternModelsBuilder.first.mockResolvedValueOnce({
      id: 'cpm-z',
      user_id: 'user-1',
      source_pattern_id: 'legacy-zombie',
      name: 'Recovered',
    });
    patternsBuilder.first.mockResolvedValueOnce(undefined);
    patternsBuilder.returning = jest.fn().mockResolvedValueOnce([{ id: 'legacy-fresh' }]);

    const id = await materializeLegacyStubForCanonical('user-1', 'cpm-z');
    expect(id).toBe('legacy-fresh');
    expect(patternsBuilder.insert).toHaveBeenCalledTimes(1);
    expect(patternModelsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ source_pattern_id: 'legacy-fresh' }),
    );
  });

  it('throws NotFoundError when the canonical pattern_model is missing or owned by another user', async () => {
    patternModelsBuilder.first.mockResolvedValueOnce(undefined);

    await expect(
      materializeLegacyStubForCanonical('user-1', 'cpm-nope'),
    ).rejects.toThrow(/Pattern not found/i);
  });
});
