/**
 * Wave 3 — annotationService unit tests.
 *
 * Locks in:
 *  - assertValidAnnotationInput rejects unknown types and oversize payloads
 *  - createAnnotation refuses when the parent crop isn't owned by the caller
 *  - softDeleteAnnotation only operates on rows owned by the caller
 *  - QuickKey set / list paths apply ownership gates
 */

const dbBuilders: any = {
  pattern_crops: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    update: jest.fn().mockResolvedValue(0),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue([]),
  },
  pattern_crop_annotations: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([
        {
          id: 'ann-1',
          pattern_crop_id: 'crop-1',
          user_id: 'u-1',
          annotation_type: 'pen',
          payload: '{}',
          created_at: new Date('2026-05-02T12:00:00Z'),
          updated_at: new Date('2026-05-02T12:00:00Z'),
          deleted_at: null,
        },
      ]),
    })),
    update: jest.fn().mockResolvedValue(0),
    orderBy: jest.fn().mockResolvedValue([]),
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

import {
  assertValidAnnotationInput,
  createAnnotation,
  listQuickKeysForPattern,
  setCropQuickKey,
  softDeleteAnnotation,
} from '../annotationService';
import { ValidationError } from '../../utils/errorHandler';
import { MAX_ANNOTATION_PAYLOAD_BYTES } from '../../types/annotation';

describe('assertValidAnnotationInput', () => {
  it('accepts a valid pen payload', () => {
    expect(() =>
      assertValidAnnotationInput({
        annotationType: 'pen',
        payload: { strokes: [[{ x: 0.1, y: 0.1 }]], color: '#000', width: 0.01 },
      })
    ).not.toThrow();
  });

  it('rejects unknown annotation type', () => {
    expect(() =>
      assertValidAnnotationInput({ annotationType: 'arrow', payload: {} })
    ).toThrow(ValidationError);
  });

  it('rejects non-object payloads', () => {
    expect(() =>
      assertValidAnnotationInput({ annotationType: 'pen', payload: 'string' })
    ).toThrow(ValidationError);
    expect(() =>
      assertValidAnnotationInput({ annotationType: 'pen', payload: null })
    ).toThrow(ValidationError);
  });

  it('rejects payloads larger than the cap', () => {
    // Create a string that, when JSON-stringified, exceeds the cap
    const big = 'x'.repeat(MAX_ANNOTATION_PAYLOAD_BYTES + 100);
    expect(() =>
      assertValidAnnotationInput({
        annotationType: 'text',
        payload: { x: 0, y: 0, text: big },
      })
    ).toThrow(/exceeds/);
  });
});

describe('createAnnotation ownership gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses when the parent crop is not owned by the user', async () => {
    dbBuilders.pattern_crops.first.mockResolvedValueOnce(null);
    await expect(
      createAnnotation({
        cropId: 'crop-foreign',
        userId: 'u-1',
        annotationType: 'pen',
        payload: { strokes: [], color: '#000', width: 0.01 },
      })
    ).rejects.toThrow(ValidationError);
    expect(dbBuilders.pattern_crop_annotations.insert).not.toHaveBeenCalled();
  });

  it('inserts when ownership passes', async () => {
    dbBuilders.pattern_crops.first.mockResolvedValueOnce({ id: 'crop-1' });
    const r = await createAnnotation({
      cropId: 'crop-1',
      userId: 'u-1',
      annotationType: 'pen',
      payload: { strokes: [[{ x: 0, y: 0 }]], color: '#000', width: 0.01 },
    });
    expect(r.id).toBe('ann-1');
    expect(dbBuilders.pattern_crop_annotations.insert).toHaveBeenCalled();
  });
});

describe('softDeleteAnnotation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when no row matches the user', async () => {
    dbBuilders.pattern_crop_annotations.update.mockResolvedValueOnce(0);
    const ok = await softDeleteAnnotation('ann-foreign', 'u-attacker');
    expect(ok).toBe(false);
  });

  it('returns true when the user owns the row', async () => {
    dbBuilders.pattern_crop_annotations.update.mockResolvedValueOnce(1);
    const ok = await softDeleteAnnotation('ann-1', 'u-1');
    expect(ok).toBe(true);
  });
});

describe('setCropQuickKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the crop is foreign (update count 0)', async () => {
    dbBuilders.pattern_crops.update.mockResolvedValueOnce(0);
    const r = await setCropQuickKey({
      cropId: 'crop-foreign',
      userId: 'u-attacker',
      isQuickKey: true,
      position: 0,
    });
    expect(r).toBeNull();
  });

  it('clears quickkey_position when isQuickKey=false', async () => {
    dbBuilders.pattern_crops.update.mockResolvedValueOnce(1);
    dbBuilders.pattern_crops.first.mockResolvedValueOnce({
      is_quickkey: false,
      quickkey_position: null,
      label: 'Cable',
    });
    const r = await setCropQuickKey({
      cropId: 'crop-1',
      userId: 'u-1',
      isQuickKey: false,
    });
    expect(r).toEqual({ isQuickKey: false, quickKeyPosition: null, label: 'Cable' });
    const updateArg = dbBuilders.pattern_crops.update.mock.calls[0][0];
    expect(updateArg).toMatchObject({ is_quickkey: false, quickkey_position: null });
  });

  it('writes the position when isQuickKey=true and position provided', async () => {
    dbBuilders.pattern_crops.update.mockResolvedValueOnce(1);
    dbBuilders.pattern_crops.first.mockResolvedValueOnce({
      is_quickkey: true,
      quickkey_position: 2,
      label: 'Round 7',
    });
    const r = await setCropQuickKey({
      cropId: 'crop-1',
      userId: 'u-1',
      isQuickKey: true,
      position: 2,
      label: 'Round 7',
    });
    expect(r).toEqual({
      isQuickKey: true,
      quickKeyPosition: 2,
      label: 'Round 7',
    });
  });
});

describe('listQuickKeysForPattern', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns rows mapped to the camelCase shape', async () => {
    dbBuilders.pattern_crops.select.mockResolvedValueOnce([
      {
        id: 'crop-1',
        source_file_id: 'sf-1',
        label: 'A',
        quickkey_position: 0,
        page_number: 1,
        crop_x: 0.1,
        crop_y: 0.2,
        crop_width: 0.3,
        crop_height: 0.4,
      },
      {
        id: 'crop-2',
        source_file_id: 'sf-2',
        label: 'B',
        quickkey_position: 1,
        page_number: 5,
        crop_x: 0,
        crop_y: 0,
        crop_width: 1,
        crop_height: 1,
      },
    ]);
    const rows = await listQuickKeysForPattern('pat-1', 'u-1');
    expect(rows).toEqual([
      {
        cropId: 'crop-1',
        sourceFileId: 'sf-1',
        label: 'A',
        quickKeyPosition: 0,
        pageNumber: 1,
        cropX: 0.1,
        cropY: 0.2,
        cropWidth: 0.3,
        cropHeight: 0.4,
      },
      {
        cropId: 'crop-2',
        sourceFileId: 'sf-2',
        label: 'B',
        quickKeyPosition: 1,
        pageNumber: 5,
        cropX: 0,
        cropY: 0,
        cropWidth: 1,
        cropHeight: 1,
      },
    ]);
  });
});
