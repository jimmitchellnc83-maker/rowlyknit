/**
 * FIFO request throttle — enforces a minimum interval between requests to
 * stay well under Ravelry's 600 req/hour limit. The exported singleton is
 * used by `ravelryService` so all OAuth calls share one queue regardless of
 * which user-scoped client issued them.
 *
 * Kept in its own module so unit tests can import `RequestThrottle` without
 * pulling in the DB / Redis / logger chain that `ravelryService` depends on.
 */
export class RequestThrottle {
  private lastRequestAt = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly minIntervalMs: number) {}

  acquire(): Promise<void> {
    const next = this.chain.then(async () => {
      const wait = Math.max(0, this.lastRequestAt + this.minIntervalMs - Date.now());
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastRequestAt = Date.now();
    });
    this.chain = next.catch(() => undefined);
    return next;
  }
}

// 2 req/sec = 500ms apart → ~120 req/min, comfortably below 600/hr.
export const ravelryThrottle = new RequestThrottle(500);
