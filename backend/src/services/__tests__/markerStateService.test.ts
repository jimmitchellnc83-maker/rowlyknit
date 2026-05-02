/**
 * Wave 4 — markerStateService unit tests.
 *
 * Locks in:
 *   - recordPosition is best-effort: a DB error never throws upward.
 *   - Initial recordPosition inserts marker_states; second record updates it.
 *   - History row appended on every record.
 *   - getHistory + rewindTo refuse foreign projects (return [] / null).
 */

const dbBuilders: any = {
  marker_states: {
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([{ id: 'state-new' }]),
    })),
    update: jest.fn().mockResolvedValue(1),
  },
  marker_state_history: {
    where: jest.fn().mockReturnThis(),
    insert: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([
        {
          id: 'h-new',
          marker_state_id: 'state-new',
          project_id: 'p-1',
          user_id: 'u-1',
          previous_position: null,
          new_position: '{"currentValue":5}',
          created_at: new Date('2026-05-02T12:00:00Z'),
        },
      ]),
    })),
  },
  projects: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
};

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    return (
      dbBuilders[table] ?? {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      }
    );
  });
  // db.raw used for ring-buffer prune.
  dbFn.raw = jest.fn().mockResolvedValue([]);
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import {
  getHistory,
  recordPosition,
  rewindTo,
} from '../markerStateService';

describe('recordPosition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts a new marker_states row when nothing exists', async () => {
    dbBuilders.marker_states.first.mockResolvedValueOnce(null);
    await recordPosition({
      projectId: 'p-1',
      surface: 'counter',
      surfaceRef: 'counter-1',
      position: { currentValue: 5 },
      userId: 'u-1',
    });
    expect(dbBuilders.marker_states.insert).toHaveBeenCalled();
    expect(dbBuilders.marker_state_history.insert).toHaveBeenCalled();
  });

  it('updates the existing marker_states row when one exists', async () => {
    dbBuilders.marker_states.first.mockResolvedValueOnce({
      id: 'state-existing',
      position: '{"currentValue":3}',
    });
    await recordPosition({
      projectId: 'p-1',
      surface: 'counter',
      surfaceRef: 'counter-1',
      position: { currentValue: 4 },
      userId: 'u-1',
    });
    expect(dbBuilders.marker_states.insert).not.toHaveBeenCalled();
    expect(dbBuilders.marker_states.update).toHaveBeenCalledWith(
      expect.objectContaining({ position: JSON.stringify({ currentValue: 4 }) })
    );
    expect(dbBuilders.marker_state_history.insert).toHaveBeenCalled();
  });

  it('swallows errors so the caller never sees a throw', async () => {
    dbBuilders.marker_states.first.mockRejectedValueOnce(new Error('db down'));
    await expect(
      recordPosition({
        projectId: 'p-1',
        surface: 'counter',
        position: { currentValue: 1 },
        userId: 'u-1',
      })
    ).resolves.toBeUndefined();
  });
});

describe('getHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns [] when the project does not belong to the user', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce(null);
    const rows = await getHistory({
      projectId: 'p-foreign',
      userId: 'u-attacker',
    });
    expect(rows).toEqual([]);
  });
});

describe('rewindTo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the history entry has no previous_position', async () => {
    // Stub the chained query — the service uses leftJoin; mock first()
    // to resolve to a row with previous_position null.
    const queryChain: any = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValueOnce({
        id: 'h-1',
        marker_state_id: 'state-1',
        project_id: 'p-1',
        previous_position: null,
        new_position: '{"a":1}',
      }),
    };
    const dbMock = jest.requireMock('../../config/database')
      .default as jest.Mock;
    dbMock.mockImplementationOnce(() => queryChain);
    const r = await rewindTo({ historyId: 'h-1', userId: 'u-1' });
    expect(r).toBeNull();
  });
});
