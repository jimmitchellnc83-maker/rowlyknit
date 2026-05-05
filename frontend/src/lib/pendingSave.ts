/**
 * Pending tool-result holder — the bridge that carries a public-tool
 * result through the auth wall.
 *
 * Flow:
 *
 *   1. User hits a public tool, gets a result.
 *   2. User clicks "Save to Rowly" while logged out.
 *   3. We `setPendingSave(result)` to localStorage and redirect to
 *      `/login?next=<original_route>&pendingSave=1`.
 *   4. Login / register lands at the original route, which detects
 *      `pendingSave=1`, calls `consumePendingSave()`, and feeds the
 *      result back into the SaveToRowlyCTA — which now skips straight
 *      to the destination picker (or upgrade prompt) for a logged-in
 *      user.
 *   5. Whether the save succeeds, fails, or the user cancels, the
 *      pending blob is consumed exactly once.
 *
 * Storage rules:
 *   - localStorage (not sessionStorage) so a Sign Up flow that opens
 *     a fresh tab for email verification still finds it.
 *   - Single key (`rowly:pendingSave`); a user can only have one
 *     pending result at a time. Starting a second tool overwrites it.
 *   - TTL of 24h — anything older is treated as stale and discarded.
 *     A pending save older than a day is almost certainly forgotten;
 *     resuming it after the user has moved on would feel haunted.
 *   - Defensive JSON parse; corrupt data is wiped on read.
 */

import type { ToolResult } from './toolResult';

const KEY = 'rowly:pendingSave';
const TTL_MS = 24 * 60 * 60 * 1000;

interface StoredEnvelope {
  v: 1;
  storedAt: number; // ms epoch
  /**
   * Original public-tool route (so the post-auth redirect lands the
   * user back where they were — keeps the result's context intact).
   */
  returnPath: string;
  result: ToolResult;
}

function safeWindow(): Window | null {
  return typeof window === 'undefined' ? null : window;
}

export function setPendingSave(result: ToolResult, returnPath: string): void {
  const w = safeWindow();
  if (!w) return;
  const envelope: StoredEnvelope = {
    v: 1,
    storedAt: Date.now(),
    returnPath,
    result,
  };
  try {
    w.localStorage.setItem(KEY, JSON.stringify(envelope));
  } catch {
    // Quota exceeded / Safari private mode — silently degrade. The
    // caller will simply see no resume after auth, and re-running the
    // calculation is cheap.
  }
}

/**
 * Read the stored envelope WITHOUT consuming it. Used by guards that
 * need to know "is there a pending save?" before deciding to redirect.
 */
export function peekPendingSave(): StoredEnvelope | null {
  const w = safeWindow();
  if (!w) return null;
  let raw: string | null = null;
  try {
    raw = w.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let env: StoredEnvelope;
  try {
    env = JSON.parse(raw) as StoredEnvelope;
  } catch {
    // Corrupt JSON — wipe and bail.
    try {
      w.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  if (env.v !== 1) {
    try {
      w.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  if (Date.now() - env.storedAt > TTL_MS) {
    try {
      w.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  return env;
}

/**
 * Read AND remove the envelope. Use this from the post-auth resume
 * site so the same pending save doesn't fire twice.
 */
export function consumePendingSave(): StoredEnvelope | null {
  const env = peekPendingSave();
  const w = safeWindow();
  if (!w) return env;
  try {
    w.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return env;
}

/**
 * Force-clear the pending save (e.g. user clicks "Cancel" on the
 * save modal). Idempotent.
 */
export function clearPendingSave(): void {
  const w = safeWindow();
  if (!w) return;
  try {
    w.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Test seam — the storage key is stable so vitest can wipe between cases. */
export const PENDING_SAVE_STORAGE_KEY = KEY;
