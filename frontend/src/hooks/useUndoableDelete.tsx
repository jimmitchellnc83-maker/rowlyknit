import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

const DEFAULT_DELAY_MS = 5000;

interface ExecuteParams<TContext = unknown> {
  /** Stable id for this pending delete — used to cancel on undo. */
  id: string;
  /** Human label shown in the toast (e.g. yarn brand + name). */
  label: string;
  /** Fires 5s later (or on page unload) — the actual server DELETE. */
  commit: () => Promise<void> | void;
  /**
   * Optional: run immediately on execute to hide the item from the UI
   * (e.g. filter out of a local list state). If provided, `rollback`
   * must restore the UI if undo is hit.
   */
  optimisticHide?: () => TContext | void;
  /** Called when the user taps Undo within the window. */
  rollback?: (ctx?: TContext | void) => void;
  /** Override the toast wait period. */
  delayMs?: number;
}

/**
 * Soft-delete with a 5-second undo window — the gmail-unsend pattern.
 *
 * On `execute()`:
 *   1. The UI hides the item immediately (if `optimisticHide` provided).
 *   2. A toast appears: "Deleted <label>. Undo".
 *   3. If the user taps Undo within ~5s, the commit is cancelled and
 *      `rollback` restores the UI.
 *   4. Otherwise the commit fires server-side.
 *
 * Any pending commits are flushed on unmount + on page unload so nothing
 * gets lost if the user navigates away mid-window.
 */
export function useUndoableDelete() {
  const pending = useRef<
    Map<
      string,
      {
        timeout: ReturnType<typeof setTimeout>;
        commit: () => Promise<void> | void;
        toastId: string | number;
      }
    >
  >(new Map());

  const flush = useCallback(async (id?: string) => {
    const entries = id
      ? pending.current.get(id)
        ? [[id, pending.current.get(id)!] as const]
        : []
      : Array.from(pending.current.entries());
    for (const [key, entry] of entries) {
      clearTimeout(entry.timeout);
      pending.current.delete(key);
      toast.dismiss(entry.toastId);
      try {
        await entry.commit();
      } catch {
        // Commits are best-effort — caller's mutate should surface its own error toast.
      }
    }
  }, []);

  // Flush pending on unmount + page unload so nothing is lost.
  useEffect(() => {
    const onBeforeUnload = () => {
      // Can't await in beforeunload, but at least fire the commits synchronously.
      for (const entry of pending.current.values()) {
        clearTimeout(entry.timeout);
        try {
          entry.commit();
        } catch {
          /* ignore */
        }
      }
      pending.current.clear();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      flush();
    };
  }, [flush]);

  const execute = useCallback(
    <TContext = unknown>({
      id,
      label,
      commit,
      optimisticHide,
      rollback,
      delayMs = DEFAULT_DELAY_MS,
    }: ExecuteParams<TContext>) => {
      // If an existing pending delete targets the same id, flush it first —
      // don't silently overwrite.
      if (pending.current.has(id)) {
        void flush(id);
      }

      const ctx = optimisticHide?.();

      const timeout = setTimeout(() => {
        const entry = pending.current.get(id);
        if (!entry) return;
        pending.current.delete(id);
        void (async () => {
          try {
            await entry.commit();
          } catch {
            // surface nothing here — the original mutate has its own error handling
          }
        })();
      }, delayMs);

      const toastId = toast(
        ({ closeToast }) => (
          <div className="flex items-center justify-between gap-3 w-full">
            <span className="text-sm">
              Deleted <span className="font-medium">{label}</span>.
            </span>
            <button
              type="button"
              onClick={() => {
                const entry = pending.current.get(id);
                if (entry) {
                  clearTimeout(entry.timeout);
                  pending.current.delete(id);
                }
                rollback?.(ctx as TContext | void);
                closeToast?.();
                toast.info(`Restored "${label}"`, { autoClose: 2000 });
              }}
              className="text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline"
            >
              Undo
            </button>
          </div>
        ),
        {
          autoClose: delayMs,
          closeOnClick: false,
          hideProgressBar: false,
          pauseOnHover: true,
          draggable: false,
        },
      );

      pending.current.set(id, { timeout, commit, toastId });
    },
    [flush],
  );

  return { execute, flush };
}
