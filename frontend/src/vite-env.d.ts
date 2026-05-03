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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
