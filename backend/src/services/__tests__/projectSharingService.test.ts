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

  it('hides notes by default — public_notes=false strips them', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'p1',
      name: 'X',
      status: 'completed',
      notes: 'Birthday gift for Aunt Mary, do not let her see this',
      metadata: {},
      public_notes: false,
    });
    // Photos + yarn queries return [] (already mocked at the top).
    const result = await getPublicProjectBySlug('x-1234');
    expect(result?.notes).toBeNull();
  });

  it('emits notes when public_notes=true', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'p1',
      name: 'X',
      status: 'completed',
      notes: 'Useful gauge note for sharing',
      metadata: {},
      public_notes: true,
    });
    const result = await getPublicProjectBySlug('x-1234');
    expect(result?.notes).toBe('Useful gauge note for sharing');
  });

  it('strips free-form metadata fields not on the allowlist', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'p1',
      name: 'X',
      status: 'completed',
      notes: null,
      metadata: {
        gauge: { stitches: 22, rows: 30, measurement: 4, unit: 'in' },
        needles: 'US 7',
        finishedSize: '38" bust',
        recipientPrivateAddress: '123 Real Street, Town',
        designer_internal_id: 'secret-pattern-id-42',
      },
      public_notes: false,
    });
    const result = await getPublicProjectBySlug('x-1234');
    expect(result?.metadata.gauge).toEqual({ stitches: 22, rows: 30, measurement: 4, unit: 'in' });
    expect(result?.metadata.needles).toBe('US 7');
    expect(result?.metadata.finishedSize).toBe('38" bust');
    expect(result?.metadata).not.toHaveProperty('recipientPrivateAddress');
    expect(result?.metadata).not.toHaveProperty('designer_internal_id');
  });

  it('handles metadata stored as a JSON string', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'p1',
      name: 'X',
      status: 'completed',
      notes: null,
      metadata: JSON.stringify({ needles: 'US 8', secret: 'leak' }),
      public_notes: false,
    });
    const result = await getPublicProjectBySlug('x-1234');
    expect(result?.metadata.needles).toBe('US 8');
    expect(result?.metadata).not.toHaveProperty('secret');
  });
});

describe('setProjectVisibility — public_notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('flips public_notes to true when explicitly set', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'p1',
      name: 'My Sweater',
      share_slug: 'my-sweater-x7k2',
      published_at: new Date('2026-01-01T00:00:00Z'),
      public_notes: false,
    });

    const result = await setProjectVisibility({
      projectId: 'p1',
      userId: 'u1',
      isPublic: true,
      publicNotes: true,
    });

    expect(result?.publicNotes).toBe(true);
    expect(mockedDb.__builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ public_notes: true })
    );
  });

  it('leaves public_notes alone when not provided', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'p1',
      name: 'My Sweater',
      share_slug: 'my-sweater-x7k2',
      published_at: new Date('2026-01-01T00:00:00Z'),
      public_notes: true,
    });

    const result = await setProjectVisibility({
      projectId: 'p1',
      userId: 'u1',
      isPublic: true,
    });

    expect(result?.publicNotes).toBe(true);
    const updateCall = mockedDb.__builder.update.mock.calls[0]?.[0] ?? {};
    expect(updateCall).not.toHaveProperty('public_notes');
  });
});
