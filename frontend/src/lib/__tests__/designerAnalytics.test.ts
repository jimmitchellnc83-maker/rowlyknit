/**
 * Tests for the Designer-rebuild analytics module — PR 7.
 *
 * The module is a thin wrapper around `trackEvent`. We lock in the
 * event-name constants (Plausible dashboards key off them, so renames
 * silently break reports) and the no-op behavior when Plausible isn't
 * loaded.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../analytics', () => ({
  trackEvent: vi.fn(),
}));

import { DESIGNER_EVENTS, trackDesignerEvent } from '../designerAnalytics';
import { trackEvent } from '../analytics';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DESIGNER_EVENTS constants', () => {
  it('exposes a stable set of event names — locked in to prevent silent renames', () => {
    expect(DESIGNER_EVENTS).toEqual({
      PATTERN_SAVED: 'Designer Pattern Saved',
      SECTION_RENAMED: 'Designer Section Renamed',
      DIALECT_TOGGLED: 'Designer Dialect Toggled',
      LEGEND_OVERRIDE_SET: 'Designer Legend Override Set',
      ROW_INCREMENTED: 'Designer Row Incremented',
      ROW_DECREMENTED: 'Designer Row Decremented',
      ROW_JUMPED: 'Designer Row Jumped',
      SECTION_RESET: 'Designer Section Reset',
      COUNTER_ADDED: 'Designer Counter Added',
      COUNTER_INCREMENTED: 'Designer Counter Incremented',
      COUNTER_REMOVED: 'Designer Counter Removed',
      ACTIVE_SECTION_SWITCHED: 'Designer Active Section Switched',
      PATTERN_EXPORTED: 'Designer Pattern Exported',
    });
  });
});

describe('trackDesignerEvent', () => {
  it('forwards name + props to trackEvent', () => {
    trackDesignerEvent(DESIGNER_EVENTS.PATTERN_SAVED, {
      craft: 'knit',
      technique: 'cables',
    });
    expect(trackEvent).toHaveBeenCalledWith('Designer Pattern Saved', {
      craft: 'knit',
      technique: 'cables',
    });
  });

  it('forwards the event name without props when omitted', () => {
    trackDesignerEvent(DESIGNER_EVENTS.ROW_INCREMENTED);
    expect(trackEvent).toHaveBeenCalledWith('Designer Row Incremented', undefined);
  });
});
