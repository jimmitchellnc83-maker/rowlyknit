/**
 * Tri-state feasibility hygiene for Projects.tsx (Sprint 1, post-PR
 * #370–#373 audit, finding #9 + Sprint 2 finding #4 multi-pattern).
 *
 * The helper folds an optional `aggregates[]` and a query `loaded` flag
 * into the projectId-keyed map the UI consumes. While loading or
 * errored (`loaded === false`), the map MUST be empty regardless of
 * any stale data, so derived badges stay hidden until the query has
 * succeeded. This mirrors the Dashboard tri-state pattern PR #373
 * established and prevents the false-positive "project missing X"
 * regression from re-appearing here.
 *
 * Sprint 2 swapped the input from per-pattern `summaries` to per-project
 * `aggregates` so multi-pattern projects render a single worst-of badge.
 */

import { describe, expect, it } from 'vitest';
import { buildFeasibilityMap } from './Projects';

const aggregate = (
  projectId: string,
  status: 'green' | 'yellow' | 'red' = 'green',
  patternIds: string[] = ['pat-1'],
) => ({
  projectId,
  overallStatus: status,
  patternIds,
});

describe('buildFeasibilityMap', () => {
  it('returns an empty map when loaded=false even with aggregates present (loading w/ stale data)', () => {
    const map = buildFeasibilityMap([aggregate('p1'), aggregate('p2')], false);
    expect(map.size).toBe(0);
  });

  it('returns an empty map when loaded=false and aggregates is undefined', () => {
    const map = buildFeasibilityMap(undefined, false);
    expect(map.size).toBe(0);
  });

  it('fills the map keyed by projectId when loaded=true', () => {
    const map = buildFeasibilityMap(
      [aggregate('p1'), aggregate('p2', 'yellow', ['pat-2'])],
      true,
    );
    expect(map.size).toBe(2);
    expect(map.get('p1')?.overallStatus).toBe('green');
    expect(map.get('p1')?.patternIds).toEqual(['pat-1']);
    expect(map.get('p2')?.overallStatus).toBe('yellow');
    expect(map.get('p2')?.patternIds).toEqual(['pat-2']);
  });

  it('returns an empty map when loaded=true and aggregates is undefined', () => {
    const map = buildFeasibilityMap(undefined, true);
    expect(map.size).toBe(0);
  });

  it('returns an empty map when loaded=true and aggregates is empty (legitimate no-data state)', () => {
    const map = buildFeasibilityMap([], true);
    expect(map.size).toBe(0);
  });

  it('preserves the multi-pattern aggregate verdict (worst status applied server-side, the map just keys it)', () => {
    // Server returns one row per project with overallStatus already
    // computed as worst-of attached patterns. The map shouldn't change
    // that — it's just an ID-keyed lookup.
    const map = buildFeasibilityMap(
      [aggregate('multi', 'red', ['pat-a', 'pat-b'])],
      true,
    );
    const verdict = map.get('multi');
    expect(verdict?.overallStatus).toBe('red');
    expect(verdict?.patternIds).toEqual(['pat-a', 'pat-b']);
  });
});
