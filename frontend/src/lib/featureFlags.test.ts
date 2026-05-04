/**
 * Feature flag helper tests. The helpers read `import.meta.env` at call
 * time, so each case stubs the env, calls the helper, then restores.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isDesignerAuthorModeEnabled,
  isDesignerMakeModeEnabled,
} from './featureFlags';

const originalEnv = { ...import.meta.env };

afterEach(() => {
  vi.unstubAllEnvs();
});

// originalEnv is captured for symmetry / future use (vi.unstubAllEnvs
// already restores everything stubbed via vi.stubEnv). Keep the import
// quiet without leaving dead variables.
void originalEnv;

describe('isDesignerMakeModeEnabled', () => {
  it.each(['true', 'TRUE', '1', 'on', 'yes', 'YES'])(
    'returns true for truthy value %s',
    (value) => {
      vi.stubEnv('VITE_DESIGNER_MAKE_MODE', value);
      expect(isDesignerMakeModeEnabled()).toBe(true);
    },
  );

  it.each(['', '0', 'false', 'no', 'off', 'maybe'])(
    'returns false for falsy/non-truthy value "%s"',
    (value) => {
      vi.stubEnv('VITE_DESIGNER_MAKE_MODE', value);
      expect(isDesignerMakeModeEnabled()).toBe(false);
    },
  );

  it('returns false when the env var is unset', () => {
    vi.stubEnv('VITE_DESIGNER_MAKE_MODE', undefined as unknown as string);
    expect(isDesignerMakeModeEnabled()).toBe(false);
  });

  it('does not leak into the Author Mode flag', () => {
    vi.stubEnv('VITE_DESIGNER_MAKE_MODE', '1');
    vi.stubEnv('VITE_DESIGNER_AUTHOR_MODE', '');
    expect(isDesignerMakeModeEnabled()).toBe(true);
    expect(isDesignerAuthorModeEnabled()).toBe(false);
  });
});

describe('isDesignerAuthorModeEnabled', () => {
  it('returns true for truthy value', () => {
    vi.stubEnv('VITE_DESIGNER_AUTHOR_MODE', 'true');
    expect(isDesignerAuthorModeEnabled()).toBe(true);
  });

  it('returns false when unset', () => {
    vi.stubEnv('VITE_DESIGNER_AUTHOR_MODE', undefined as unknown as string);
    expect(isDesignerAuthorModeEnabled()).toBe(false);
  });
});
