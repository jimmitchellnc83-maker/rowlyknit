/**
 * Fix #6 — AdSense script must NOT load on landing / auth / admin /
 * upgrade / app routes. It is injected lazily by `useAdSenseScript`
 * only when a `PublicAdSlot` mounts on an approved route with a real
 * (non-placeholder) slot id.
 *
 * The previous regime loaded the script via a static `<script>` tag in
 * `frontend/index.html` so every route paid for the third-party request.
 * We pin both halves of the new behaviour:
 *   1. `index.html` no longer ships the AdSense script tag.
 *   2. The component-level injector fires only on approved routes with
 *      a real slot id.
 */

import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicAdSlot from '../PublicAdSlot';
import { __resetAdSenseScriptInjectionForTests } from '../useAdSenseScript';

function countAdsbygoogleScripts(): number {
  return Array.from(document.querySelectorAll('script[src]')).filter((s) =>
    (s.getAttribute('src') ?? '').includes('adsbygoogle.js'),
  ).length;
}

beforeEach(() => {
  // Strip any prior script tag from a previous render.
  Array.from(document.querySelectorAll('script[src*="adsbygoogle.js"]')).forEach((s) =>
    s.parentNode?.removeChild(s),
  );
  // Reset module-level injection flag.
  __resetAdSenseScriptInjectionForTests();
  (window as any).adsbygoogle = [];
});

afterEach(() => {
  Array.from(document.querySelectorAll('script[src*="adsbygoogle.js"]')).forEach((s) =>
    s.parentNode?.removeChild(s),
  );
});

describe('AdSense script is NOT loaded site-wide via index.html', () => {
  it('frontend/index.html does not include the adsbygoogle.js <script> tag', () => {
    const idx = fs.readFileSync(
      path.resolve(__dirname, '../../../../index.html'),
      'utf8',
    );
    expect(idx).not.toMatch(/<script[^>]+adsbygoogle\.js/);
  });
});

describe('useAdSenseScript route-gating', () => {
  it('does NOT inject the script when rendering PublicAdSlot on the landing page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PublicAdSlot slot="1234567890" />
      </MemoryRouter>,
    );
    expect(countAdsbygoogleScripts()).toBe(0);
  });

  it('does NOT inject the script on /dashboard (authenticated app)', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <PublicAdSlot slot="1234567890" />
      </MemoryRouter>,
    );
    expect(countAdsbygoogleScripts()).toBe(0);
  });

  it('does NOT inject the script on /admin/business', () => {
    render(
      <MemoryRouter initialEntries={['/admin/business']}>
        <PublicAdSlot slot="1234567890" />
      </MemoryRouter>,
    );
    expect(countAdsbygoogleScripts()).toBe(0);
  });

  it('does NOT inject the script on /login or /upgrade', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <PublicAdSlot slot="1234567890" />
      </MemoryRouter>,
    );
    expect(countAdsbygoogleScripts()).toBe(0);

    __resetAdSenseScriptInjectionForTests();
    render(
      <MemoryRouter initialEntries={['/upgrade']}>
        <PublicAdSlot slot="1234567890" />
      </MemoryRouter>,
    );
    expect(countAdsbygoogleScripts()).toBe(0);
  });

  it('does NOT inject the script on an approved route when only a placeholder slot id is present', () => {
    render(
      <MemoryRouter initialEntries={['/calculators/gauge']}>
        <PublicAdSlot slot="rowly-gauge" />
      </MemoryRouter>,
    );
    expect(countAdsbygoogleScripts()).toBe(0);
  });

  it('DOES inject the script on /calculators/gauge with a real numeric slot id', () => {
    render(
      <MemoryRouter initialEntries={['/calculators/gauge']}>
        <PublicAdSlot slot="1234567890" />
      </MemoryRouter>,
    );
    expect(countAdsbygoogleScripts()).toBe(1);
    const tag = document.querySelector('script[src*="adsbygoogle.js"]') as HTMLScriptElement;
    expect(tag.async).toBe(true);
    expect(tag.crossOrigin).toBe('anonymous');
    expect(tag.src).toContain('client=ca-pub-9472587145183950');
  });

  it('DOES inject the script on /help/glossary with a real numeric slot id', () => {
    render(
      <MemoryRouter initialEntries={['/help/glossary']}>
        <PublicAdSlot slot="1234567890" />
      </MemoryRouter>,
    );
    expect(countAdsbygoogleScripts()).toBe(1);
  });

  it('does not double-inject when two PublicAdSlots render on the same approved route', () => {
    render(
      <MemoryRouter initialEntries={['/calculators']}>
        <>
          <PublicAdSlot slot="1234567890" />
          <PublicAdSlot slot="1234567891" />
        </>
      </MemoryRouter>,
    );
    expect(countAdsbygoogleScripts()).toBe(1);
  });
});
