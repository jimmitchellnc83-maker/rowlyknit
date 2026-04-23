import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import type { LivePanel } from '../../types/panel.types';

interface PanelCardProps {
  panel: LivePanel;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onEdit?: () => void;
}

export default function PanelCard({
  panel,
  isCollapsed,
  onToggleCollapse,
  onEdit,
}: PanelCardProps) {
  const accentColor = panel.display_color || '#3B82F6';

  if (!panel.started) {
    return (
      <div
        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 mb-3 opacity-70"
        style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-600 dark:text-gray-400">
              {panel.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Starts in {panel.rows_until_start}{' '}
              {panel.rows_until_start === 1 ? 'row' : 'rows'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mb-3 shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-t-lg transition-colors"
      >
        <div className="flex items-center gap-2 text-left min-w-0">
          {isCollapsed ? (
            <FiChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <FiChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {panel.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Row {panel.current_row} of {panel.repeat_length}
            </p>
          </div>
        </div>
        {onEdit && !isCollapsed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 flex-shrink-0"
          >
            Edit
          </button>
        )}
      </button>

      {!isCollapsed && (
        <div className="px-4 pb-4">
          <div
            className="rounded-md bg-gray-50 dark:bg-gray-800 px-4 py-3 text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug break-words"
            data-testid="panel-instruction"
          >
            {panel.instruction || (
              <span className="italic text-gray-400 dark:text-gray-500 text-base font-normal">
                No instruction set for row {panel.current_row}.
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
            {panel.rows_until_repeat === 0
              ? 'Last row of repeat'
              : `${panel.rows_until_repeat} ${
                  panel.rows_until_repeat === 1 ? 'row' : 'rows'
                } until repeat`}
          </p>
        </div>
      )}
    </div>
  );
}
