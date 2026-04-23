import { describe, it, expect } from 'vitest';
import {
  buildHeatmapGrid,
  levelForSeconds,
  formatHours,
} from '../heatmapLayout';

describe('levelForSeconds', () => {
  it('is 0 for no activity', () => {
    expect(levelForSeconds(0)).toBe(0);
    expect(levelForSeconds(-1)).toBe(0);
  });

  it('buckets by knitting duration', () => {
    expect(levelForSeconds(60 * 5)).toBe(1); // 5 min
    expect(levelForSeconds(60 * 20)).toBe(2); // 20 min
    expect(levelForSeconds(60 * 60)).toBe(3); // 1 hour
    expect(levelForSeconds(60 * 180)).toBe(4); // 3 hours
  });
});

describe('formatHours', () => {
  it('formats minutes only', () => {
    expect(formatHours(60 * 30)).toBe('30m');
  });

  it('formats exact hours', () => {
    expect(formatHours(60 * 60)).toBe('1h');
    expect(formatHours(60 * 120)).toBe('2h');
  });

  it('formats hours + minutes', () => {
    expect(formatHours(60 * 95)).toBe('1h 35m');
  });

  it('returns 0m for no time', () => {
    expect(formatHours(0)).toBe('0m');
  });
});

describe('buildHeatmapGrid', () => {
  const today = new Date(2026, 3, 23); // Thu, Apr 23, 2026

  it('generates one cell per requested day', () => {
    const g = buildHeatmapGrid([], 7, today);
    expect(g.cells).toHaveLength(7);
  });

  it('maps activity onto matching dates', () => {
    const g = buildHeatmapGrid(
      [{ date: '2026-04-22', seconds: 3600, sessionCount: 1 }],
      3,
      today
    );
    const cell = g.cells.find((c) => c.date === '2026-04-22');
    expect(cell?.seconds).toBe(3600);
    expect(cell?.level).toBe(3);
  });

  it('zero-fills days without activity', () => {
    const g = buildHeatmapGrid([], 3, today);
    expect(g.cells.every((c) => c.seconds === 0 && c.level === 0)).toBe(true);
  });

  it('tallies total seconds and active days', () => {
    const g = buildHeatmapGrid(
      [
        { date: '2026-04-22', seconds: 3600, sessionCount: 1 },
        { date: '2026-04-21', seconds: 1800, sessionCount: 2 },
      ],
      7,
      today
    );
    expect(g.totals.totalSeconds).toBe(5400);
    expect(g.totals.activeDays).toBe(2);
  });

  it('counts the longest consecutive streak', () => {
    const g = buildHeatmapGrid(
      [
        { date: '2026-04-19', seconds: 1000, sessionCount: 1 },
        { date: '2026-04-20', seconds: 1000, sessionCount: 1 },
        { date: '2026-04-21', seconds: 1000, sessionCount: 1 },
        { date: '2026-04-23', seconds: 1000, sessionCount: 1 },
      ],
      10,
      today
    );
    expect(g.totals.longestStreakDays).toBe(3);
  });

  it('aligns columns so each one is a Sun-Sat week', () => {
    const g = buildHeatmapGrid([], 14, today);
    // Every cell's week index should be consistent with its day-of-week.
    const firstWeek = g.cells.filter((c) => c.week === 0);
    expect(firstWeek.length).toBeGreaterThan(0);
    expect(firstWeek.every((c) => c.dayOfWeek <= 6)).toBe(true);
  });

  it('emits month labels on the first column that crosses a month boundary', () => {
    const g = buildHeatmapGrid([], 90, today);
    expect(g.monthLabels.length).toBeGreaterThan(0);
    expect(g.monthLabels[0]).toHaveProperty('week');
    expect(g.monthLabels[0]).toHaveProperty('label');
  });
});
