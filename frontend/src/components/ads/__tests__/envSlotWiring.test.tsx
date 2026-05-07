/**
 * End-to-end env-var → rendered `<ins data-ad-slot>` proof.
 *
 * The H1 fix on PR #390 plumbs every page-level `<PublicAdSection />`
 * through `getAdSlotId(<tool>)`. This test mirrors what an operator
 * pasting a real numeric id into `VITE_ADSENSE_SLOT_GAUGE` should see:
 * the rendered `<ins>` carries the numeric id, NOT the
 * `rowly-gauge` placeholder.
 *
 * Without this test the dashboard's AdSense readiness card could go
 * green (it watches the env vars directly) while the frontend kept
 * shipping the placeholder, so slots would never fill in production.
 *
 * Why a test-only env-reader hook (instead of `vi.stubEnv`)?
 * Vitest 4 + Vite 7 give each module its own `import.meta.env` object,
 * so neither `vi.stubEnv` nor a direct mutation in the test file
 * propagates into `adsenseSlots.ts`. The
 * `__setEnvReaderForTests` hook is the same shape as the existing
 * `__resetAdSenseScriptInjectionForTests` escape hatch on
 * `useAdSenseScript`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicAdSection from '../PublicAdSection';
import {
  getAdSlotId,
  __setEnvReaderForTests,
  __resetEnvReaderForTests,
} from '../adsenseSlots';
import { __resetAdSenseScriptInjectionForTests } from '../useAdSenseScript';

beforeEach(() => {
  Array.from(document.querySelectorAll('script[src*="adsbygoogle.js"]')).forEach((s) =>
    s.parentNode?.removeChild(s),
  );
  __resetAdSenseScriptInjectionForTests();
  (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle = [];
});

afterEach(() => {
  __resetEnvReaderForTests();
});

function readSlotAttr(): string | null {
  const ins = document.querySelector('ins.adsbygoogle');
  return ins?.getAttribute('data-ad-slot') ?? null;
}

function fakeEnv(values: Record<string, string | undefined>): void {
  __setEnvReaderForTests((envName) => values[envName]);
}

describe('env-set numeric slot id reaches the rendered <ins data-ad-slot>', () => {
  it('with VITE_ADSENSE_SLOT_GAUGE set to a real numeric id, getAdSlotId returns it', () => {
    fakeEnv({ VITE_ADSENSE_SLOT_GAUGE: '1234567890' });
    expect(getAdSlotId('gauge')).toBe('1234567890');
  });

  it('renders the numeric id on /calculators/gauge when the env var is set', () => {
    fakeEnv({ VITE_ADSENSE_SLOT_GAUGE: '1234567890' });
    render(
      <MemoryRouter initialEntries={['/calculators/gauge']}>
        <PublicAdSection slot={getAdSlotId('gauge')} testId="env-wired" />
      </MemoryRouter>,
    );
    expect(readSlotAttr()).toBe('1234567890');
  });

  it('renders the rowly-gauge placeholder when no env var is set', () => {
    fakeEnv({});
    render(
      <MemoryRouter initialEntries={['/calculators/gauge']}>
        <PublicAdSection slot={getAdSlotId('gauge')} testId="placeholder" />
      </MemoryRouter>,
    );
    expect(readSlotAttr()).toBe('rowly-gauge');
  });

  it('rejects a non-numeric env value and keeps the placeholder', () => {
    fakeEnv({ VITE_ADSENSE_SLOT_GAUGE: 'pub-12345' });
    render(
      <MemoryRouter initialEntries={['/calculators/gauge']}>
        <PublicAdSection slot={getAdSlotId('gauge')} testId="garbage" />
      </MemoryRouter>,
    );
    expect(readSlotAttr()).toBe('rowly-gauge');
  });

  it('handles a real numeric id for the calculators-index tool too', () => {
    fakeEnv({ VITE_ADSENSE_SLOT_CALCULATORS_INDEX: '9876543210' });
    render(
      <MemoryRouter initialEntries={['/calculators']}>
        <PublicAdSection
          slot={getAdSlotId('calculators-index')}
          testId="env-wired-index"
        />
      </MemoryRouter>,
    );
    expect(readSlotAttr()).toBe('9876543210');
  });

  it('rejects too-short numeric values (5 digits)', () => {
    fakeEnv({ VITE_ADSENSE_SLOT_GAUGE: '12345' });
    expect(getAdSlotId('gauge')).toBe('rowly-gauge');
  });
});
