/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_PLAUSIBLE_DOMAIN?: string;
  readonly VITE_PLAUSIBLE_SRC?: string;
  /** When 'true', `/patterns/:id/author` renders the canonical Author
   *  Mode preview. Default (unset / any other value) redirects to the
   *  pattern detail page so we never expose the unfinished surface. */
  readonly VITE_DESIGNER_AUTHOR_MODE?: string;
  /** When 'true', `/patterns/:id/make` renders the canonical Make Mode
   *  and Pattern Detail shows an "Open in Make Mode" entry button for
   *  patterns with a canonical `pattern_models` twin. Default (unset /
   *  any other value): the route redirects to `/patterns` and the
   *  Pattern Detail entry button is hidden, so users only see surfaces
   *  backed by real data. */
  readonly VITE_DESIGNER_MAKE_MODE?: string;
  /** Comma-separated owner email allowlist for the entitlement gate.
   *  Mirrors the backend `OWNER_EMAIL` so frontend and backend agree
   *  on who skips the paywall. */
  readonly VITE_OWNER_EMAIL?: string;
  /** Pre-launch escape hatch — when 'true' the entitlement gate
   *  treats every logged-in user as entitled. Mirrors the backend
   *  `BILLING_PRE_LAUNCH_OPEN`. Production flips this off once the
   *  trial flow is live. */
  readonly VITE_BILLING_PRE_LAUNCH_OPEN?: string;
  /** AdSense ad-unit slot ids per approved public route. Vite bakes
   *  these into the JS bundle at build time, so changing them on the
   *  droplet without a frontend rebuild has NO effect. The backend
   *  reads the matching `ADSENSE_SLOT_<TOOL>` (no `VITE_` prefix)
   *  for the dashboard readiness check; both halves must be set to
   *  the SAME numeric ad-unit id provisioned in the AdSense
   *  dashboard. See `frontend/src/components/ads/adsenseSlots.ts`. */
  readonly VITE_ADSENSE_SLOT_CALCULATORS_INDEX?: string;
  readonly VITE_ADSENSE_SLOT_GAUGE?: string;
  readonly VITE_ADSENSE_SLOT_SIZE?: string;
  readonly VITE_ADSENSE_SLOT_YARDAGE?: string;
  readonly VITE_ADSENSE_SLOT_ROW_REPEAT?: string;
  readonly VITE_ADSENSE_SLOT_SHAPING?: string;
  readonly VITE_ADSENSE_SLOT_GLOSSARY?: string;
  readonly VITE_ADSENSE_SLOT_KNIT911?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
