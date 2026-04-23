/**
 * Panel Mode — shared type definitions.
 *
 * Kept in sync with backend/src/utils/panelMath.ts. The server is the
 * source of truth for the /live response shape.
 */

export interface PanelGroup {
  id: string;
  project_id: string;
  name: string;
  master_counter_id: string;
  sort_order: number;
  display_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Panel {
  id: string;
  panel_group_id: string;
  name: string;
  repeat_length: number;
  row_offset: number;
  sort_order: number;
  display_color: string | null;
  is_collapsed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PanelRow {
  id: string;
  panel_id: string;
  row_number: number;
  instruction: string;
  stitch_count: number | null;
  metadata: Record<string, unknown>;
}

export interface LivePanelStarted {
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

export interface LivePanelNotStarted {
  panel_id: string;
  name: string;
  started: false;
  row_offset: number;
  rows_until_start: number;
  display_color: string | null;
  sort_order: number;
}

export type LivePanel = LivePanelStarted | LivePanelNotStarted;

export interface LivePanelGroupResponse {
  panelGroup: { id: string; name: string };
  master: { counter_id: string; current_row: number };
  panels: LivePanel[];
  lcm: number;
  rows_until_full_alignment: number;
}
