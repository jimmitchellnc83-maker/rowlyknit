export type PieceStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export interface ProjectPiece {
  id: string;
  project_id: string;
  name: string;
  type: string;
  status: PieceStatus;
  notes: string | null;
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PIECE_STATUS_LABEL: Record<PieceStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

export const PIECE_STATUS_COLOR: Record<PieceStatus, string> = {
  not_started: 'bg-gray-200 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  blocked: 'bg-amber-100 text-amber-800',
};

export const PIECE_TYPE_SUGGESTIONS = [
  'front',
  'back',
  'sleeve',
  'collar',
  'pocket',
  'panel',
  'edging',
  'other',
];
