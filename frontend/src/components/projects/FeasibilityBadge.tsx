import { FiCheckCircle, FiAlertTriangle, FiXCircle } from 'react-icons/fi';

export type LightLevel = 'green' | 'yellow' | 'red';

interface FeasibilityBadgeProps {
  status: LightLevel;
  patternId: string;
}

const label: Record<LightLevel, string> = {
  green: 'Ready',
  yellow: 'Check caveats',
  red: 'Missing materials',
};

const icon: Record<LightLevel, React.ElementType> = {
  green: FiCheckCircle,
  yellow: FiAlertTriangle,
  red: FiXCircle,
};

const classes: Record<LightLevel, string> = {
  green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
};

export default function FeasibilityBadge({ status, patternId }: FeasibilityBadgeProps) {
  const Icon = icon[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${classes[status]}`}
      title={`Feasibility: ${label[status]}. Click "View Details" for the full breakdown.`}
      data-testid={`feasibility-badge-${patternId}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label[status]}
    </span>
  );
}
