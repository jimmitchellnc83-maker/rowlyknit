import { Link } from 'react-router-dom';
import { FiCheckCircle, FiAlertTriangle, FiXCircle } from 'react-icons/fi';

export type NeedleCheckStatus = 'green' | 'yellow' | 'red' | 'none';

interface ToolMatchLite {
  id?: string;
  toolId?: string;
  name?: string;
  sizeMm?: number | null;
}

export interface NeedleCheckPayload {
  status: NeedleCheckStatus;
  requiredSizesMm: number[];
  missingSizesMm: number[];
  partialSizesMm: number[];
  matches: Array<{
    sizeMm: number;
    status: 'green' | 'yellow' | 'red';
    matches: ToolMatchLite[];
    message: string;
  }>;
  message: string;
}

interface Props {
  check: NeedleCheckPayload | null | undefined;
}

const WRAPPER: Record<Exclude<NeedleCheckStatus, 'none'>, string> = {
  green: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200',
  red: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
};

const ICON: Record<Exclude<NeedleCheckStatus, 'none'>, React.ElementType> = {
  green: FiCheckCircle,
  yellow: FiAlertTriangle,
  red: FiXCircle,
};

function formatMm(sizes: number[]): string {
  return sizes.map((s) => `${s}mm`).join(', ');
}

export default function NeedleInventoryAlert({ check }: Props) {
  if (!check || check.status === 'none') return null;

  const Icon = ICON[check.status];

  return (
    <div
      className={`border rounded-lg p-4 ${WRAPPER[check.status]}`}
      data-testid="needle-inventory-alert"
    >
      <div className="flex items-start gap-2">
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">
            {check.status === 'green' && 'Needles ready'}
            {check.status === 'yellow' && 'Needle check: close match'}
            {check.status === 'red' && 'Missing needles'}
          </h3>
          <p className="text-xs mt-1 opacity-90">{check.message}</p>
          {check.requiredSizesMm.length > 0 && (
            <p className="text-xs mt-2 opacity-75">
              Required: {formatMm(check.requiredSizesMm)}
            </p>
          )}
          {check.status !== 'green' && (
            <Link
              to="/tools"
              className="inline-block text-xs font-medium underline mt-2 hover:opacity-80"
            >
              Open needle inventory →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
