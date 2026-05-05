/**
 * Row / round repeat math.
 *
 * Sprint 1 Public Tools Conversion. Given total rows available and the
 * length of one stitch-pattern repeat, calculate how many full repeats
 * fit, the remainder, and the row each repeat ends on.
 *
 * Knitters use this constantly: planning where lace repeats fit
 * between hem and underarm, slotting cable rounds into a hat brim,
 * deciding whether to extend or truncate a chart by a row.
 */

export interface RowRepeatInput {
  totalRowsAvailable: number;
  rowsPerRepeat: number;
}

export interface RowRepeatOutput {
  totalRowsAvailable: number;
  rowsPerRepeat: number;
  fullRepeats: number;
  remainderRows: number;
  fitsCleanly: boolean;
  endsAtRow: number;
}

export function computeRowRepeat(input: RowRepeatInput): RowRepeatOutput | null {
  const total = Number(input.totalRowsAvailable);
  const per = Number(input.rowsPerRepeat);
  if (!Number.isFinite(total) || !Number.isFinite(per)) return null;
  if (total <= 0 || per <= 0) return null;
  const fullRepeats = Math.floor(total / per);
  const remainderRows = total - fullRepeats * per;
  return {
    totalRowsAvailable: total,
    rowsPerRepeat: per,
    fullRepeats,
    remainderRows,
    fitsCleanly: remainderRows === 0,
    endsAtRow: fullRepeats * per,
  };
}
