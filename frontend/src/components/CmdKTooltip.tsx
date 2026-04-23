import { useEffect, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';

const STORAGE_KEY = 'cmdk-tooltip-dismissed';

function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as any).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * First-run callout teaching the global-search shortcut.
 *
 * Dismisses on (a) explicit X click, or (b) the user's first successful
 * ⌘K / Ctrl+K press — they've learned it, no need to keep reminding.
 * Both paths write a sentinel to localStorage so the tooltip never
 * reappears for this browser.
 */
export default function CmdKTooltip() {
  const [visible, setVisible] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    setIsMac(detectMac());
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* Private browsing / storage disabled — UI still dismisses for this session. */
    }
    setVisible(false);
  };

  if (!visible) return null;

  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
      role="status"
      data-testid="cmdk-tooltip"
    >
      <FiSearch className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-300 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <span className="font-semibold">Tip:</span> press{' '}
          <kbd className="inline-flex items-center gap-0.5 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs font-mono font-semibold text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100">
            {modKey}
          </kbd>
          {' '}
          <kbd className="inline-flex items-center gap-0.5 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs font-mono font-semibold text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100">
            K
          </kbd>
          {' '}anywhere to search your projects, patterns, yarn, and tools.
        </p>
      </div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
        aria-label="Dismiss tooltip"
      >
        <FiX className="h-4 w-4" />
      </button>
    </div>
  );
}
