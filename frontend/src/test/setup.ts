import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// First-party analytics events fire from many components on mount
// (`public_tool_viewed` etc.). The `analytics.ts` module's
// `recordRowlyEvent` falls back to fetch when sendBeacon isn't
// available, and happy-dom's fetch tries to reach a real localhost
// server in tests — which fails noisily as an unhandled rejection.
//
// Default-stub both transports site-wide so component tests don't
// emit network noise. Tests that assert on the analytics POST itself
// (see `lib/__tests__/analytics.test.ts`) override these spies.
//
// We DO NOT install these on `globalThis.fetch` so that test files that
// explicitly want to stub `fetch` (axios mock, etc.) keep working.
Object.defineProperty(window.navigator, 'sendBeacon', {
  configurable: true,
  writable: true,
  value: () => true,
});

const originalFetch = globalThis.fetch;
globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : (input as URL).toString();
  if (url.includes('/shared/analytics/event')) {
    // Telemetry stub — never hit the network in unit tests.
    return Promise.resolve(new Response(null, { status: 202 }));
  }
  // Defer to the original fetch (typically also stubbed by individual
  // tests) so unrelated network calls behave as the test expects.
  if (typeof originalFetch === 'function') return originalFetch(input as never, init);
  return Promise.reject(new Error(`Unhandled fetch in tests: ${url}`));
}) as typeof fetch;
