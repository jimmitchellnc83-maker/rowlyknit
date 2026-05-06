/**
 * Tests for the AdSense slot configuration helpers.
 *
 * Real AdSense slot ids are 10-digit numeric strings issued by Google.
 * Until the operator provisions them, every call site falls back to a
 * `rowly-<tool>` placeholder. The dashboard treats the placeholders as
 * "not configured" so it can't go green prematurely.
 */

import {
  ADSENSE_SLOT_ENV_BY_TOOL,
  buildSlotConfigReport,
  allAdSenseSlotsConfigured,
  isAdSenseSlotConfigured,
} from '../adsenseSlots';

const ALL_ENVS = Object.values(ADSENSE_SLOT_ENV_BY_TOOL);
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ALL_ENVS) {
    original[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ALL_ENVS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe('isAdSenseSlotConfigured', () => {
  it('returns false for an unset env var', () => {
    expect(isAdSenseSlotConfigured('ADSENSE_SLOT_GAUGE')).toBe(false);
  });

  it('returns false for an empty string', () => {
    process.env.ADSENSE_SLOT_GAUGE = '';
    expect(isAdSenseSlotConfigured('ADSENSE_SLOT_GAUGE')).toBe(false);
  });

  it('returns false for a `rowly-*` placeholder', () => {
    process.env.ADSENSE_SLOT_GAUGE = 'rowly-gauge';
    expect(isAdSenseSlotConfigured('ADSENSE_SLOT_GAUGE')).toBe(false);
  });

  it('returns false for a non-numeric value', () => {
    process.env.ADSENSE_SLOT_GAUGE = 'abc-123';
    expect(isAdSenseSlotConfigured('ADSENSE_SLOT_GAUGE')).toBe(false);
  });

  it('returns false for too few digits (< 6)', () => {
    process.env.ADSENSE_SLOT_GAUGE = '12345';
    expect(isAdSenseSlotConfigured('ADSENSE_SLOT_GAUGE')).toBe(false);
  });

  it('returns true for a real-shaped 10-digit numeric id', () => {
    process.env.ADSENSE_SLOT_GAUGE = '1234567890';
    expect(isAdSenseSlotConfigured('ADSENSE_SLOT_GAUGE')).toBe(true);
  });

  it('trims whitespace before validation', () => {
    process.env.ADSENSE_SLOT_GAUGE = '  1234567890  ';
    expect(isAdSenseSlotConfigured('ADSENSE_SLOT_GAUGE')).toBe(true);
  });
});

describe('buildSlotConfigReport', () => {
  it('reports every approved tool, configured=false when none are set', () => {
    const report = buildSlotConfigReport();
    expect(report.length).toBe(ALL_ENVS.length);
    for (const r of report) {
      expect(r.configured).toBe(false);
      expect(r.value).toBeNull();
      expect(typeof r.envName).toBe('string');
    }
  });

  it('reports configured=true only for tools whose env var is real', () => {
    process.env.ADSENSE_SLOT_GAUGE = '1234567890';
    process.env.ADSENSE_SLOT_KNIT911 = 'rowly-knit911';
    const report = buildSlotConfigReport();
    const gauge = report.find((r) => r.tool === 'gauge')!;
    const knit911 = report.find((r) => r.tool === 'knit911')!;
    expect(gauge.configured).toBe(true);
    expect(gauge.value).toBe('1234567890');
    expect(knit911.configured).toBe(false);
    expect(knit911.value).toBe('rowly-knit911');
  });
});

describe('allAdSenseSlotsConfigured', () => {
  it('returns false when no env vars are set', () => {
    expect(allAdSenseSlotsConfigured()).toBe(false);
  });

  it('returns false when any one slot is still a placeholder', () => {
    for (const env of ALL_ENVS) {
      process.env[env] = '1234567890';
    }
    process.env.ADSENSE_SLOT_GAUGE = 'rowly-gauge';
    expect(allAdSenseSlotsConfigured()).toBe(false);
  });

  it('returns true when every slot has a real numeric id', () => {
    let n = 1000000;
    for (const env of ALL_ENVS) {
      process.env[env] = String(n++);
    }
    expect(allAdSenseSlotsConfigured()).toBe(true);
  });
});
