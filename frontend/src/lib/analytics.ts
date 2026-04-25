// Plausible analytics integration. Lightweight, privacy-friendly, GDPR-safe
// (no cookies, no PII), self-hostable. Loads only when VITE_PLAUSIBLE_DOMAIN
// is set, so dev environments stay clean.

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

export function trackEvent(name: string, props?: EventProps): void {
  if (typeof window === 'undefined' || !window.plausible) return;
  window.plausible(name, props ? { props } : undefined);
}
