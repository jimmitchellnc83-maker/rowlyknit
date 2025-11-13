// Counter Types for Enhanced Counter System

export type CounterType = 'row' | 'stitch' | 'repeat' | 'custom';
export type CounterAction = 'increment' | 'decrement' | 'reset' | 'set';
export type LinkType = 'reset_on_target' | 'advance_together' | 'conditional';
export type AlertType = 'info' | 'warning' | 'reminder';

export interface IncrementPattern {
  type: 'simple' | 'custom_fixed' | 'every_n' | 'custom';
  rule?: string;
  n?: number;
  increment?: number;
  description?: string;
}

export interface Counter {
  id: string;
  project_id: string;
  name: string;
  type: CounterType;
  current_value: number;
  target_value?: number;
  increment_by: number;
  min_value: number;
  max_value?: number;
  notes?: string;
  is_active: boolean;
  is_visible: boolean;
  sort_order: number;
  display_color: string;
  increment_pattern?: IncrementPattern;
  created_at: string;
  updated_at: string;
}

export interface CounterHistory {
  id: string;
  counter_id: string;
  old_value: number;
  new_value: number;
  action: CounterAction;
  user_note?: string;
  created_at: string;
}

export interface CounterLink {
  id: string;
  source_counter_id: string;
  target_counter_id: string;
  link_type: LinkType;
  trigger_condition?: {
    when: 'equals' | 'greater_than' | 'less_than' | 'modulo';
    value: number;
  };
  action?: {
    action: 'reset' | 'increment' | 'decrement' | 'set';
    to_value?: number;
    by_value?: number;
  };
  is_active: boolean;
  created_at: string;
}

export interface MagicMarker {
  id: string;
  project_id: string;
  counter_id?: string;
  trigger_type: 'counter_value' | 'time_elapsed' | 'date';
  trigger_condition: {
    counter?: string;
    operator?: '>=' | '<=' | '==' | '!=' | '>' | '<';
    value?: number;
    duration_minutes?: number;
    date?: string;
  };
  alert_message: string;
  alert_type: AlertType;
  is_active: boolean;
  last_triggered?: string;
  created_at: string;
}

export interface KnittingSession {
  id: string;
  project_id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  rows_completed: number;
  starting_counter_values?: Record<string, number>;
  ending_counter_values?: Record<string, number>;
  notes?: string;
  mood?: 'productive' | 'frustrated' | 'relaxed';
  location?: string;
  created_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  target_rows?: number;
  actual_rows?: number;
  time_spent_seconds: number;
  completed_at?: string;
  sort_order: number;
  created_at: string;
}
