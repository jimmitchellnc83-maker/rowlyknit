import { describe, it, expect } from 'vitest';
import {
  iLoveYarnDay,
  getActiveCycEvents,
  getNextCycEvent,
} from './cycCalendar';

describe('iLoveYarnDay', () => {
  // 2026-10-10 is a Saturday — first Saturday is Oct 3, second is Oct 10.
  it('returns the 2nd Saturday of October for 2026', () => {
    const d = iLoveYarnDay(2026);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(9); // 0-indexed = October
    expect(d.getUTCDate()).toBe(10);
    expect(d.getUTCDay()).toBe(6); // Saturday
  });

  // 2025-10-11: Oct 1 is Wed. First Saturday = Oct 4. Second = Oct 11.
  it('handles 2025 (Oct 1 is a Wednesday)', () => {
    expect(iLoveYarnDay(2025).getUTCDate()).toBe(11);
  });

  // 2027-10-09: Oct 1 is Friday. First Saturday = Oct 2. Second = Oct 9.
  it('handles 2027 (Oct 1 is a Friday)', () => {
    expect(iLoveYarnDay(2027).getUTCDate()).toBe(9);
  });

  // 2028-10-14: Oct 1 is Sunday. First Saturday = Oct 7. Second = Oct 14.
  it('handles 2028 (Oct 1 is a Sunday)', () => {
    expect(iLoveYarnDay(2028).getUTCDate()).toBe(14);
  });
});

describe('getActiveCycEvents', () => {
  it('surfaces Stitch Away Stress throughout April', () => {
    const events = getActiveCycEvents(new Date('2026-04-15T12:00:00Z'));
    const sas = events.find((e) => e.id === 'stitch-away-stress');
    expect(sas).toBeTruthy();
    expect(sas?.hashtag).toBe('#StitchAwayStress');
  });

  it('surfaces SAS on April 1 and April 30', () => {
    expect(
      getActiveCycEvents(new Date('2026-04-01T00:00:00Z')).map((e) => e.id),
    ).toContain('stitch-away-stress');
    expect(
      getActiveCycEvents(new Date('2026-04-30T20:00:00Z')).map((e) => e.id),
    ).toContain('stitch-away-stress');
  });

  it('does NOT surface SAS in May', () => {
    expect(
      getActiveCycEvents(new Date('2026-05-01T00:00:00Z')).map((e) => e.id),
    ).not.toContain('stitch-away-stress');
  });

  it('surfaces I Love Yarn Day on the 2nd Saturday of October only', () => {
    expect(
      getActiveCycEvents(new Date('2026-10-10T15:00:00Z')).map((e) => e.id),
    ).toContain('i-love-yarn-day');
    // Day after — banner should be gone.
    expect(
      getActiveCycEvents(new Date('2026-10-11T15:00:00Z')).map((e) => e.id),
    ).not.toContain('i-love-yarn-day');
  });

  it('returns an empty list for ordinary dates', () => {
    expect(getActiveCycEvents(new Date('2026-07-15T12:00:00Z'))).toEqual([]);
  });
});

describe('getNextCycEvent', () => {
  it('returns Stitch Away Stress when called from January', () => {
    const ev = getNextCycEvent(new Date('2026-01-15T12:00:00Z'));
    expect(ev?.id).toBe('stitch-away-stress');
    expect(ev?.startDate.getUTCMonth()).toBe(3); // April
  });

  it('returns I Love Yarn Day when called from May', () => {
    const ev = getNextCycEvent(new Date('2026-05-15T12:00:00Z'));
    expect(ev?.id).toBe('i-love-yarn-day');
  });

  it('rolls forward to next year when both events have already passed', () => {
    const ev = getNextCycEvent(new Date('2026-11-01T12:00:00Z'));
    expect(ev?.id).toBe('stitch-away-stress');
    expect(ev?.startDate.getUTCFullYear()).toBe(2027);
  });

  it('does not return an event currently in-window', () => {
    // April 15 — SAS is active. getNextCycEvent should skip it and
    // return the next forward-looking event (October's ILY).
    const ev = getNextCycEvent(new Date('2026-04-15T12:00:00Z'));
    expect(ev?.id).toBe('i-love-yarn-day');
  });
});
