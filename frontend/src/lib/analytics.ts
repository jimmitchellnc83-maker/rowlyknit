// Plausible analytics integration. Lightweight, privacy-friendly, GDPR-safe
// (no cookies, no PII), self-hostable. Loads only when VITE_PLAUSIBLE_DOMAIN
// is set, so dev environments stay clean.
//
// In addition to Plausible, every `trackEvent` call also fires a
// best-effort POST to `/shared/analytics/event` so the founder business
// dashboard at `/admin/business` can read funnel + tool usage from the
// `usage_events` table directly. Plausible is fine for traffic
// dashboards, but the dashboard math should not depend on a third-party
// pixel that ad-blockers routinely strip.

type EventProps = Record<string, string | number | boolean>;

type PlausibleFn = (
  event: string,
  opts?: { props?: EventProps; callback?: () => void; u?: string }
) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn & { q?: unknown[] };
  }
}

const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const SRC =
  (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) ??
  'https://plausible.io/js/script.manual.js';

/**
 * Allowlist mirrored from
 * `backend/src/controllers/publicAnalyticsController.ts`. Calls with
 * names not in this set are still sent to Plausible (so existing custom
 * goals don't regress) but are NOT POSTed to the first-party endpoint
 * — the server would reject them anyway, no point burning the round
 * trip.
 */
const ROWLY_FIRST_PARTY_EVENTS: ReadonlySet<string> = new Set([
  'public_tool_viewed',
  'public_tool_used',
  'public_tool_result_generated',
  'save_to_rowly_clicked',
  'signup_started_from_public_tool',
  'upgrade_page_viewed',
  'upgrade_checkout_started',
  'upgrade_checkout_redirect_login',
  'checkout_started',
  'checkout_completed',
  'trial_started',
]);

let initialized = false;

export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined' || !DOMAIN) return;
  initialized = true;

  // Queue events fired before the script finishes loading.
  const queued: unknown[] = [];
  const stub = ((...args: unknown[]) => {
    queued.push(args);
  }) as PlausibleFn & { q?: unknown[] };
  stub.q = queued;
  window.plausible = stub;

  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = DOMAIN;
  script.src = SRC;
  document.head.appendChild(script);
}

export function trackPageview(): void {
  if (typeof window === 'undefined' || !window.plausible) return;
  window.plausible('pageview');
}

/**
 * Record an event. Fires Plausible (if loaded) and, when the event is on
 * the first-party allowlist, also POSTs to `/shared/analytics/event` so
 * `usage_events` reflects it. The first-party call uses
 * `navigator.sendBeacon` when available so the request survives a
 * navigation transition (e.g. clicking "Start trial" right after
 * tracking `upgrade_checkout_started`).
 */
export function trackEvent(name: string, props?: EventProps): void {
  if (typeof window === 'undefined') return;

  // Plausible: keeps the existing dashboard goals working unchanged.
  if (window.plausible) {
    window.plausible(name, props ? { props } : undefined);
  }

  // First-party: only fire for known dashboard events.
  if (!ROWLY_FIRST_PARTY_EVENTS.has(name)) return;
  recordRowlyEvent(name, props);
}

function recordRowlyEvent(name: string, props?: EventProps): void {
  if (typeof window === 'undefined') return;
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
    const url = `${apiBase}/shared/analytics/event`;
    const payload = JSON.stringify({
      eventName: name,
      metadata: props ?? {},
    });

    // Prefer sendBeacon for events that fire just before navigation —
    // it survives the page unload that a regular fetch would lose.
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      try {
        const blob = new Blob([payload], { type: 'application/json' });
        const sent = navigator.sendBeacon(url, blob);
        if (sent) return;
      } catch {
        // Fall through to fetch.
      }
    }

    // keepalive lets the request continue across an unload event the
    // way sendBeacon would.
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'include',
    }).catch(() => {
      // Telemetry failure must never surface to the user.
    });
  } catch {
    // Same — never throw out of an analytics call.
  }
}

/**
 * Test-only: returns the allowlist for the first-party endpoint. Lets a
 * unit test prove the FE allowlist matches the BE allowlist literally.
 */
export const __ROWLY_FIRST_PARTY_EVENTS_FOR_TESTS = ROWLY_FIRST_PARTY_EVENTS;
