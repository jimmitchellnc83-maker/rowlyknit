// Pattern Types for Enhanced Pattern Features

export interface PatternSection {
  id: string;
  pattern_id: string;
  name: string;
  page_number?: number;
  y_position?: number;
  sort_order: number;
  parent_section_id?: string;
  created_at: string;
}

export interface PatternBookmark {
  id: string;
  pattern_id: string;
  project_id?: string;
  name: string;
  page_number: number;
  y_position?: number;
  zoom_level: number;
  notes?: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface PatternHighlight {
  id: string;
  pattern_id: string;
  project_id?: string;
  page_number: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  color: string;
  opacity: number;
  layer: number;
  created_at: string;
}

export interface PatternAnnotation {
  id: string;
  pattern_id: string;
  project_id?: string;
  page_number: number;
  annotation_type: 'drawing' | 'text' | 'arrow';
  data?: any; // Canvas path data or text content
  image_url?: string;
  created_at: string;
}

export interface AudioNote {
  id: string;
  project_id: string;
  pattern_id?: string;
  audio_url: string;
  transcription?: string;
  duration_seconds?: number;
  counter_values?: Record<string, number>;
  created_at: string;
}

export interface StructuredMemo {
  id: string;
  project_id: string;
  template_type: 'gauge_swatch' | 'fit_adjustment' | 'yarn_substitution' | 'finishing';
  data: GaugeSwatchData | FitAdjustmentData | YarnSubstitutionData | FinishingData;
  created_at: string;
}

export interface GaugeSwatchData {
  needle_size: string;
  stitches_per_inch: number;
  rows_per_inch: number;
  swatch_width: number;
  swatch_height: number;
  notes?: string;
}

export interface FitAdjustmentData {
  measurement_name: string;
  original_value: number;
  adjusted_value: number;
  reason: string;
  notes?: string;
}

export interface YarnSubstitutionData {
  original_yarn: string;
  original_weight: string;
  original_yardage: number;
  replacement_yarn: string;
  replacement_weight: string;
  replacement_yardage: number;
  gauge_difference?: string;
  notes?: string;
}

export interface FinishingData {
  bind_off_method: string;
  seaming_technique: string;
  blocking_instructions: string;
  special_notes?: string;
}

export interface ViewSettings {
  pageZoom: number;
  textScale: number;
  fontWeight: number;
  lineHeight: number;
}
