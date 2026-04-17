/**
 * Unit tests for tokenRevocation.ts.
 *
 * Does NOT depend on the broken shared test setup (see jest.config.ts's
 * `setupFilesAfterSetup` typo + missing `test` env in knexfile.ts). These
 * tests mock the Redis client directly and avoid importing anything that
 * pulls in the database layer.
 */

jest.mock('../../config/redis', () => {
  const mockClient = {
    set: jest.fn(),
    get: jest.fn(),
    exists: jest.fn(),
  };
  return {
    redisClient: mockClient,
    sessionRedisClient: mockClient,
    default: mockClient,
  };
});

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import {
  revokeAccessTokenJti,
  isJtiRevoked,
  revokeAllUserTokensBefore,
  getUserRevokedBefore,
} from '../tokenRevocation';
import { redisClient } from '../../config/redis';

const mockRedis = redisClient as unknown as {
  set: jest.Mock;
  get: jest.Mock;
  exists: jest.Mock;
};

describe('tokenRevocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.exists.mockResolvedValue(0);
  });

  describe('revokeAccessTokenJti', () => {
    it('writes deny-list key with TTL derived from exp - now', async () => {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 600;
      await revokeAccessTokenJti('jti-abc', exp);
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      const [key, value, mode, ttl] = mockRedis.set.mock.calls[0];
      expect(key).toBe('jwt:revoked:jti:jti-abc');
      expect(value).toBe('1');
      expect(mode).toBe('EX');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(600);
    });

    it('clamps TTL to minimum 1 second when exp is in the past', async () => {
      const expInPast = Math.floor(Date.now() / 1000) - 999;
      await revokeAccessTokenJti('jti-stale', expInPast);
      const [, , , ttl] = mockRedis.set.mock.calls[0];
      expect(ttl).toBe(1);
    });

    it('swallows Redis errors (fail-open) rather than throwing', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('redis down'));
      const exp = Math.floor(Date.now() / 1000) + 600;
      await expect(revokeAccessTokenJti('jti-err', exp)).resolves.toBeUndefined();
    });
  });

  describe('isJtiRevoked', () => {
    it('returns true when EXISTS returns 1', async () => {
      mockRedis.exists.mockResolvedValueOnce(1);
      await expect(isJtiRevoked('jti-revoked')).resolves.toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('jwt:revoked:jti:jti-revoked');
    });

    it('returns false when EXISTS returns 0', async () => {
      mockRedis.exists.mockResolvedValueOnce(0);
      await expect(isJtiRevoked('jti-fresh')).resolves.toBe(false);
    });

    it('fails open on Redis errors (returns false, logs)', async () => {
      mockRedis.exists.mockRejectedValueOnce(new Error('redis down'));
      await expect(isJtiRevoked('jti-err')).resolves.toBe(false);
    });
  });

  describe('revokeAllUserTokensBefore', () => {
    it('writes user epoch key with 30-day TTL by default', async () => {
      const before = Math.floor(Date.now() / 1000);
      await revokeAllUserTokensBefore('user-1');
      const [key, value, mode, ttl] = mockRedis.set.mock.calls[0];
      expect(key).toBe('jwt:revoked:user:user-1');
      expect(Number(value)).toBeGreaterThanOrEqual(before);
      expect(mode).toBe('EX');
      expect(ttl).toBe(30 * 24 * 60 * 60);
    });

    it('uses provided epoch when given', async () => {
      await revokeAllUserTokensBefore('user-2', 1700000000);
      const [, value] = mockRedis.set.mock.calls[0];
      expect(value).toBe('1700000000');
    });

    it('swallows Redis errors', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('redis down'));
      await expect(revokeAllUserTokensBefore('user-err')).resolves.toBeUndefined();
    });
  });

  describe('getUserRevokedBefore', () => {
    it('returns parsed epoch when set', async () => {
      mockRedis.get.mockResolvedValueOnce('1700000000');
      await expect(getUserRevokedBefore('user-1')).resolves.toBe(1700000000);
    });

    it('returns null when key absent', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      await expect(getUserRevokedBefore('user-2')).resolves.toBeNull();
    });

    it('returns null for non-numeric values', async () => {
      mockRedis.get.mockResolvedValueOnce('not-a-number');
      await expect(getUserRevokedBefore('user-3')).resolves.toBeNull();
    });

    it('fails open on Redis errors', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('redis down'));
      await expect(getUserRevokedBefore('user-err')).resolves.toBeNull();
    });
  });
});
