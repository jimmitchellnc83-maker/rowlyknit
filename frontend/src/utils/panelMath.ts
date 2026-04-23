/**
 * Client-side mirror of backend/src/utils/panelMath.ts. Kept deliberately
 * in sync so the offline knitting view can compute the same live state the
 * server would have returned.
 *
 * When these drift, tests in the backend will stay green — there's no
 * contract test yet. If you change one side, update the other.
 */

export interface PanelForMath {
  id: string;
  name: string;
  repeat_length: number;
  row_offset: number;
  display_color: string | null;
  sort_order: number;
}

export interface PanelRowForMath {
  panel_id: string;
  row_number: number;
  instruction: string;
}

export interface LiveStartedLocal {
  panel_id: string;
  name: string;
  started: true;
  repeat_length: number;
  row_offset: number;
  current_row: number;
  rows_until_repeat: number;
  instruction: string;
  display_color: string | null;
  sort_order: number;
}

export interface LiveNotStartedLocal {
  panel_id: string;
  name: string;
  started: false;
  row_offset: number;
  rows_until_start: number;
  display_color: string | null;
  sort_order: number;
}

export type LiveLocal = LiveStartedLocal | LiveNotStartedLocal;

export interface LiveGroupLocal {
  master: { counter_id: string; current_row: number };
  panels: LiveLocal[];
  lcm: number;
  rows_until_full_alignment: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

export function computeLiveLocal(
  masterCounterId: string,
  masterRow: number,
  panels: PanelForMath[],
  panelRows: PanelRowForMath[],
): LiveGroupLocal {
  const rowsByPanel = new Map<string, Map<number, string>>();
  for (const r of panelRows) {
    let inner = rowsByPanel.get(r.panel_id);
    if (!inner) {
      inner = new Map();
      rowsByPanel.set(r.panel_id, inner);
    }
    inner.set(r.row_number, r.instruction);
  }

  const livePanels: LiveLocal[] = panels
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => {
      const effective = masterRow - 1 - p.row_offset;
      if (effective < 0) {
        return {
          panel_id: p.id,
          name: p.name,
          started: false,
          row_offset: p.row_offset,
          rows_until_start: p.row_offset - (masterRow - 1),
          display_color: p.display_color,
          sort_order: p.sort_order,
        };
      }
      const currentRow = (effective % p.repeat_length) + 1;
      return {
        panel_id: p.id,
        name: p.name,
        started: true,
        repeat_length: p.repeat_length,
        row_offset: p.row_offset,
        current_row: currentRow,
        rows_until_repeat: p.repeat_length - currentRow,
        instruction: rowsByPanel.get(p.id)?.get(currentRow) ?? '',
        display_color: p.display_color,
        sort_order: p.sort_order,
      };
    });

  const groupLcm = panels.reduce(
    (acc, p) => lcm(acc, Math.max(1, p.repeat_length)),
    1,
  );
  const rowsUntil =
    groupLcm <= 0 ? 0 : groupLcm - ((masterRow - 1) % groupLcm);

  return {
    master: { counter_id: masterCounterId, current_row: masterRow },
    panels: livePanels,
    lcm: groupLcm,
    rows_until_full_alignment: rowsUntil,
  };
}
