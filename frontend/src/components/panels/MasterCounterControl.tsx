import { useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface MasterCounterControlProps {
  currentRow: number;
  onAdvance: () => void;
  onRetreat: () => void;
  onJumpTo?: (row: number) => void;
  disabled?: boolean;
}

const SWIPE_THRESHOLD_PX = 40;
const LONG_PRESS_MS = 600;

function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

export default function MasterCounterControl({
  currentRow,
  onAdvance,
  onRetreat,
  onJumpTo,
  disabled = false,
}: MasterCounterControlProps) {
  const [jumpModalOpen, setJumpModalOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const touchStartX = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    touchStartX.current = e.touches[0].clientX;
    if (onJumpTo) {
      longPressTimer.current = setTimeout(() => {
        triggerHaptic();
        setJumpValue(String(currentRow));
        setJumpModalOpen(true);
        touchStartX.current = null;
      }, LONG_PRESS_MS);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (touchStartX.current === null || disabled) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      if (dx > 0) {
        triggerHaptic();
        onAdvance();
      } else {
        triggerHaptic();
        onRetreat();
      }
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const confirmJump = () => {
    const n = parseInt(jumpValue, 10);
    if (Number.isFinite(n) && n >= 1 && onJumpTo) {
      onJumpTo(n);
    }
    setJumpModalOpen(false);
  };

  return (
    <>
      <div
        className="relative select-none rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={onRetreat}
            disabled={disabled}
            aria-label="Previous row"
            className="flex items-center justify-center w-16 sm:w-20 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FiChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>

          <div className="flex-1 flex flex-col items-center justify-center py-6">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Master Row
            </p>
            <p className="text-6xl sm:text-7xl font-bold text-gray-900 dark:text-gray-100 leading-none mt-1 tabular-nums">
              {currentRow}
            </p>
            {onJumpTo && (
              <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-2">
                Swipe · Tap · Long-press to jump
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onAdvance}
            disabled={disabled}
            aria-label="Next row"
            className="flex items-center justify-center w-16 sm:w-20 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            <FiChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {jumpModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setJumpModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-xs shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Jump to row
            </h2>
            <input
              type="number"
              min={1}
              autoFocus
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmJump();
              }}
              className="w-full px-3 py-2 text-lg border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setJumpModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmJump}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
              >
                Jump
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
