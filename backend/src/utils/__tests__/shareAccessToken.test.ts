/**
 * Verifies the HMAC-signed share access token used to gate password-
 * protected /shared/chart/:token after dropping the `?password=…` query.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-share-access';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-share-access';

import {
  issueShareAccessToken,
  verifyShareAccessToken,
  shareAccessCookieName,
} from '../shareAccessToken';

describe('shareAccessToken', () => {
  it('issued tokens verify against their share token', () => {
    const { token } = issueShareAccessToken('share-abc');
    expect(verifyShareAccessToken('share-abc', token)).toBe(true);
  });

  it('rejects tokens issued for a different share', () => {
    const { token } = issueShareAccessToken('share-abc');
    expect(verifyShareAccessToken('share-xyz', token)).toBe(false);
  });

  it('rejects expired tokens', () => {
    const { token } = issueShareAccessToken('share-abc', -1); // already expired
    expect(verifyShareAccessToken('share-abc', token)).toBe(false);
  });

  it('rejects malformed tokens', () => {
    expect(verifyShareAccessToken('share-abc', undefined)).toBe(false);
    expect(verifyShareAccessToken('share-abc', '')).toBe(false);
    expect(verifyShareAccessToken('share-abc', 'no-dot-here')).toBe(false);
    expect(verifyShareAccessToken('share-abc', '.deadbeef')).toBe(false);
    expect(verifyShareAccessToken('share-abc', '999999.')).toBe(false);
    expect(verifyShareAccessToken('share-abc', 'notanint.deadbeef')).toBe(false);
  });

  it('rejects tampered signatures (constant-time path)', () => {
    const { token } = issueShareAccessToken('share-abc');
    const dot = token.indexOf('.');
    const tampered = token.slice(0, dot + 1) + 'a'.repeat(token.length - dot - 1);
    expect(verifyShareAccessToken('share-abc', tampered)).toBe(false);
  });

  it('rejects tokens with truncated signatures', () => {
    const { token } = issueShareAccessToken('share-abc');
    const truncated = token.slice(0, token.length - 4);
    expect(verifyShareAccessToken('share-abc', truncated)).toBe(false);
  });

  it('cookie name is namespaced per share token', () => {
    expect(shareAccessCookieName('abc')).toBe('share_access_abc');
    expect(shareAccessCookieName('xyz')).toBe('share_access_xyz');
    expect(shareAccessCookieName('abc')).not.toBe(shareAccessCookieName('xyz'));
  });
});
