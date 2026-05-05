/**
 * Increase / decrease spacing math.
 *
 * Sprint 1 Public Tools Conversion. The classic "evenly spread X
 * shaping rows over Y total rows" problem, with a clean two-interval
 * answer when the math doesn't divide evenly.
 *
 * Strategy: standard integer-spread algorithm.
 *   - changes = |start - end|
 *   - intervals between shaping rows = changes (one shaping row per change)
 *   - if rows / changes is whole → one interval
 *   - else split into two intervals (floor and ceil) such that
 *     `countA * intervalA + countB * intervalB = totalRows` and
 *     `countA + countB = changes`
 *
 * Returns `null` when inputs are nonsensical (more changes than rows
 * available, zero changes, etc.) — caller renders a hint.
 */

export type ShapingType = 'increase' | 'decrease';

export interface ShapingInput {
  startStitches: number;
  endStitches: number;
  totalRows: number;
}

export interface ShapingOutput {
  startStitches: number;
  endStitches: number;
  totalRows: number;
  shapingType: ShapingType;
  totalShapingChanges: number;
  intervalA: number;
  countA: number;
  intervalB: number | null;
  countB: number | null;
  instruction: string;
}

export function computeShapingPlan(input: ShapingInput): ShapingOutput | null {
  const start = Number(input.startStitches);
  const end = Number(input.endStitches);
  const rows = Number(input.totalRows);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(rows)) {
    return null;
  }
  if (start <= 0 || end <= 0 || rows <= 0) return null;
  if (start === end) return null;
  const shapingType: ShapingType = end > start ? 'increase' : 'decrease';
  const changes = Math.abs(end - start);
  if (changes > rows) return null; // can't shape more rows than you have

  // Two-interval split: distribute `changes` across `rows` so the
  // shaping rows sit as evenly as possible. Interval = rows between
  // consecutive shaping rows (so e.g. "every 8 rows" means 7 plain
  // rows followed by 1 shaping row, repeated).
  const baseInterval = Math.floor(rows / changes);
  const remainder = rows - baseInterval * changes;
  const intervalA = baseInterval;
  const intervalB = baseInterval + 1;
  const countB = remainder;
  const countA = changes - countB;

  const verb = shapingType === 'increase' ? 'Increase' : 'Decrease';

  let instruction: string;
  if (remainder === 0 || countB === 0) {
    instruction = `${verb} every ${intervalA} rows ${changes} times.`;
    return {
      startStitches: start,
      endStitches: end,
      totalRows: rows,
      shapingType,
      totalShapingChanges: changes,
      intervalA,
      countA: changes,
      intervalB: null,
      countB: null,
      instruction,
    };
  }

  // Two-interval phrasing: do the longer interval first so the piece
  // grows / shrinks more gradually at the start and accelerates near
  // the end. This matches the convention pattern designers use in
  // published patterns ("every 9 rows X times, then every 8 rows Y
  // times").
  instruction = `${verb} every ${intervalB} rows ${countB} times, then every ${intervalA} rows ${countA} times.`;
  return {
    startStitches: start,
    endStitches: end,
    totalRows: rows,
    shapingType,
    totalShapingChanges: changes,
    intervalA: intervalB,
    countA: countB,
    intervalB: intervalA,
    countB: countA,
    instruction,
  };
}
