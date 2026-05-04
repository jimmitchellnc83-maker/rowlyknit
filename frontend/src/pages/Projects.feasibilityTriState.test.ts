/**
 * Tri-state feasibility hygiene for Projects.tsx (Sprint 1, post-PR
 * #370–#373 audit, finding #9).
 *
 * The helper folds an optional `summaries[]` and a query `loaded` flag
 * into the projectId-keyed map the UI consumes. While loading or
 * errored (`loaded === false`), the map MUST be empty regardless of
 * any stale data, so derived badges stay hidden until the query has
 * succeeded. This mirrors the Dashboard tri-state pattern PR #373
 * established and prevents the false-positive "project missing X"
 * regression from re-appearing here.
 */

import { describe, expect, it } from 'vitest';
import { buildFeasibilityMap } from './Projects';

const summary = (projectId: string, patternId = 'pat-1') => ({
  projectId,
  patternId,
  overallStatus: 'green' as const,
});

describe('buildFeasibilityMap', () => {
  it('returns an empty map when loaded=false even with summaries present (loading w/ stale data)', () => {
    const map = buildFeasibilityMap([summary('p1'), summary('p2')], false);
    expect(map.size).toBe(0);
  });

  it('returns an empty map when loaded=false and summaries is undefined', () => {
    const map = buildFeasibilityMap(undefined, false);
    expect(map.size).toBe(0);
  });

  it('fills the map keyed by projectId when loaded=true', () => {
    const map = buildFeasibilityMap([summary('p1'), summary('p2', 'pat-2')], true);
    expect(map.size).toBe(2);
    expect(map.get('p1')?.patternId).toBe('pat-1');
    expect(map.get('p2')?.patternId).toBe('pat-2');
  });

  it('returns an empty map when loaded=true and summaries is undefined', () => {
    const map = buildFeasibilityMap(undefined, true);
    expect(map.size).toBe(0);
  });

  it('returns an empty map when loaded=true and summaries is empty (legitimate no-data state)', () => {
    const map = buildFeasibilityMap([], true);
    expect(map.size).toBe(0);
  });
});
