/**
 * Tab definitions for the PatternDetail page.
 *
 * Extracted so the URL-param → tab mapping is covered by a pure unit test
 * without dragging in the full PatternDetail component and its many
 * dependencies (react-query, modals, file uploads, …).
 */

export const PATTERN_DETAIL_TABS = [
  'overview',
  'viewer',
  'charts',
  'tools',
  'feasibility',
] as const;

export type PatternDetailTab = typeof PATTERN_DETAIL_TABS[number];

/**
 * Parse a raw `?tab=` query value into a known tab, falling back to
 * `overview` for null / unknown values. Keeps the page stable when an
 * invalid tab reaches the URL (e.g. a deprecated tab name in an old
 * bookmark).
 */
export function parsePatternDetailTab(raw: string | null): PatternDetailTab {
  return PATTERN_DETAIL_TABS.includes(raw as PatternDetailTab)
    ? (raw as PatternDetailTab)
    : 'overview';
}
