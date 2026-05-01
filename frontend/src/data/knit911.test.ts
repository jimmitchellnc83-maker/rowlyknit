import { describe, it, expect } from 'vitest';
import {
  KNIT911_TOPICS,
  KNIT911_CATEGORIES,
  getKnit911Topic,
  topicForSituation,
} from './knit911';

describe('KNIT911_TOPICS', () => {
  it('contains exactly 18 topics (the seed catalog from the roadmap)', () => {
    expect(KNIT911_TOPICS).toHaveLength(18);
  });

  it('every topic has unique slug, non-empty title / summary / body', () => {
    const slugs = new Set<string>();
    for (const t of KNIT911_TOPICS) {
      expect(slugs.has(t.slug)).toBe(false);
      slugs.add(t.slug);
      expect(t.title.length).toBeGreaterThan(5);
      expect(t.summary.length).toBeGreaterThan(10);
      expect(t.body.length).toBeGreaterThan(50);
    }
  });

  it('every topic uses a known category', () => {
    const ids = new Set(KNIT911_CATEGORIES.map((c) => c.id));
    for (const t of KNIT911_TOPICS) {
      expect(ids.has(t.category)).toBe(true);
    }
  });
});

describe('getKnit911Topic', () => {
  it('returns the matching topic by slug', () => {
    const t = getKnit911Topic('dropped-stitch')!;
    expect(t.title).toMatch(/dropped/i);
  });

  it('returns NULL for unknown slugs', () => {
    expect(getKnit911Topic('not-a-real-slug')).toBeNull();
  });
});

describe('topicForSituation', () => {
  it('routes "extra stitch" to extra-stitches', () => {
    expect(topicForSituation('I have an extra stitch on my needle')?.slug).toBe('extra-stitches');
  });

  it('routes "dropped" to dropped-stitch', () => {
    expect(topicForSituation('Dropped a stitch yesterday')?.slug).toBe('dropped-stitch');
  });

  it('routes "edges curling up" to curled-edges', () => {
    expect(topicForSituation('My edges keep curling up')?.slug).toBe('curled-edges');
  });

  it('routes a tension complaint to gauge-off', () => {
    expect(topicForSituation('My tension is way off')?.slug).toBe('gauge-off');
  });

  it('returns NULL for unrecognized situations', () => {
    expect(topicForSituation('asdfqwerty')).toBeNull();
  });

  it('returns NULL for non-string input', () => {
    expect(topicForSituation(null as any)).toBeNull();
    expect(topicForSituation(42 as any)).toBeNull();
  });
});
