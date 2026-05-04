/**
 * Backend test for canonical-twin surfacing on `GET /api/patterns/:id`
 * (Sprint 1, post-PR #370–#373 audit, finding #1).
 *
 * The Pattern Detail page renders an "Open in Make Mode" entry button
 * for any legacy pattern that has a canonical `pattern_models` twin.
 * The twin lookup happens server-side; the response payload carries
 * `canonicalPatternModelId: string | null`. This test pins both the
 * positive and negative branches so the entry button never points at
 * a non-existent twin id.
 */

const dbBuilders: any = {
  patterns: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
  project_patterns: {
    join: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue([]),
  },
  pattern_models: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
};

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    const key = table.split(' as ')[0];
    return (
      dbBuilders[key] ?? {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        select: jest.fn().mockResolvedValue([]),
      }
    );
  });
  return { default: dbFn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

jest.mock('../../services/patternComplexityService', () => ({
  calculatePatternComplexity: () => null,
}));

jest.mock('../../services/ratingsService', () => ({
  countMakersForPattern: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../services/patternService', () => ({
  importDesignerSnapshot: jest.fn(),
}));

import { getPattern } from '../patternsController';

function makeReq(): any {
  return { params: { id: 'legacy-1' }, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('getPattern — canonicalPatternModelId surface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-stub `where`/`whereNull`/`select` on each builder to return
    // the builder again — `jest.clearAllMocks` resets the mockReturnThis
    // implementation we set at module-load.
    dbBuilders.patterns.where = jest.fn().mockReturnThis();
    dbBuilders.patterns.whereNull = jest.fn().mockReturnThis();
    dbBuilders.project_patterns.join = jest.fn().mockReturnThis();
    dbBuilders.project_patterns.where = jest.fn().mockReturnThis();
    dbBuilders.project_patterns.whereNull = jest.fn().mockReturnThis();
    dbBuilders.project_patterns.select = jest.fn().mockResolvedValue([]);
    dbBuilders.pattern_models.where = jest.fn().mockReturnThis();
    dbBuilders.pattern_models.whereNull = jest.fn().mockReturnThis();
    dbBuilders.pattern_models.select = jest.fn().mockReturnThis();
  });

  it('returns canonicalPatternModelId = <twin id> when a canonical twin exists', async () => {
    dbBuilders.patterns.first.mockResolvedValueOnce({
      id: 'legacy-1',
      user_id: 'user-1',
      name: 'Legacy Pattern',
      tags: null,
    });
    dbBuilders.pattern_models.first.mockResolvedValueOnce({ id: 'twin-uuid-1' });

    const res = makeRes();
    await getPattern(makeReq(), res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.pattern.canonicalPatternModelId).toBe('twin-uuid-1');
  });

  it('returns canonicalPatternModelId = null when no twin exists (legacy-only pattern)', async () => {
    dbBuilders.patterns.first.mockResolvedValueOnce({
      id: 'legacy-1',
      user_id: 'user-1',
      name: 'Legacy-only Pattern',
      tags: null,
    });
    dbBuilders.pattern_models.first.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await getPattern(makeReq(), res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.pattern.canonicalPatternModelId).toBeNull();
  });

  it('scopes the twin lookup to user_id (defense against cross-user id leaks)', async () => {
    dbBuilders.patterns.first.mockResolvedValueOnce({
      id: 'legacy-1',
      user_id: 'user-1',
      name: 'Legacy Pattern',
      tags: null,
    });
    dbBuilders.pattern_models.first.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await getPattern(makeReq(), res);

    // The first .where on pattern_models must include user_id scoping.
    expect(dbBuilders.pattern_models.where).toHaveBeenCalledWith({
      source_pattern_id: 'legacy-1',
      user_id: 'user-1',
    });
  });
});
