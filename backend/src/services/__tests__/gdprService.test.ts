/**
 * Tests for gdprService — focused on the testable, pure-DB-mock paths.
 *
 * `requestDataExport` and `requestAccountDeletion` both kick off side
 * effects (file write, email send) via `setImmediate`; the test stubs
 * the side effect mocks so they don't block. The cron entry-point
 * (`executeScheduledDeletions`) and the file-streaming materialiser
 * are integration-tested separately against a live DB.
 */

jest.mock('../../config/database', () => {
  const builder: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    returning: jest.fn(),
    first: jest.fn(),
  };
  const dbFn: any = jest.fn(() => builder);
  dbFn.transaction = jest.fn(async (cb: any) => cb(dbFn));
  dbFn.__builder = builder;
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

// Stub the email send so requestAccountDeletion doesn't try to talk to
// a real SMTP service from the unit test.
jest.mock('../emailService', () => ({
  __esModule: true,
  sendAccountDeletionConfirmEmail: jest.fn().mockResolvedValue(undefined),
}));

import {
  requestDataExport,
  getExportRequest,
  listExportRequests,
  requestAccountDeletion,
  confirmDeletion,
  cancelDeletion,
  getActiveDeletionRequest,
} from '../gdprService';
import db from '../../config/database';

const mockedDb = db as unknown as jest.Mock & {
  __builder: {
    first: jest.Mock;
    returning: jest.Mock;
    update: jest.Mock;
    insert: jest.Mock;
    where: jest.Mock;
    whereIn: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
  };
};

describe('requestDataExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the in-flight request when one exists for the user', async () => {
    const existing = { id: 'export-1', status: 'pending', format: 'json', user_id: 'u1' };
    mockedDb.__builder.first.mockResolvedValueOnce(existing);
    const result = await requestDataExport({ userId: 'u1' });
    expect(result).toBe(existing);
    expect(mockedDb.__builder.insert).not.toHaveBeenCalled();
  });

  it('inserts a new pending request when no in-flight one exists', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    mockedDb.__builder.returning.mockResolvedValueOnce([
      { id: 'export-2', status: 'pending', format: 'json', user_id: 'u1' },
    ]);
    const result = await requestDataExport({ userId: 'u1', format: 'json' });
    expect(result).toMatchObject({ id: 'export-2', status: 'pending' });
    expect(mockedDb.__builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', status: 'pending', format: 'json' })
    );
  });

  it('passes the requested format through to the insert', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    mockedDb.__builder.returning.mockResolvedValueOnce([
      { id: 'export-3', status: 'pending', format: 'csv', user_id: 'u1' },
    ]);
    await requestDataExport({ userId: 'u1', format: 'csv' });
    expect(mockedDb.__builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'csv' })
    );
  });
});

describe('getExportRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the row when the user owns it', async () => {
    const row = { id: 'e1', user_id: 'u1' };
    mockedDb.__builder.first.mockResolvedValueOnce(row);
    expect(await getExportRequest({ requestId: 'e1', userId: 'u1' })).toBe(row);
    expect(mockedDb.__builder.where).toHaveBeenCalledWith({ id: 'e1', user_id: 'u1' });
  });

  it('returns null for a missing row', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(undefined);
    expect(await getExportRequest({ requestId: 'e1', userId: 'u1' })).toBeNull();
  });
});

describe('listExportRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('limits to 20 rows newest-first for the user', async () => {
    const rows = [{ id: 'e1' }, { id: 'e2' }];
    mockedDb.__builder.limit.mockResolvedValueOnce(rows);
    const result = await listExportRequests('u1');
    expect(result).toBe(rows);
    expect(mockedDb.__builder.where).toHaveBeenCalledWith({ user_id: 'u1' });
    expect(mockedDb.__builder.orderBy).toHaveBeenCalledWith('created_at', 'desc');
    expect(mockedDb.__builder.limit).toHaveBeenCalledWith(20);
  });
});

describe('requestAccountDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the existing active request without creating another', async () => {
    const existing = { id: 'del-1', status: 'pending', user_id: 'u1' };
    mockedDb.__builder.first.mockResolvedValueOnce(existing);
    const result = await requestAccountDeletion({
      userId: 'u1',
      email: 'a@b.c',
      firstName: 'A',
      reason: null,
    });
    expect(result).toBe(existing);
    expect(mockedDb.__builder.insert).not.toHaveBeenCalled();
  });

  it('inserts a new pending row when none is active', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    mockedDb.__builder.returning.mockResolvedValueOnce([
      { id: 'del-2', status: 'pending', confirmation_token: 'tok' },
    ]);
    const result = await requestAccountDeletion({
      userId: 'u1',
      email: 'a@b.c',
      firstName: null,
      reason: 'changed mind',
    });
    expect(result).toMatchObject({ id: 'del-2' });
    expect(mockedDb.__builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        status: 'pending',
        reason: 'changed mind',
      })
    );
  });
});

describe('confirmDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns NULL when the token does not match a pending row', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(undefined);
    expect(await confirmDeletion('badtoken')).toBeNull();
  });

  it('flips the row to scheduled and returns the updated copy', async () => {
    const pending = { id: 'del-1', status: 'pending', confirmation_token: 'tok' };
    const scheduled = {
      id: 'del-1',
      status: 'scheduled',
      scheduled_for: new Date('2026-06-01'),
      confirmation_token: null,
    };
    mockedDb.__builder.first
      .mockResolvedValueOnce(pending) // first lookup
      .mockResolvedValueOnce(scheduled); // re-fetch after update
    const result = await confirmDeletion('tok');
    expect(result).toMatchObject({ id: 'del-1', status: 'scheduled' });
    expect(mockedDb.__builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'scheduled' })
    );
  });
});

describe('cancelDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns NULL when the user has no active request', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(undefined);
    expect(await cancelDeletion('u1')).toBeNull();
  });

  it('flips the row to cancelled and clears the token', async () => {
    const active = { id: 'del-1', status: 'scheduled', user_id: 'u1' };
    const cancelled = { id: 'del-1', status: 'cancelled', user_id: 'u1' };
    mockedDb.__builder.first
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(cancelled);
    const result = await cancelDeletion('u1');
    expect(result).toMatchObject({ status: 'cancelled' });
    expect(mockedDb.__builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', confirmation_token: null })
    );
  });
});

describe('getActiveDeletionRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the most recent active row', async () => {
    const row = { id: 'del-2', status: 'scheduled' };
    mockedDb.__builder.first.mockResolvedValueOnce(row);
    expect(await getActiveDeletionRequest('u1')).toBe(row);
    expect(mockedDb.__builder.whereIn).toHaveBeenCalledWith(
      'status',
      ['pending', 'scheduled']
    );
  });

  it('returns NULL when none is active', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(undefined);
    expect(await getActiveDeletionRequest('u1')).toBeNull();
  });
});
