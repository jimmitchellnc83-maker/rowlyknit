import { afterEach, describe, expect, it, vi } from 'vitest';

const setEnv = (value: string | undefined) => {
  // Vite's import.meta.env is writable in Vitest; assigning works.
  (import.meta.env as Record<string, unknown>).VITE_DESIGNER_AUTHOR_MODE = value;
};

afterEach(() => {
  vi.resetModules();
  setEnv(undefined);
});

describe('isDesignerAuthorModeEnabled', () => {
  it('returns false when the env var is unset', async () => {
    setEnv(undefined);
    const { isDesignerAuthorModeEnabled } = await import('../featureFlags');
    expect(isDesignerAuthorModeEnabled()).toBe(false);
  });

  it('returns false for the literal "false"', async () => {
    setEnv('false');
    const { isDesignerAuthorModeEnabled } = await import('../featureFlags');
    expect(isDesignerAuthorModeEnabled()).toBe(false);
  });

  it('returns true for "true", "1", "on", "yes" (case-insensitive)', async () => {
    for (const v of ['true', 'TRUE', '1', 'on', 'YES']) {
      setEnv(v);
      vi.resetModules();
      const { isDesignerAuthorModeEnabled } = await import('../featureFlags');
      expect(isDesignerAuthorModeEnabled()).toBe(true);
    }
  });

  it('returns false for unrecognized truthy-looking strings ("enabled", "x")', async () => {
    for (const v of ['enabled', 'x', 'why-not']) {
      setEnv(v);
      vi.resetModules();
      const { isDesignerAuthorModeEnabled } = await import('../featureFlags');
      expect(isDesignerAuthorModeEnabled()).toBe(false);
    }
  });
});
