/**
 * Chart symbol types — mirrors backend `chartSymbolService.ts`.
 *
 * Canonical key going forward is the `symbol` string (e.g. 'k', 'p', 'sc',
 * 'c4f'). Chart cells store this key in `cells[i].symbolId`.
 */

export type Craft = 'knit' | 'crochet';

export interface ChartSymbolTemplate {
  id: string;
  symbol: string;
  name: string;
  category: string | null;
  description: string | null;
  variations: unknown;
  is_system: boolean;
  user_id: string | null;
  abbreviation: string | null;
  rs_instruction: string | null;
  ws_instruction: string | null;
  cell_span: number;
  craft: Craft;
  created_at: string;
}

export interface SymbolPalette {
  system: ChartSymbolTemplate[];
  custom: ChartSymbolTemplate[];
}

export interface CreateSymbolInput {
  symbol: string;
  name: string;
  category?: string | null;
  description?: string | null;
  abbreviation?: string | null;
  rs_instruction?: string | null;
  ws_instruction?: string | null;
  cell_span?: number;
  craft?: Craft;
}

export interface UpdateSymbolInput {
  name?: string;
  category?: string | null;
  description?: string | null;
  abbreviation?: string | null;
  rs_instruction?: string | null;
  ws_instruction?: string | null;
  cell_span?: number;
  craft?: Craft;
}
