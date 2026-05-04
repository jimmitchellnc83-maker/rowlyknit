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

/** When true, `/patterns/:id/make` renders the canonical Make Mode and
 *  Pattern Detail + Project Detail both surface an "Open in Make Mode"
 *  entry button for any legacy pattern that has a canonical
 *  `pattern_models` twin. Default false: the route redirects to
 *  `/patterns` and entry buttons are hidden, so users only see surfaces
 *  that have a working data path. Redirect (vs NotFound) keeps a typed-
 *  URL bounce gentle and lands the user on a page that exists for them,
 *  mirroring the sibling redirect Author Mode does to `/patterns/:id/make`
 *  when its own flag is off.
 *
 *  Project Detail's "Open in Make Mode" CTA is the unified entry for any
 *  attached pattern with a canonical twin (single-pattern → direct link,
 *  multi-pattern → picker). The legacy "Resume Knitting" toggle is now
 *  the project-workspace surface (project-scoped counters / sessions /
 *  QuickKeys) and stays as a secondary action — and as the only entry
 *  for projects whose attached patterns are legacy-only. Canonical-only
 *  patterns reach `project_patterns` via a thin legacy stub materialized
 *  on attach (see `materializeLegacyStubForCanonical` in patternService).
 */
export const isDesignerMakeModeEnabled = (): boolean =>
  truthy(import.meta.env.VITE_DESIGNER_MAKE_MODE);
