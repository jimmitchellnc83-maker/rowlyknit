import { useState, type ReactNode } from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';

interface Props {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Shown alongside the chevron when closed, e.g. "3 fields" */
  previewHint?: string;
}

/**
 * Progressive-disclosure section for long forms. Closed by default — the
 * user sees a header + subtitle + chevron, taps to expand.
 *
 * Used to split forms like "Add Yarn" (14 fields) into Essentials +
 * Inventory + Fibre + Notes so the initial view stays scannable.
 */
export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
  previewHint,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="min-w-0">
          <span className="flex items-center gap-1.5">
            {open ? (
              <FiChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <FiChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </span>
            {previewHint && !open && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                · {previewHint}
              </span>
            )}
          </span>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-5.5 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}
