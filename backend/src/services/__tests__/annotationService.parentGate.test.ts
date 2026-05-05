/**
 * PR #384/#385 follow-up — finding #2.
 *
 * `verifyCropBelongsToParent` already gates sourceFileId ↔ cropId on
 * the nested annotation routes, but pre-fix the annotation service
 * loaded by `id + user_id` only. A request like
 *
 *   PATCH /api/source-files/A/crops/B/annotations/<ann-from-crop-C>
 *
 * where crop B is owned by the user AND `ann-from-crop-C` is owned
 * by the same user would silently mutate (or DELETE soft-delete) the
 * foreign annotation. The mismatched cropId/annotationId in the URL
 * was never checked.
 *
 * Fix: `updateAnnotation` and `softDeleteAnnotation` now accept an
 * optional `cropId` arg. When supplied, the where-clause adds
 * `pattern_crop_id = cropId` so the row is scoped to the URL parent.
 * The annotations controller passes `req.params.cropId` on every
 * mutation; mismatch returns 404 (consistent with every other
 * ownership gate in the codebase).
 */

const dbBuilders: any = {
  pattern_crops: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
  pattern_crop_annotations: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    update: jest.fn().mockResolvedValue(0),
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
  return { default: dbFn, __esModule: true };
});

import { softDeleteAnnotation, updateAnnotation } from '../annotationService';

beforeEach(() => {
  jest.clearAllMocks();
  // The .where(...).whereNull(...) chain returns the same builder ref;
  // we re-establish it after clearAllMocks so successive calls work.
  dbBuilders.pattern_crop_annotations.where.mockReturnThis();
  dbBuilders.pattern_crop_annotations.whereNull.mockReturnThis();
});

describe('updateAnnotation — cropId parent-child gate', () => {
  it('passes pattern_crop_id in WHERE when cropId is provided (mismatch → update count 0)', async () => {
    // Simulate the attack: annotation belongs to crop-C but URL claims
    // crop-B. The DB has no row matching `id=ann + crop=B + user=u`,
    // so update returns 0 and the service returns null (→ 404 at the
    // controller layer).
    dbBuilders.pattern_crop_annotations.update.mockResolvedValueOnce(0);

    const result = await updateAnnotation({
      annotationId: 'ann-from-crop-C',
      cropId: 'crop-B', // mismatched parent
      userId: 'u-1',
      payload: {
        strokes: [[{ x: 0, y: 0 }]],
        color: '#000',
        width: 0.01,
      },
    });

    expect(result).toBeNull();

    // The where-clause must include pattern_crop_id so a foreign
    // annotation under the same user can't be mutated.
    expect(dbBuilders.pattern_crop_annotations.where).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ann-from-crop-C',
        user_id: 'u-1',
        pattern_crop_id: 'crop-B',
      }),
    );
  });

  it('passes when cropId matches: update succeeds and returns the row', async () => {
    dbBuilders.pattern_crop_annotations.update.mockResolvedValueOnce(1);
    dbBuilders.pattern_crop_annotations.first.mockResolvedValueOnce({
      id: 'ann-1',
      pattern_crop_id: 'crop-1',
      user_id: 'u-1',
      annotation_type: 'pen',
      payload: '{}',
      created_at: new Date('2026-05-05T12:00:00Z'),
      updated_at: new Date('2026-05-05T12:00:00Z'),
      deleted_at: null,
    });

    const result = await updateAnnotation({
      annotationId: 'ann-1',
      cropId: 'crop-1',
      userId: 'u-1',
      payload: {
        strokes: [[{ x: 0.1, y: 0.1 }]],
        color: '#000',
        width: 0.01,
      },
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe('ann-1');
    expect(dbBuilders.pattern_crop_annotations.where).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ann-1',
        user_id: 'u-1',
        pattern_crop_id: 'crop-1',
      }),
    );
  });

  it('back-compat: omitted cropId leaves pattern_crop_id out of the WHERE', async () => {
    // Internal callers that have already authorized the parent gate
    // can still call updateAnnotation without cropId.
    dbBuilders.pattern_crop_annotations.update.mockResolvedValueOnce(1);
    dbBuilders.pattern_crop_annotations.first.mockResolvedValueOnce({
      id: 'ann-1',
      pattern_crop_id: 'crop-1',
      user_id: 'u-1',
      annotation_type: 'pen',
      payload: '{}',
      created_at: new Date('2026-05-05T12:00:00Z'),
      updated_at: new Date('2026-05-05T12:00:00Z'),
      deleted_at: null,
    });

    await updateAnnotation({
      annotationId: 'ann-1',
      userId: 'u-1',
      payload: {
        strokes: [[{ x: 0.1, y: 0.1 }]],
        color: '#000',
        width: 0.01,
      },
    });

    const whereArg =
      dbBuilders.pattern_crop_annotations.where.mock.calls[0][0];
    expect(whereArg).toEqual({ id: 'ann-1', user_id: 'u-1' });
    expect(whereArg).not.toHaveProperty('pattern_crop_id');
  });
});

describe('softDeleteAnnotation — cropId parent-child gate', () => {
  it('returns false when annotationId does not belong to cropId (mismatch)', async () => {
    dbBuilders.pattern_crop_annotations.update.mockResolvedValueOnce(0);

    const ok = await softDeleteAnnotation('ann-from-crop-C', 'u-1', 'crop-B');

    expect(ok).toBe(false);
    expect(dbBuilders.pattern_crop_annotations.where).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ann-from-crop-C',
        user_id: 'u-1',
        pattern_crop_id: 'crop-B',
      }),
    );
  });

  it('returns true when annotationId belongs to cropId (match)', async () => {
    dbBuilders.pattern_crop_annotations.update.mockResolvedValueOnce(1);

    const ok = await softDeleteAnnotation('ann-1', 'u-1', 'crop-1');

    expect(ok).toBe(true);
    expect(dbBuilders.pattern_crop_annotations.where).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ann-1',
        user_id: 'u-1',
        pattern_crop_id: 'crop-1',
      }),
    );
  });

  it('does NOT call .update if cropId mismatched but the where-clause filters it out', async () => {
    // The whole point: even if a future refactor accidentally set
    // updated > 0 for a stale row, the WHERE on pattern_crop_id is
    // the load-bearing gate. This test pins that the pattern_crop_id
    // appears in the where-clause so the SQL can never delete a
    // foreign annotation.
    dbBuilders.pattern_crop_annotations.update.mockResolvedValueOnce(0);
    await softDeleteAnnotation('ann-from-crop-C', 'u-1', 'crop-B');
    const whereArg =
      dbBuilders.pattern_crop_annotations.where.mock.calls[0][0];
    expect(whereArg.pattern_crop_id).toBe('crop-B');
  });

  it('back-compat: omitted cropId leaves pattern_crop_id out of the WHERE', async () => {
    dbBuilders.pattern_crop_annotations.update.mockResolvedValueOnce(1);
    await softDeleteAnnotation('ann-1', 'u-1');
    const whereArg =
      dbBuilders.pattern_crop_annotations.where.mock.calls[0][0];
    expect(whereArg).toEqual({ id: 'ann-1', user_id: 'u-1' });
    expect(whereArg).not.toHaveProperty('pattern_crop_id');
  });
});
