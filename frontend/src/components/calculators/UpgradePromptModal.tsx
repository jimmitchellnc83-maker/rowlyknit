/**
 * Upgrade prompt — shown when a logged-in user without an active
 * subscription / trial / owner role tries to save a public-tool
 * result to the workspace.
 *
 * Sprint 1 — copy is provider-neutral. The CTA links to `/upgrade`,
 * which Sprint 2 (Lemon Squeezy) wires to the real checkout. Until
 * then `/upgrade` is a placeholder explaining the trial story.
 */

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiLock, FiX } from 'react-icons/fi';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { trackEvent } from '../../lib/analytics';
import type { ToolResult } from '../../lib/toolResult';

interface Props {
  open: boolean;
  result: ToolResult;
  toolTitle: string;
  onClose: () => void;
}

export default function UpgradePromptModal({ open, result, toolTitle, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    trackEvent('upgrade_prompt_shown', {
      toolId: result.toolId,
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, result.toolId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-prompt-title"
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
      >
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <FiLock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <h3
                id="upgrade-prompt-title"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                Saving to Rowly is part of the workspace
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {toolTitle} stays free to use forever. Saving the result
                into a project, pattern, or your stash is part of the
                Rowly Maker workspace.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-2">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 mb-3">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              You calculated
            </p>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {result.humanSummary}
            </p>
          </div>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-disc ml-5">
            <li>Attach this result to a project so future-you knows why you cast on.</li>
            <li>Track yarn, gauge swatches, and shaping plans in one place.</li>
            <li>Cancel anytime — the result you just calculated is yours either way.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 px-6 pb-6 pt-4">
          <Link
            to="/upgrade"
            onClick={() => {
              trackEvent('trial_started_from_public_tool', {
                toolId: result.toolId,
              });
            }}
            className="w-full px-4 py-3 min-h-[44px] rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-center transition"
          >
            Start your 30-day trial
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 min-h-[44px] text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
