/**
 * Curated panel templates — spec §4A Path B.
 *
 * Frontend-only static data. Templates are just seed values; the user
 * can rename, recolor, and edit rows after adding.
 */

export interface PanelTemplate {
  id: string;
  name: string;
  description: string;
  repeat_length: number;
  display_color: string;
  rows: { row_number: number; instruction: string }[];
}

export const PANEL_TEMPLATES: PanelTemplate[] = [
  {
    id: 'stockinette',
    name: 'Stockinette',
    description: 'Knit flat — RS knit, WS purl',
    repeat_length: 2,
    display_color: '#3B82F6',
    rows: [
      { row_number: 1, instruction: 'Knit all (RS)' },
      { row_number: 2, instruction: 'Purl all (WS)' },
    ],
  },
  {
    id: 'garter',
    name: 'Garter',
    description: 'Knit every row',
    repeat_length: 2,
    display_color: '#10B981',
    rows: [
      { row_number: 1, instruction: 'Knit all' },
      { row_number: 2, instruction: 'Knit all' },
    ],
  },
  {
    id: 'seed-stitch-2row',
    name: 'Seed Stitch',
    description: '2-row seed over even count',
    repeat_length: 2,
    display_color: '#F59E0B',
    rows: [
      { row_number: 1, instruction: '*K1, P1; repeat from *' },
      { row_number: 2, instruction: '*P1, K1; repeat from *' },
    ],
  },
  {
    id: 'moss-stitch',
    name: 'Moss Stitch',
    description: '4-row double moss',
    repeat_length: 4,
    display_color: '#EC4899',
    rows: [
      { row_number: 1, instruction: '*K1, P1; repeat from *' },
      { row_number: 2, instruction: '*K1, P1; repeat from *' },
      { row_number: 3, instruction: '*P1, K1; repeat from *' },
      { row_number: 4, instruction: '*P1, K1; repeat from *' },
    ],
  },
  {
    id: 'rib-1x1',
    name: '1×1 Rib',
    description: 'K1, P1 rib',
    repeat_length: 2,
    display_color: '#8B5CF6',
    rows: [
      { row_number: 1, instruction: '*K1, P1; repeat from *' },
      { row_number: 2, instruction: 'Knit the knits, purl the purls' },
    ],
  },
  {
    id: 'rib-2x2',
    name: '2×2 Rib',
    description: 'K2, P2 rib',
    repeat_length: 2,
    display_color: '#6366F1',
    rows: [
      { row_number: 1, instruction: '*K2, P2; repeat from *' },
      { row_number: 2, instruction: 'Knit the knits, purl the purls' },
    ],
  },
  {
    id: 'cable-4-front',
    name: 'Cable C4F (4×4)',
    description: 'Classic 4-stitch cable, 4-row repeat',
    repeat_length: 4,
    display_color: '#EF4444',
    rows: [
      { row_number: 1, instruction: 'K4 (RS)' },
      { row_number: 2, instruction: 'P4 (WS)' },
      { row_number: 3, instruction: 'C4F — slip 2 to cable needle, hold in front; K2, then K2 from cable needle' },
      { row_number: 4, instruction: 'P4 (WS)' },
    ],
  },
  {
    id: 'cable-6-front',
    name: 'Cable C6F (6×6)',
    description: '6-stitch cable, 6-row repeat',
    repeat_length: 6,
    display_color: '#DC2626',
    rows: [
      { row_number: 1, instruction: 'K6 (RS)' },
      { row_number: 2, instruction: 'P6 (WS)' },
      { row_number: 3, instruction: 'K6 (RS)' },
      { row_number: 4, instruction: 'P6 (WS)' },
      { row_number: 5, instruction: 'C6F — slip 3 to cable needle, hold in front; K3, then K3 from cable needle' },
      { row_number: 6, instruction: 'P6 (WS)' },
    ],
  },
  {
    id: 'cable-8-front',
    name: 'Cable C8F (8×8)',
    description: '8-stitch cable, 8-row repeat',
    repeat_length: 8,
    display_color: '#B91C1C',
    rows: [
      { row_number: 1, instruction: 'K8 (RS)' },
      { row_number: 2, instruction: 'P8 (WS)' },
      { row_number: 3, instruction: 'K8 (RS)' },
      { row_number: 4, instruction: 'P8 (WS)' },
      { row_number: 5, instruction: 'K8 (RS)' },
      { row_number: 6, instruction: 'P8 (WS)' },
      { row_number: 7, instruction: 'C8F — slip 4 to cable needle, hold in front; K4, then K4 from cable needle' },
      { row_number: 8, instruction: 'P8 (WS)' },
    ],
  },
  {
    id: 'honeycomb',
    name: 'Honeycomb',
    description: '8-row honeycomb cable (multiple of 8 sts)',
    repeat_length: 8,
    display_color: '#14B8A6',
    rows: [
      { row_number: 1, instruction: '*C4B, C4F; repeat from *' },
      { row_number: 2, instruction: 'Purl all' },
      { row_number: 3, instruction: 'Knit all' },
      { row_number: 4, instruction: 'Purl all' },
      { row_number: 5, instruction: '*C4F, C4B; repeat from *' },
      { row_number: 6, instruction: 'Purl all' },
      { row_number: 7, instruction: 'Knit all' },
      { row_number: 8, instruction: 'Purl all' },
    ],
  },
];
