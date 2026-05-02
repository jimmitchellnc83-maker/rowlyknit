/**
 * Verifies the bcrypt + lazy-rehash path for share password protection
 * (chartSharingService). The old SHA256 + non-timing-safe `===` compare
 * was flagged in the platform audit 2026-04-30; this lock-in test
 * documents the contract:
 *
 *   1. New shares persist a bcrypt hash (`$2b$...`).
 *   2. Verify accepts a correct password against bcrypt.
 *   3. Verify accepts a correct password against a legacy SHA256 hash,
 *      and on success rewrites the row with a bcrypt hash.
 *   4. Verify rejects wrong passwords against both formats.
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';

const dbUpdate = jest.fn().mockResolvedValue(1);
const dbWhere = jest.fn(() => ({ update: dbUpdate }));
const dbFn = jest.fn(() => ({ where: dbWhere }));

jest.mock('../../config/database', () => ({ default: dbFn, __esModule: true }));

import {
  hashSharePassword,
  verifySharePassword,
} from '../chartSharingService';

const legacy = (pw: string) =>
  crypto.createHash('sha256').update(pw).digest('hex');

describe('chartSharingService — bcrypt + lazy SHA256 rehash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hashSharePassword emits a bcrypt-format string', async () => {
    const hash = await hashSharePassword('Hunter2!');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('verifySharePassword accepts a correct bcrypt match', async () => {
    const hash = await bcrypt.hash('Hunter2!', 4);
    const ok = await verifySharePassword('Hunter2!', hash);
    expect(ok).toBe(true);
  });

  it('verifySharePassword rejects a wrong bcrypt match', async () => {
    const hash = await bcrypt.hash('Hunter2!', 4);
    const ok = await verifySharePassword('wrong', hash);
    expect(ok).toBe(false);
  });

  it('verifySharePassword accepts a legacy SHA256 hash and rehashes it', async () => {
    const sha = legacy('LegacyPass1!');
    const ok = await verifySharePassword('LegacyPass1!', sha, {
      table: 'shared_charts',
      column: 'password_hash',
      where: { id: 'share-1' },
    });
    expect(ok).toBe(true);

    expect(dbFn).toHaveBeenCalledWith('shared_charts');
    expect(dbWhere).toHaveBeenCalledWith({ id: 'share-1' });
    const updatePayload = dbUpdate.mock.calls[0]?.[0];
    expect(updatePayload?.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('verifySharePassword rejects wrong password against a legacy SHA256 hash', async () => {
    const sha = legacy('correct');
    const ok = await verifySharePassword('wrong', sha, {
      table: 'shared_charts',
      column: 'password_hash',
      where: { id: 'share-1' },
    });
    expect(ok).toBe(false);
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it('verifySharePassword does not throw on rehash DB failure', async () => {
    dbUpdate.mockRejectedValueOnce(new Error('db down'));
    const sha = legacy('LegacyPass1!');
    const ok = await verifySharePassword('LegacyPass1!', sha, {
      table: 'shared_charts',
      column: 'password_hash',
      where: { id: 'share-1' },
    });
    expect(ok).toBe(true);
  });

  it('verifySharePassword rejects when the hex lengths differ', async () => {
    // Truncated legacy hash — should not crash, must be false.
    const ok = await verifySharePassword('whatever', 'deadbeef');
    expect(ok).toBe(false);
  });
});
