/**
 * Feature flag helpers — PR 5 of the Designer rebuild.
 *
 * Frontend feature flags are simple env vars sourced via
 * `import.meta.env.VITE_*`. Each flag has a tiny named helper here so
 * the rest of the app reads `isFooEnabled()` instead of remembering
 * which env var maps to which feature.
 *
 * Truthy values: "1", "true", "on", "yes" (case-insensitive).
 * Anything else (including unset / empty) is false.
 */

const TRUTHY = new Set(['1', 'true', 'on', 'yes']);

const isTruthy = (v: string | undefined): boolean => {
  if (!v) return false;
  return TRUTHY.has(v.trim().toLowerCase());
};

/**
 * Author mode preview at `/patterns/:id/author`. Off by default; set
 * `VITE_DESIGNER_AUTHOR_MODE=1` to expose the route.
 */
export function isAuthorModeEnabled(): boolean {
  return isTruthy(import.meta.env.VITE_DESIGNER_AUTHOR_MODE);
}

/**
 * Make mode at `/patterns/:id/make`. Off by default; set
 * `VITE_DESIGNER_MAKE_MODE=1` to expose the route. Independent of
 * Author mode so each can roll out at its own cadence.
 */
export function isMakeModeEnabled(): boolean {
  return isTruthy(import.meta.env.VITE_DESIGNER_MAKE_MODE);
}
