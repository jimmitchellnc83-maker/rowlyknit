import { describe, it, expect } from 'vitest';
import { parsePatternDetailTab, PATTERN_DETAIL_TABS } from './patternDetailTabs';

describe('parsePatternDetailTab', () => {
  it('returns overview for null input', () => {
    expect(parsePatternDetailTab(null)).toBe('overview');
  });

  it('returns overview for an empty string', () => {
    expect(parsePatternDetailTab('')).toBe('overview');
  });

  it('returns overview for an unknown tab name', () => {
    expect(parsePatternDetailTab('definitely-not-a-tab')).toBe('overview');
  });

  it('preserves each known tab value', () => {
    for (const tab of PATTERN_DETAIL_TABS) {
      expect(parsePatternDetailTab(tab)).toBe(tab);
    }
  });

  it('accepts feasibility (the tab that external links deep-link into)', () => {
    expect(parsePatternDetailTab('feasibility')).toBe('feasibility');
  });

  it('is case-sensitive — does not normalize mixed case', () => {
    // Deliberate: URL convention is lowercase; a mixed-case value is more
    // likely a typo than intentional.
    expect(parsePatternDetailTab('Feasibility')).toBe('overview');
  });

  it('redirects the retired viewer tab to sources so old bookmarks land somewhere useful', () => {
    expect(parsePatternDetailTab('viewer')).toBe('sources');
    // The redirected value is not in PATTERN_DETAIL_TABS, but parse
    // resolves it. PATTERN_DETAIL_TABS itself no longer contains
    // 'viewer' — it's purely a legacy URL hop.
    expect((PATTERN_DETAIL_TABS as readonly string[]).includes('viewer')).toBe(false);
  });
});
