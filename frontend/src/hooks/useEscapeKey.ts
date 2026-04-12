import { useEffect } from 'react';

/**
 * Calls the handler when the Escape key is pressed.
 * Only fires when `active` is true (default).
 */
export function useEscapeKey(handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handler();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handler, active]);
}
