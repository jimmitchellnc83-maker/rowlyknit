/**
 * Tab definitions for the PatternDetail page.
 *
 * Extracted so the URL-param → tab mapping is covered by a pure unit test
 * without dragging in the full PatternDetail component and its many
 * dependencies (react-query, modals, file uploads, …).
 *
 * The legacy `viewer` tab was retired in the polish sprint — Sources is
 * now the single PDF-first workspace. Old bookmark URLs that still say
 * `?tab=viewer` redirect to `sources` so users don't land on a 404 tab.
 */

export const PATTERN_DETAIL_TABS = [
  'overview',
  'charts',
  'sources',
  'tools',
  'feasibility',
] as const;

export type PatternDetailTab = typeof PATTERN_DETAIL_TABS[number];

/** Tab strings we still recognize for legacy redirect handling. */
const LEGACY_TAB_REDIRECTS: Record<string, PatternDetailTab> = {
  viewer: 'sources',
};

/**
 * Parse a raw `?tab=` query value into a known tab, falling back to
 * `overview` for null / unknown values. Recognized legacy tab names
 * (currently `viewer`) redirect to their replacement so old shared
 * URLs land on the right page instead of bouncing to overview.
 */
export function parsePatternDetailTab(raw: string | null): PatternDetailTab {
  if (PATTERN_DETAIL_TABS.includes(raw as PatternDetailTab)) {
    return raw as PatternDetailTab;
  }
  if (raw && LEGACY_TAB_REDIRECTS[raw]) {
    return LEGACY_TAB_REDIRECTS[raw];
  }
  return 'overview';
}
