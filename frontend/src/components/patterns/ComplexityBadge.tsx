import { FiBarChart2 } from 'react-icons/fi';

export type ComplexityLevel = 1 | 2 | 3 | 4 | 5;

export type ComplexityLabel =
  | 'Beginner'
  | 'Easy'
  | 'Intermediate'
  | 'Advanced'
  | 'Expert';

export interface ComplexityBreakdown {
  techniques: string[];
  techniquePoints: number;
  rowCount: number | null;
  rowCountPoints: number;
  pieceCount: number;
  pieceCountPoints: number;
  shapingCount: number;
  shapingPoints: number;
  sizeCount: number;
  sizePoints: number;
  totalScore: number;
  estimatedHours: number | null;
}

export interface ComplexityResult {
  level: ComplexityLevel;
  label: ComplexityLabel;
  breakdown: ComplexityBreakdown;
}

interface ComplexityBadgeProps {
  complexity: ComplexityResult;
  patternId: string;
}

const CLASSES: Record<ComplexityLevel, string> = {
  1: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  2: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  3: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  4: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  5: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
};

function buildTooltip({ breakdown, label }: ComplexityResult): string {
  const lines: string[] = [`Complexity: ${label}`];
  if (breakdown.techniques.length > 0) {
    lines.push(`Techniques: ${breakdown.techniques.join(', ')}`);
  }
  if (breakdown.rowCount) {
    lines.push(`Rows: ${breakdown.rowCount}`);
  }
  if (breakdown.pieceCount > 0) {
    lines.push(`Pieces: ${breakdown.pieceCount}`);
  }
  if (breakdown.sizeCount > 1) {
    lines.push(`Sizes: ${breakdown.sizeCount}`);
  }
  if (breakdown.estimatedHours != null) {
    lines.push(`Est. ${breakdown.estimatedHours}h at reference gauge`);
  }
  return lines.join(' • ');
}

export default function ComplexityBadge({ complexity, patternId }: ComplexityBadgeProps) {
  const { level, label } = complexity;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${CLASSES[level]}`}
      title={buildTooltip(complexity)}
      data-testid={`complexity-badge-${patternId}`}
    >
      <FiBarChart2 className="h-3 w-3" aria-hidden="true" />
      {label} ({level}/5)
    </span>
  );
}
