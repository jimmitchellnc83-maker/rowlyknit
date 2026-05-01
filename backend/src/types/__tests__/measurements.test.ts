import { sanitizeMeasurements } from '../measurements';

describe('sanitizeMeasurements', () => {
  it('returns an empty object for null / undefined / non-object input', () => {
    expect(sanitizeMeasurements(null)).toEqual({});
    expect(sanitizeMeasurements(undefined)).toEqual({});
    expect(sanitizeMeasurements('string')).toEqual({});
    expect(sanitizeMeasurements(42)).toEqual({});
    expect(sanitizeMeasurements([1, 2, 3])).toEqual({});
  });

  it('keeps the canonical CYC body fields when they are positive numbers', () => {
    const result = sanitizeMeasurements({
      chest: 38,
      cbToWrist: 30,
      backWaistLength: 17,
      crossBack: 14.5,
      armLength: 22,
      upperArm: 12,
      armholeDepth: 7.5,
      waist: 30,
      hip: 40,
    });
    expect(result).toEqual({
      chest: 38,
      cbToWrist: 30,
      backWaistLength: 17,
      crossBack: 14.5,
      armLength: 22,
      upperArm: 12,
      armholeDepth: 7.5,
      waist: 30,
      hip: 40,
    });
  });

  it('keeps the foot + hand + head fields', () => {
    expect(
      sanitizeMeasurements({
        footLength: 10,
        footCircumference: 9,
        sockHeight: 8,
        handCircumference: 7,
        handLength: 7.5,
        headCircumference: 22,
      })
    ).toEqual({
      footLength: 10,
      footCircumference: 9,
      sockHeight: 8,
      handCircumference: 7,
      handLength: 7.5,
      headCircumference: 22,
    });
  });

  it('drops unknown keys silently (defense against arbitrary JSONB writes)', () => {
    const result = sanitizeMeasurements({
      chest: 38,
      bodyFatPct: 22,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'rm -rf /': 1,
    });
    expect(result).toEqual({ chest: 38 });
  });

  it('drops zero / negative / NaN / Infinity / non-numeric values', () => {
    expect(
      sanitizeMeasurements({
        chest: 0,
        waist: -10,
        hip: NaN,
        armLength: Infinity,
        upperArm: '12' as any,
        crossBack: null as any,
      })
    ).toEqual({});
  });

  it('drops obvious typos (more than 2x the per-field max)', () => {
    // chest max is 80in; 200in is rejected, 79 kept.
    expect(sanitizeMeasurements({ chest: 200 })).toEqual({});
    expect(sanitizeMeasurements({ chest: 79 })).toEqual({ chest: 79 });

    // footLength max is 16in; a finger slip giving 100 is rejected, 11 kept.
    expect(sanitizeMeasurements({ footLength: 100 })).toEqual({});
    expect(sanitizeMeasurements({ footLength: 11 })).toEqual({ footLength: 11 });
  });

  it('preserves only the in-range fields when given a mix', () => {
    expect(
      sanitizeMeasurements({
        chest: 38,
        waist: 0,
        hip: -1,
        footLength: 10,
        sockHeight: 200,
        bogus: 99,
      })
    ).toEqual({
      chest: 38,
      footLength: 10,
    });
  });
});
