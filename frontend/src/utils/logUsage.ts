import axios from 'axios';

/**
 * Fire-and-forget usage event logger. Never throws, never blocks the caller.
 * Used to gather 2-week engagement data on pruning-candidate features.
 */
export function logUsage(
  eventName: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
): void {
  try {
    void axios
      .post('/api/usage-events', {
        eventName,
        entityId: entityId ?? null,
        metadata: metadata ?? undefined,
      })
      .catch(() => {
        /* logging must not break the feature */
      });
  } catch {
    /* synchronous failures (e.g. axios misconfig) are also swallowed */
  }
}
