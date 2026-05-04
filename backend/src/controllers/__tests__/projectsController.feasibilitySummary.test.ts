/**
 * Sprint 2 — finding #4: feasibility-summary multi-pattern aware.
 *
 * The original implementation collapsed each project's pattern list to the
 * FIRST attached pattern (`firstPattern` Map) and silently dropped the
 * rest. After this change, every (project, pattern) pair flows through to
 * `summaries`, and a per-project `aggregates` row carries the worst-of
 * verdict for the badge UI. These tests pin both behaviors so the seam
 * doesn't quietly regress.
 */

import {
  aggregateFeasibilityByProject,
  getProjectsFeasibilitySummary,
} from '../projectsController';

// `aggregateFeasibilityByProject` is pure — exercise it directly without
// touching the DB. The controller-level test below mocks db + the batch
// service to assert the response shape end-to-end.

describe('aggregateFeasibilityByProject', () => {
  it('reduces multiple patterns per project to one aggregate row, worst-of', () => {
    const out = aggregateFeasibilityByProject([
      { projectId: 'A', patternId: 'p1', overallStatus: 'green' },
      { projectId: 'A', patternId: 'p2', overallStatus: 'red' },
      { projectId: 'A', patternId: 'p3', overallStatus: 'yellow' },
      { projectId: 'B', patternId: 'p4', overallStatus: 'yellow' },
    ]);

    expect(out).toHaveLength(2);
    const a = out.find((x) => x.projectId === 'A')!;
    expect(a.overallStatus).toBe('red');
    expect(a.patternIds).toEqual(['p1', 'p2', 'p3']);

    const b = out.find((x) => x.projectId === 'B')!;
    expect(b.overallStatus).toBe('yellow');
    expect(b.patternIds).toEqual(['p4']);
  });

  it('returns green when every pattern is green', () => {
    const out = aggregateFeasibilityByProject([
      { projectId: 'A', patternId: 'p1', overallStatus: 'green' },
      { projectId: 'A', patternId: 'p2', overallStatus: 'green' },
    ]);
    expect(out[0].overallStatus).toBe('green');
  });

  it('returns yellow when no red is present and at least one yellow is', () => {
    const out = aggregateFeasibilityByProject([
      { projectId: 'A', patternId: 'p1', overallStatus: 'green' },
      { projectId: 'A', patternId: 'p2', overallStatus: 'yellow' },
    ]);
    expect(out[0].overallStatus).toBe('yellow');
  });

  it('returns no aggregate rows when summaries is empty', () => {
    expect(aggregateFeasibilityByProject([])).toEqual([]);
  });

  it('deduplicates duplicate patternIds within a project (defensive)', () => {
    // Shouldn't happen in practice (project_patterns unique on
    // (project_id, pattern_id)) but the helper is robust.
    const out = aggregateFeasibilityByProject([
      { projectId: 'A', patternId: 'p1', overallStatus: 'green' },
      { projectId: 'A', patternId: 'p1', overallStatus: 'red' },
    ]);
    expect(out[0].patternIds).toEqual(['p1']);
    expect(out[0].overallStatus).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// Controller-level: full response shape from getProjectsFeasibilitySummary
// ---------------------------------------------------------------------------

const projectIdsPluck = jest.fn();
const projectPatternsSelect = jest.fn();
const getFeasibilityBatchMock = jest.fn();

jest.mock('../../config/database', () => {
  const builder = (table: string) => {
    if (table === 'projects') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        pluck: projectIdsPluck,
      };
    }
    if (table === 'project_patterns') {
      return {
        whereIn: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        select: projectPatternsSelect,
      };
    }
    return {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      select: jest.fn().mockResolvedValue([]),
    };
  };
  const dbFn: any = jest.fn(builder);
  return { default: dbFn, __esModule: true };
});

jest.mock('../../services/feasibilityService', () => ({
  __esModule: true,
  getFeasibilityBatch: (...args: unknown[]) => getFeasibilityBatchMock(...args),
}));

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/needleInventoryService', () => ({
  checkNeedleInventory: jest.fn().mockReturnValue({ status: 'green', missingSizesMm: [] }),
}));

