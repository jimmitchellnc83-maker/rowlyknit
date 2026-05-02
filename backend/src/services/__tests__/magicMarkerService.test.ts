/**
 * Wave 5 — magicMarkerService unit tests.
 *
 * The pure-math helpers (computeDHash, hammingDistance,
 * buildChartGridPatch) are unit-tested without DB stubbing because
 * they're deterministic. The DB-touching paths (recordSample,
 * findMatches, confirmMatches) cover the ownership gates with
 * mocked db builders.
 */

const dbBuilders: any = {
  chart_alignments: {
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
  magic_marker_samples: {
    where: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue([]),
    insert: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([
        {
          id: 'sample-1',
          chart_alignment_id: 'ali-1',
          user_id: 'u-1',
          symbol: 'k',
          grid_row: 0,
          grid_col: 0,
          image_hash: 'a'.repeat(16),
          match_metadata: null,
          created_at: new Date('2026-05-02T12:00:00Z'),
        },
      ]),
    })),
  },
  charts: {
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    update: jest.fn().mockResolvedValue(1),
  },
};

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    return dbBuilders[table] ?? { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  return { default: dbFn, __esModule: true };
});

import {
  buildChartGridPatch,
  computeDHash,
  confirmMatches,
  findMatches,
  hammingDistance,
  recordSample,
} from '../magicMarkerService';
import { ValidationError } from '../../utils/errorHandler';

describe('computeDHash', () => {
  it('produces a 16-hex-char string from a 9x8 grayscale buffer', () => {
    const buf = new Uint8Array(9 * 8);
    for (let i = 0; i < buf.length; i++) buf[i] = i * 3;
    const hash = computeDHash(buf);
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('rejects buffers that are not exactly 9x8', () => {
    expect(() => computeDHash(new Uint8Array(10))).toThrow(ValidationError);
  });

  it('hashes the same buffer to the same string (deterministic)', () => {
    const buf = new Uint8Array(9 * 8).map((_, i) => i % 256);
    expect(computeDHash(buf)).toBe(computeDHash(buf));
  });
});

describe('hammingDistance', () => {
  it('returns 0 for identical hashes', () => {
    expect(hammingDistance('1234567890abcdef', '1234567890abcdef')).toBe(0);
  });

  it('counts differing bits across hex digits', () => {
    expect(hammingDistance('0', '1')).toBe(1);
    expect(hammingDistance('a', 'b')).toBe(1); // 1010 ^ 1011 = 0001 → 1 bit
    expect(hammingDistance('aa', 'ab')).toBe(1);
    expect(hammingDistance('00', 'ff')).toBe(8); // every bit flipped in second nibble
  });

  it('rejects mismatched lengths', () => {
    expect(() => hammingDistance('abc', 'abcd')).toThrow(ValidationError);
  });
});

describe('buildChartGridPatch', () => {
  it('builds a row→col→symbol map', () => {
    const patch = buildChartGridPatch('yo', [
      { row: 0, col: 1 },
      { row: 0, col: 3 },
      { row: 5, col: 7 },
    ]);
    expect(patch).toEqual({
      0: { 1: 'yo', 3: 'yo' },
      5: { 7: 'yo' },
    });
  });

  it('returns an empty patch for an empty cell list', () => {
    expect(buildChartGridPatch('k', [])).toEqual({});
  });
});

describe('recordSample', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects symbol > 32 chars', async () => {
    await expect(
      recordSample({
        chartAlignmentId: 'ali-1',
        userId: 'u-1',
        symbol: 'x'.repeat(33),
        gridRow: 0,
        gridCol: 0,
        imageHash: null,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('returns null when alignment is foreign', async () => {
    dbBuilders.chart_alignments.first.mockResolvedValueOnce(null);
    const r = await recordSample({
      chartAlignmentId: 'ali-foreign',
      userId: 'u-attacker',
      symbol: 'k',
      gridRow: 0,
      gridCol: 0,
      imageHash: null,
    });
    expect(r).toBeNull();
  });
});

describe('findMatches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns [] when alignment is foreign', async () => {
    dbBuilders.chart_alignments.first.mockResolvedValueOnce(null);
    const r = await findMatches({
      chartAlignmentId: 'ali-foreign',
      userId: 'u-attacker',
      targetHash: '1234567890abcdef',
    });
    expect(r).toEqual([]);
  });

  it('ranks candidates by Hamming distance ascending', async () => {
    dbBuilders.chart_alignments.first.mockResolvedValueOnce({ id: 'ali-1' });
    dbBuilders.magic_marker_samples.select.mockResolvedValueOnce([
      { id: 's-1', symbol: 'k', grid_row: 0, grid_col: 0, image_hash: '0000000000000000' },
      { id: 's-2', symbol: 'p', grid_row: 1, grid_col: 0, image_hash: '0000000000000001' },
      { id: 's-3', symbol: 'yo', grid_row: 2, grid_col: 0, image_hash: 'ffffffffffffffff' },
    ]);
    const r = await findMatches({
      chartAlignmentId: 'ali-1',
      userId: 'u-1',
      targetHash: '0000000000000000',
      maxDistance: 64,
    });
    expect(r[0].sampleId).toBe('s-1');
    expect(r[0].distance).toBe(0);
    expect(r[1].sampleId).toBe('s-2');
    expect(r[2].sampleId).toBe('s-3');
  });
});

describe('confirmMatches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when chart is foreign', async () => {
    dbBuilders.charts.first.mockResolvedValueOnce(null);
    const r = await confirmMatches({
      chartId: 'chart-foreign',
      userId: 'u-attacker',
      symbol: 'k',
      cells: [{ row: 0, col: 0 }],
    });
    expect(r).toBeNull();
  });

  it('returns updatedCells: 0 with no cells (no DB write)', async () => {
    const r = await confirmMatches({
      chartId: 'chart-1',
      userId: 'u-1',
      symbol: 'k',
      cells: [],
    });
    expect(r).toEqual({ updatedCells: 0 });
    expect(dbBuilders.charts.update).not.toHaveBeenCalled();
  });

  it('merges cells into existing chart grid', async () => {
    dbBuilders.charts.first.mockResolvedValueOnce({
      id: 'chart-1',
      grid: { 0: { 0: 'p' } },
    });
    const r = await confirmMatches({
      chartId: 'chart-1',
      userId: 'u-1',
      symbol: 'k',
      cells: [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ],
    });
    expect(r).toEqual({ updatedCells: 2 });
    const updateCall = dbBuilders.charts.update.mock.calls[0][0];
    const grid = JSON.parse(updateCall.grid);
    expect(grid[0]).toEqual({ 0: 'p', 1: 'k' });
    expect(grid[1]).toEqual({ 0: 'k' });
  });
});
