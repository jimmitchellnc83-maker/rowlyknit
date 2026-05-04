/**
 * Frontend feature-flag helpers.
 *
 * Reads VITE_* env vars at module load. Vite inlines these at build
 * time, so flipping a flag requires a rebuild — that's deliberate, the
 * goal here is "ship a preview surface in source without exposing it
 * in prod," not runtime A/B testing.
 */

const truthy = (v: string | undefined): boolean => {
  if (!v) return false;
  const norm = v.toLowerCase();
  return norm === '1' || norm === 'true' || norm === 'on' || norm === 'yes';
};

/** When true, `/patterns/:id/author` renders the canonical Author Mode
 *  preview. Default false: the route redirects to `/patterns/:id/make`
 *  (a sibling canonical-pattern surface that always exists for a valid
 *  pattern_models id) so normal users never land on the unfinished
 *  surface. Prod is OFF as of 2026-05-03 — flip back ON only after the
 *  chart editor / repeat-block editor / grading editor land. */
export const isDesignerAuthorModeEnabled = (): boolean =>
  truthy(import.meta.env.VITE_DESIGNER_AUTHOR_MODE);