jest.mock('../../services/projectDuplicationService', () => ({
  duplicateProject: jest.fn(),
}));

jest.mock('../../services/patternService', () => ({
  materializeLegacyStubForCanonical: jest.fn(),
}));

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('getProjectsFeasibilitySummary — multi-pattern shape', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns one summary per attached pattern AND one aggregate per project', async () => {
    projectIdsPluck.mockResolvedValueOnce(['proj-A', 'proj-B']);
    // Two patterns on A, one on B.
    projectPatternsSelect.mockResolvedValueOnce([
      { project_id: 'proj-A', pattern_id: 'pat-1' },
      { project_id: 'proj-A', pattern_id: 'pat-2' },
      { project_id: 'proj-B', pattern_id: 'pat-3' },
    ]);
    // The batch service returns a verdict per pair.
    getFeasibilityBatchMock.mockResolvedValueOnce([
      { projectId: 'proj-A', patternId: 'pat-1', overallStatus: 'green' },
      { projectId: 'proj-A', patternId: 'pat-2', overallStatus: 'red' },
      { projectId: 'proj-B', patternId: 'pat-3', overallStatus: 'yellow' },
    ]);

    const res = makeRes();
    await getProjectsFeasibilitySummary(
      { user: { userId: 'user-1' } } as any,
      res,
    );

    expect(getFeasibilityBatchMock).toHaveBeenCalledWith(
      'user-1',
      [
        { projectId: 'proj-A', patternId: 'pat-1' },
        { projectId: 'proj-A', patternId: 'pat-2' },
        { projectId: 'proj-B', patternId: 'pat-3' },
      ],
    );

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    // Summaries: lossless per-pattern detail.
    expect(payload.data.summaries).toHaveLength(3);
    // Aggregates: worst-of per project.
    const aggA = payload.data.aggregates.find((a: any) => a.projectId === 'proj-A');
    const aggB = payload.data.aggregates.find((a: any) => a.projectId === 'proj-B');
    expect(aggA.overallStatus).toBe('red');
    expect(aggA.patternIds).toEqual(['pat-1', 'pat-2']);
    expect(aggB.overallStatus).toBe('yellow');
    expect(aggB.patternIds).toEqual(['pat-3']);
  });

  it('returns empty arrays when the user has no projects', async () => {
    projectIdsPluck.mockResolvedValueOnce([]);

    const res = makeRes();
    await getProjectsFeasibilitySummary(
      { user: { userId: 'user-1' } } as any,
      res,
    );

    const payload = res.json.mock.calls[0][0];
    expect(payload.data.summaries).toEqual([]);
    expect(payload.data.aggregates).toEqual([]);
    expect(getFeasibilityBatchMock).not.toHaveBeenCalled();
  });

  it('does NOT collapse to the first pattern (regression for finding #4)', async () => {
    projectIdsPluck.mockResolvedValueOnce(['proj-X']);
    projectPatternsSelect.mockResolvedValueOnce([
      { project_id: 'proj-X', pattern_id: 'pat-first' },
      { project_id: 'proj-X', pattern_id: 'pat-second' },
      { project_id: 'proj-X', pattern_id: 'pat-third' },
    ]);
    getFeasibilityBatchMock.mockResolvedValueOnce([
      { projectId: 'proj-X', patternId: 'pat-first', overallStatus: 'green' },
      { projectId: 'proj-X', patternId: 'pat-second', overallStatus: 'green' },
      { projectId: 'proj-X', patternId: 'pat-third', overallStatus: 'red' },
    ]);

    const res = makeRes();
    await getProjectsFeasibilitySummary(
      { user: { userId: 'user-1' } } as any,
      res,
    );

    // The crux of the seam fix: a red verdict on a non-first pattern still
    // surfaces in the aggregate. Before this change the controller would
    // have silently kept only `pat-first` (green) and the project would
    // have rendered as ready when in fact it isn't.
    const agg = res.json.mock.calls[0][0].data.aggregates[0];
    expect(agg.overallStatus).toBe('red');
    expect(agg.patternIds).toHaveLength(3);
  });
});
