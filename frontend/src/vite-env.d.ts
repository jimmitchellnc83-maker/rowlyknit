/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_PLAUSIBLE_DOMAIN?: string;
  readonly VITE_PLAUSIBLE_SRC?: string;
  /** Designer rebuild — opt-in flag for the canonical Author mode UI
   *  at `/patterns/:id/author`. Defaults to off; set to "1" or "true"
   *  in dev/staging to expose the route. */
  readonly VITE_DESIGNER_AUTHOR_MODE?: string;
  /** Designer rebuild — opt-in flag for Make mode at
   *  `/patterns/:id/make`. Independent of Author mode so each can roll
   *  out at its own cadence. */
  readonly VITE_DESIGNER_MAKE_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
