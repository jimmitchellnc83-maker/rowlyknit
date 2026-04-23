/**
 * Pure helpers for laying out the knitting activity heatmap.
 *
 * The ActivityHeatmap component renders a GitHub-contributions-style grid:
 *   rows = Sun..Sat (7 rows)
 *   columns = calendar weeks (N weeks covering the requested range)
 *   each cell = one calendar day, coloured by total knitting minutes
 *
 * These helpers are pure so the layout math stays unit-testable.
 */

export interface DayActivity {
  /** YYYY-MM-DD (server's local-date bucket). */
  date: string;
  seconds: number;
  sessionCount: number;
}

export interface HeatmapCell extends DayActivity {
  /** Bucketed intensity 0..4 for colour ramp. */
  level: 0 | 1 | 2 | 3 | 4;
  /** Day-of-week index 0=Sun..6=Sat. */
  dayOfWeek: number;
  /** Absolute column index in the grid. */
  week: number;
}

export interface HeatmapGrid {
  cells: HeatmapCell[];
  weekCount: number;
  monthLabels: Array<{ week: number; label: string }>;
  totals: { totalSeconds: number; activeDays: number; longestStreakDays: number };
}

const SECONDS_PER_MINUTE = 60;

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, delta: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + delta);
  return copy;
}

/** Map seconds-in-day to a 0-4 colour level. Thresholds chosen for typical
 *  knitting sessions: a short sit is 15m, a long evening is 2h+. */
export function levelForSeconds(seconds: number): HeatmapCell['level'] {
  if (seconds <= 0) return 0;
  const minutes = seconds / SECONDS_PER_MINUTE;
  if (minutes < 15) return 1;
  if (minutes < 45) return 2;
  if (minutes < 120) return 3;
  return 4;
}

/** Build the grid covering the last `days` calendar days (today inclusive).
 *  Grid is aligned so that each column is a single Sun–Sat week; the first
 *  column may include leading blank cells for days before the range starts. */
export function buildHeatmapGrid(
  activity: DayActivity[],
  days: number,
  today: Date = new Date()
): HeatmapGrid {
  const byDate = new Map<string, DayActivity>();
  for (const a of activity) byDate.set(a.date, a);

  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = addDays(endDate, -(days - 1));

  // Roll start back to the previous Sunday so columns are clean weeks.
  const startDow = startDate.getDay();
  const gridStart = addDays(startDate, -startDow);

  const cells: HeatmapCell[] = [];
  const monthLabels: HeatmapGrid['monthLabels'] = [];

  let cursor = new Date(gridStart);
  let week = 0;
  let lastMonth = -1;

  while (cursor <= endDate) {
    if (cursor.getDay() === 0) {
      if (cursor.getMonth() !== lastMonth && cursor >= startDate) {
        monthLabels.push({
          week,
          label: cursor.toLocaleString(undefined, { month: 'short' }),
        });
        lastMonth = cursor.getMonth();
      }
    }

    if (cursor >= startDate) {
      const iso = formatDate(cursor);
      const entry = byDate.get(iso);
      const seconds = entry?.seconds ?? 0;
      cells.push({
        date: iso,
        seconds,
        sessionCount: entry?.sessionCount ?? 0,
        level: levelForSeconds(seconds),
        dayOfWeek: cursor.getDay(),
        week,
      });
    }

    if (cursor.getDay() === 6) week++;
    cursor = addDays(cursor, 1);
  }

  const weekCount = week + 1;

  let totalSeconds = 0;
  let activeDays = 0;
  for (const c of cells) {
    totalSeconds += c.seconds;
    if (c.seconds > 0) activeDays += 1;
  }

  return {
    cells,
    weekCount,
    monthLabels,
    totals: {
      totalSeconds,
      activeDays,
      longestStreakDays: longestActiveStreak(cells),
    },
  };
}

function longestActiveStreak(cells: HeatmapCell[]): number {
  const byDate = new Map<string, HeatmapCell>();
  for (const c of cells) byDate.set(c.date, c);
  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) return 0;

  let longest = 0;
  let current = 0;
  let prev: Date | null = null;

  for (const iso of dates) {
    const c = byDate.get(iso)!;
    const d = parseDate(iso);
    if (c.seconds > 0) {
      if (prev && (d.getTime() - prev.getTime()) / 86_400_000 === 1) {
        current += 1;
      } else {
        current = 1;
      }
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
    prev = d;
  }

  return longest;
}

export function formatHours(seconds: number): string {
  if (seconds <= 0) return '0m';
  const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}
