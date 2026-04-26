/**
 * Tests for chartService — the personal chart-library CRUD layer added
 * in Session 4 PR 1.1 of the Designer roadmap.
 *
 * Scope: validation rules + the not-found / no-op paths that don't
 * depend on building a multi-step chained-query mock. The actual
 * INSERT / UPDATE / SELECT shapes are simple Knex calls covered by
 * tsc + the controller layer's integration coverage.
 */

jest.mock('../../config/database', () => {
  // Each call to db('charts') returns a fresh builder so queue state
  // can't leak between assertions on different code paths.
  const makeBuilder = () => {
    const builder: any = {};
    [
      'where',
      'andWhere',
      'andWhereILike',
      'whereNull',
      'whereNotNull',
      'orderBy',
      'limit',
      'offset',
      'clone',
      'clearSelect',
      'clearOrder',
      'insert',
      'update',
    ].forEach((m) => {
      builder[m] = jest.fn(() => builder);
    });
    builder.delete = jest.fn().mockResolvedValue(1);
    builder.first = jest.fn();
    builder.returning = jest.fn();
    builder.count = jest.fn();
    return builder;
  };

  let nextBuilder: any = null;
  const dbFn: any = jest.fn(() => {
    const b = nextBuilder ?? makeBuilder();
    nextBuilder = null;
    return b;
  });
  dbFn.fn = { now: jest.fn(() => 'NOW()') };
  dbFn.__setNextBuilder = (b: any) => {
    nextBuilder = b;
  };
  dbFn.__makeBuilder = makeBuilder;
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import {
  archiveChart,
  createChart,
  duplicateChart,
  getChart,
  restoreChart,
  updateChart,
} from '../chartService';
import db from '../../config/database';
import { NotFoundError, ValidationError } from '../../utils/errorHandler';

const mockedDb = db as unknown as jest.Mock & {
  __makeBuilder: () => any;
  __setNextBuilder: (b: any) => void;
};

const validGrid = (width = 2, height = 2) => ({
  width,
  height,
  cells: Array.from({ length: width * height }, () => ({ symbolId: 'k', colorHex: null })),
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createChart — validation
// ---------------------------------------------------------------------------

describe('createChart validation', () => {
  it('rejects an empty name', async () => {
    await expect(
      createChart('user-1', { name: '', grid: validGrid() }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a name longer than 255 chars', async () => {
    await expect(
      createChart('user-1', { name: 'x'.repeat(256), grid: validGrid() }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a missing grid', async () => {
    await expect(
      createChart('user-1', { name: 'X', grid: undefined as any }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a grid with mismatched cell count', async () => {
    await expect(
      createChart('user-1', {
        name: 'X',
        grid: { width: 3, height: 3, cells: [] },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a grid with width > 60', async () => {
    await expect(
      createChart('user-1', {
        name: 'X',
        grid: { width: 61, height: 1, cells: [] },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a grid with non-integer dimensions', async () => {
    await expect(
      createChart('user-1', {
        name: 'X',
        grid: { width: 2.5 as any, height: 2, cells: [] },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('inserts and returns the hydrated row on valid input', async () => {
    const builder = mockedDb.__makeBuilder();
    builder.returning.mockResolvedValueOnce([
      {
        id: 'chart-1',
        user_id: 'user-1',
        name: 'My motif',
        grid: JSON.stringify(validGrid()),
        rows: 2,
        columns: 2,
        symbol_legend: '{}',
        source: 'manual',
      },
    ]);
    mockedDb.__setNextBuilder(builder);

    const out = await createChart('user-1', { name: 'My motif', grid: validGrid() });
    expect(out.id).toBe('chart-1');
    expect(out.grid.width).toBe(2);
    expect(out.symbol_legend).toEqual({});
    expect(builder.insert).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateChart — validation + not-found
// ---------------------------------------------------------------------------

describe('updateChart validation', () => {
  it('rejects an invalid grid in the update payload (validation runs first)', async () => {
    await expect(
      updateChart('chart-1', 'user-1', {
        grid: { width: 2, height: 2, cells: [{ symbolId: 'k', colorHex: null }] },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a name over 255 chars', async () => {
    await expect(
      updateChart('chart-1', 'user-1', { name: 'x'.repeat(256) }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when chart is missing', async () => {
    const builder = mockedDb.__makeBuilder();
    builder.first.mockResolvedValueOnce(undefined);
    mockedDb.__setNextBuilder(builder);

    await expect(updateChart('chart-1', 'user-1', { name: 'Renamed' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

// ---------------------------------------------------------------------------
// getChart
// ---------------------------------------------------------------------------

describe('getChart', () => {
  it('throws NotFoundError when no row matches', async () => {
    const builder = mockedDb.__makeBuilder();
    builder.first.mockResolvedValueOnce(undefined);
    mockedDb.__setNextBuilder(builder);

    await expect(getChart('chart-x', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('hydrates the JSONB grid + symbol_legend columns', async () => {
    const builder = mockedDb.__makeBuilder();
    builder.first.mockResolvedValueOnce({
      id: 'chart-1',
      user_id: 'user-1',
      name: 'M',
      grid: JSON.stringify(validGrid(3, 1)),
      rows: 1,
      columns: 3,
      symbol_legend: '{"k":"knit"}',
      source: 'manual',
    });
    mockedDb.__setNextBuilder(builder);

    const out = await getChart('chart-1', 'user-1');
    expect(out.grid.width).toBe(3);
    expect(out.grid.cells).toHaveLength(3);
    expect(out.symbol_legend).toEqual({ k: 'knit' });
  });
});

// ---------------------------------------------------------------------------
// archiveChart / restoreChart — idempotency + not-found
// ---------------------------------------------------------------------------

describe('archiveChart', () => {
  it('throws NotFoundError when the chart is missing', async () => {
    const builder = mockedDb.__makeBuilder();
    builder.first.mockResolvedValueOnce(undefined);
    mockedDb.__setNextBuilder(builder);

    await expect(archiveChart('chart-x', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('is a no-op when the chart is already archived', async () => {
    const builder = mockedDb.__makeBuilder();
    builder.first.mockResolvedValueOnce({
      id: 'chart-1',
      user_id: 'user-1',
      grid: '{}',
      symbol_legend: '{}',
      archived_at: new Date(),
    });
    mockedDb.__setNextBuilder(builder);

    const out = await archiveChart('chart-1', 'user-1');
    expect(out.id).toBe('chart-1');
    expect(builder.update).not.toHaveBeenCalled();
  });
});

describe('restoreChart', () => {
  it('is a no-op when the chart is already active', async () => {
    const builder = mockedDb.__makeBuilder();
    builder.first.mockResolvedValueOnce({
      id: 'chart-1',
      user_id: 'user-1',
      grid: '{}',
      symbol_legend: '{}',
      archived_at: null,
    });
    mockedDb.__setNextBuilder(builder);

    const out = await restoreChart('chart-1', 'user-1');
    expect(out.archived_at).toBeNull();
    expect(builder.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the chart is missing', async () => {
    const builder = mockedDb.__makeBuilder();
    builder.first.mockResolvedValueOnce(undefined);
    mockedDb.__setNextBuilder(builder);

    await expect(restoreChart('chart-x', 'user-1')).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// duplicateChart — name suffix logic
// ---------------------------------------------------------------------------

describe('duplicateChart', () => {
  it('throws NotFoundError when source is missing', async () => {
    const builder = mockedDb.__makeBuilder();
    builder.first.mockResolvedValueOnce(undefined);
    mockedDb.__setNextBuilder(builder);

    await expect(duplicateChart('chart-x', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('appends "(copy)" to the original name', async () => {
    // First db('charts') call: getChart's .first() → returns the source
    const lookupBuilder = mockedDb.__makeBuilder();
    lookupBuilder.first.mockResolvedValueOnce({
      id: 'chart-1',
      user_id: 'user-1',
      name: 'Cabled stripe',
      grid: JSON.stringify(validGrid()),
      rows: 2,
      columns: 2,
      symbol_legend: '{}',
    });

    // Second db('charts') call: insert + returning
    const insertBuilder = mockedDb.__makeBuilder();
    insertBuilder.returning.mockResolvedValueOnce([
      {
        id: 'chart-2',
        user_id: 'user-1',
        name: 'Cabled stripe (copy)',
        grid: JSON.stringify(validGrid()),
        rows: 2,
        columns: 2,
        symbol_legend: '{}',
      },
    ]);

    // Queue lookup first, then insert
    let callCount = 0;
    (mockedDb as any).mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? lookupBuilder : insertBuilder;
    });

    const out = await duplicateChart('chart-1', 'user-1');
    expect(out.name).toBe('Cabled stripe (copy)');
  });

  it('keeps "(copy)" if the source already ends in "(copy)"', async () => {
    const lookupBuilder = mockedDb.__makeBuilder();
    lookupBuilder.first.mockResolvedValueOnce({
      id: 'chart-1',
      user_id: 'user-1',
      name: 'Cabled stripe (copy)',
      grid: JSON.stringify(validGrid()),
      rows: 2,
      columns: 2,
      symbol_legend: '{}',
    });
    const insertBuilder = mockedDb.__makeBuilder();
    insertBuilder.returning.mockResolvedValueOnce([
      {
        id: 'chart-3',
        user_id: 'user-1',
        name: 'Cabled stripe (copy)',
        grid: JSON.stringify(validGrid()),
        rows: 2,
        columns: 2,
        symbol_legend: '{}',
      },
    ]);
    let callCount = 0;
    (mockedDb as any).mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? lookupBuilder : insertBuilder;
    });

    const out = await duplicateChart('chart-1', 'user-1');
    expect(out.name).toBe('Cabled stripe (copy)');
  });
});
