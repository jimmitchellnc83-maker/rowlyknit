import { describe, it, expect } from 'vitest';
import {
  recipientToBodyBlock,
  recipientToSock,
  recipientToMitten,
} from './recipientToDesigner';

describe('recipientToBodyBlock', () => {
  it('maps chest, hip, and waist + backWaistLength', () => {
    const seed = recipientToBodyBlock(
      {
        chest: 38,
        waist: 32,
        hip: 40,
        backWaistLength: 17,
      },
      { totalLength: 24 },
    );
    expect(seed.chestCircumference).toBe(38);
    expect(seed.hip).toEqual({ hipCircumference: 40, easeAtHip: 0 });
    expect(seed.waist).toEqual({
      waistCircumference: 32,
      easeAtWaist: 0,
      waistHeightFromHem: 7, // 24 - 17
    });
  });

  it('falls back to ~45% of totalLength when backWaistLength is missing', () => {
    const seed = recipientToBodyBlock({ waist: 30 }, { totalLength: 24 });
    expect(seed.waist?.waistHeightFromHem).toBeCloseTo(10.8, 5);
  });

  it('omits waist when totalLength is unavailable (no anchor for waistHeight)', () => {
    const seed = recipientToBodyBlock({ waist: 30 });
    expect(seed.waist).toBeUndefined();
  });

  it('skips zero / missing fields silently', () => {
    expect(recipientToBodyBlock({})).toEqual({});
    expect(recipientToBodyBlock({ chest: 0, waist: 0 })).toEqual({});
  });
});

describe('recipientToSock', () => {
  it('maps the three CYC sock fields and defaults ankle = foot circumference', () => {
    const seed = recipientToSock({
      footLength: 10,
      footCircumference: 9,
      sockHeight: 8,
    });
    expect(seed).toEqual({
      footLength: 10,
      footCircumference: 9,
      ankleCircumference: 9,
      legLength: 8,
    });
  });

  it('partial input — only the fields recorded come through', () => {
    expect(recipientToSock({ footLength: 10 })).toEqual({ footLength: 10 });
    // No foot circumference → no ankle default either
    expect(recipientToSock({ sockHeight: 6 })).toEqual({ legLength: 6 });
  });

  it('returns empty object for empty measurements', () => {
    expect(recipientToSock({})).toEqual({});
  });
});

describe('recipientToMitten', () => {
  it('maps handCircumference straight through', () => {
    const seed = recipientToMitten({ handCircumference: 8 });
    expect(seed.handCircumference).toBe(8);
  });

  it('splits handLength 60/40 across cuff-to-thumb + thumb-to-tip', () => {
    const seed = recipientToMitten({ handLength: 7.5 });
    expect(seed.cuffToThumbLength).toBeCloseTo(4.5, 5);
    expect(seed.thumbToTipLength).toBeCloseTo(3, 5);
  });

  it('skips fields that arent populated', () => {
    expect(recipientToMitten({})).toEqual({});
    expect(recipientToMitten({ handCircumference: 0 })).toEqual({});
  });

  it('combines circumference + length when both are present', () => {
    const seed = recipientToMitten({
      handCircumference: 8.5,
      handLength: 7,
    });
    expect(seed).toMatchObject({
      handCircumference: 8.5,
      cuffToThumbLength: 4.2,
      thumbToTipLength: 2.8,
    });
  });
});
