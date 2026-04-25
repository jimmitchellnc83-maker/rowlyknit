/**
 * Tests for projectSharingService.
 *
 * Mocks the knex db so we can verify slug-generation behaviour and the
 * shape of update payloads sent to the projects table.
 */

jest.mock('../../config/database', () => {
  const builder: any = {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue([]),
    orderBy: jest.fn().mockResolvedValue([]),
    first: jest.fn(),
    catch: jest.fn(),
  };
  const dbFn = jest.fn(() => builder);
  (dbFn as any).__builder = builder;
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import {
  generateUniqueSlug,
  setProjectVisibility,
  getPublicProjectBySlug,
} from '../projectSharingService';
import db from '../../config/database';

const mockedDb = db as unknown as jest.Mock & {
  __builder: { first: jest.Mock; update: jest.Mock };
};

describe('generateUniqueSlug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('produces a slug from the project name plus a 4-char suffix', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    const slug = await generateUniqueSlug('Cabled Cardigan');
    expect(slug).toMatch(/^cabled-cardigan-[a-z0-9]{4}$/);
  });

  it('falls back to a generic prefix when name has no slug-safe chars', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    const slug = await generateUniqueSlug('!!!');
    expect(slug.startsWith('project-')).toBe(true);
  });

  it('retries when a generated slug already exists', async () => {
    // First lookup returns a hit, second is null — service should retry.
    mockedDb.__builder.first
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null);
    const slug = await generateUniqueSlug('Test');
    expect(slug).toMatch(/^test-[a-z0-9]{4}$/);
    expect(mockedDb.__builder.first).toHaveBeenCalledTimes(2);
  });
});

describe('setProjectVisibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the project does not exist or is not owned by the user', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    const result = await setProjectVisibility({
      projectId: 'p1',
      userId: 'u1',
      isPublic: true,
    });
    expect(result).toBeNull();
  });

  it('generates a slug and publishedAt on first publish', async () => {
    // First call: load the project (no slug yet). Second call: uniqueness check.
    mockedDb.__builder.first
      .mockResolvedValueOnce({ id: 'p1', name: 'My Sweater', share_slug: null, published_at: null })
      .mockResolvedValueOnce(null);

    const result = await setProjectVisibility({
      projectId: 'p1',
      userId: 'u1',
      isPublic: true,
    });

    expect(result).not.toBeNull();
    expect(result!.isPublic).toBe(true);
    expect(result!.shareSlug).toMatch(/^my-sweater-[a-z0-9]{4}$/);
    expect(result!.publishedAt).toBeInstanceOf(Date);
    expect(mockedDb.__builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_public: true,
        share_slug: result!.shareSlug,
      }),
    );
  });

  it('preserves the existing slug when republishing after unpublish', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'p1',
      name: 'My Sweater',
      share_slug: 'my-sweater-x7k2',
      published_at: new Date('2026-01-01T00:00:00Z'),
    });

    const result = await setProjectVisibility({
      projectId: 'p1',
      userId: 'u1',
      isPublic: true,
    });

    expect(result!.shareSlug).toBe('my-sweater-x7k2');
    // publishedAt is the original timestamp, not a fresh one.
    expect(result!.publishedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
  });

  it('keeps slug intact when unpublishing so re-share gives the same URL', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'p1',
      name: 'My Sweater',
      share_slug: 'my-sweater-x7k2',
      published_at: new Date('2026-01-01T00:00:00Z'),
    });

    const result = await setProjectVisibility({
      projectId: 'p1',
      userId: 'u1',
      isPublic: false,
    });

    expect(result!.isPublic).toBe(false);
    expect(result!.shareSlug).toBe('my-sweater-x7k2');
    expect(mockedDb.__builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_public: false,
        share_slug: 'my-sweater-x7k2',
      }),
    );
  });
});

describe('getPublicProjectBySlug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no public project matches the slug', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    const result = await getPublicProjectBySlug('does-not-exist');
    expect(result).toBeNull();
  });
});
