/**
 * Designer-rebuild analytics events — PR 7 of the Designer rebuild.
 *
 * The PRD's "Analytics and learning system" section asks for instrumented
 * behavior so we can find where workflows still break down. This module
 * is the single source of truth for the event names + property shapes
 * the Author / Make / Designer surfaces emit. Plausible names are kept
 * stable from day 1 because dashboards key off them.
 *
 * Pattern: import `trackDesignerEvent('Designer Pattern Saved', { ... })`
 * from any consumer surface. Internally this delegates to `trackEvent`
 * from `analytics.ts` so the no-Plausible-loaded case stays a no-op.
 */

import { trackEvent } from './analytics';

/**
 * Canonical event names for the Designer rebuild. Keep stable — they
 * key Plausible dashboards. Pattern: "Designer <Surface> <Action>".
 */
export const DESIGNER_EVENTS = {
  // Author mode
  PATTERN_SAVED: 'Designer Pattern Saved',
  SECTION_RENAMED: 'Designer Section Renamed',
  DIALECT_TOGGLED: 'Designer Dialect Toggled',
  LEGEND_OVERRIDE_SET: 'Designer Legend Override Set',
  // Make mode
  ROW_INCREMENTED: 'Designer Row Incremented',
  ROW_DECREMENTED: 'Designer Row Decremented',
  ROW_JUMPED: 'Designer Row Jumped',
  SECTION_RESET: 'Designer Section Reset',
  COUNTER_ADDED: 'Designer Counter Added',
  COUNTER_INCREMENTED: 'Designer Counter Incremented',
  COUNTER_REMOVED: 'Designer Counter Removed',
  ACTIVE_SECTION_SWITCHED: 'Designer Active Section Switched',
  // Export
  PATTERN_EXPORTED: 'Designer Pattern Exported',
} as const;

export type DesignerEventName = (typeof DESIGNER_EVENTS)[keyof typeof DESIGNER_EVENTS];

interface CommonProps {
  craft?: 'knit' | 'crochet';
  technique?: string;
}

/**
 * Track a Designer-surface event. Properties are open-ended but
 * conventional keys: `craft`, `technique`, `sectionKind`, `format`,
 * `dialect`. Plausible's free tier limits prop cardinality so callers
 * should pass enums, not free-form strings.
 */
export function trackDesignerEvent(
  name: DesignerEventName,
  props?: CommonProps & Record<string, string | number | boolean>,
): void {
  trackEvent(name, props);
}
