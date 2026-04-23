/**
 * Pure math for Panel Mode.
 *
 * The whole competitive story is here: one master counter value produces
 * N derived panel positions via modulo. No per-panel state, no multi-row
 * transactions, no sync drift.
 */

export interface PanelInput {
  id: string;
  name: string;
  repeat_length: number;
  row_offset: number;
  display_color: string | null;
  sort_order: number;
}

export interface PanelRowInput {
  panel_id: string;
  row_number: number;
  instruction: string;
}

export interface LivePanelStartedState {
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

export interface LivePanelNotStartedState {
  panel_id: string;
  name: string;
  started: false;
  row_offset: number;
  rows_until_start: number;
  display_color: string | null;
  sort_order: number;
}

export type LivePanelState = LivePanelStartedState | LivePanelNotStartedState;

export interface LivePanelGroupState {
  master: {
    counter_id: string;
    current_row: number;
  };
  panels: LivePanelState[];
  lcm: number;
  rows_until_full_alignment: number;
}

export function gcdOf(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function lcmOf(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcdOf(a, b);
}

/**
 * Compute the live state of a panel group from its master counter value.
 *
 * @param masterCounterId  UUID of the master counter
 * @param masterRow        Current value of the master counter (1-based)
 * @param panels           All panels in the group
 * @param panelRows        All panel_rows for those panels (any order)
 */
export function computeLiveState(
  masterCounterId: string,
  masterRow: number,
  panels: PanelInput[],
  panelRows: PanelRowInput[],
): LivePanelGroupState {
  const rowsByPanel = new Map<string, Map<number, string>>();
  for (const row of panelRows) {
    let inner = rowsByPanel.get(row.panel_id);
    if (!inner) {
      inner = new Map();
      rowsByPanel.set(row.panel_id, inner);
    }
    inner.set(row.row_number, row.instruction);
  }

  const livePanels: LivePanelState[] = panels
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((panel) => {
      const effectiveRow = masterRow - 1 - panel.row_offset;
      if (effectiveRow < 0) {
        return {
          panel_id: panel.id,
          name: panel.name,
          started: false,
          row_offset: panel.row_offset,
          rows_until_start: panel.row_offset - (masterRow - 1),
          display_color: panel.display_color,
          sort_order: panel.sort_order,
        } satisfies LivePanelNotStartedState;
      }

      const currentRow = (effectiveRow % panel.repeat_length) + 1;
      const rowsUntilRepeat = panel.repeat_length - currentRow;
      const instruction = rowsByPanel.get(panel.id)?.get(currentRow) ?? '';

      return {
        panel_id: panel.id,
        name: panel.name,
        started: true,
        repeat_length: panel.repeat_length,
        row_offset: panel.row_offset,
        current_row: currentRow,
        rows_until_repeat: rowsUntilRepeat,
        instruction,
        display_color: panel.display_color,
        sort_order: panel.sort_order,
      } satisfies LivePanelStartedState;
    });

  const lcm = panels.reduce(
    (acc, p) => lcmOf(acc, Math.max(1, p.repeat_length)),
    1,
  );

  // Semantic: "knit this many more rows to return to the all-panels-at-row-1 state."
  // At masterRow=1 (already aligned) returns `lcm` — the FULL cycle to the next
  // alignment. At masterRow=lcm returns 1. At masterRow=lcm+1 (aligned again)
  // returns `lcm`.
  const rowsUntilAlignment =
    lcm <= 0 ? 0 : lcm - ((masterRow - 1) % lcm);

  return {
    master: {
      counter_id: masterCounterId,
      current_row: masterRow,
    },
    panels: livePanels,
    lcm,
    rows_until_full_alignment: rowsUntilAlignment,
  };
}
