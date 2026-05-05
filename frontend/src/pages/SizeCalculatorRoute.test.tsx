/**
 * Auth + Launch Polish Sprint 2026-05-04 — Size Calculator route + SEO.
 *
 * Pins the post-rename contract:
 *
 *   1. The canonical route `/calculators/size` renders the calculator.
 *   2. The legacy alias `/calculators/gift-size` still renders the
 *      same calculator (backwards compatibility — sitemaps, inbound
 *      links, browser bookmarks).
 *   3. Both URLs emit a canonical link tag pointing at
 *      `/calculators/size` (the rename converges in search results).
 *   4. The CTA copy on the unauthenticated card no longer says the
 *      word &quot;free&quot; — Rowly is a paid app and the launch
 *      polish renamed the size calculator's CTA.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ isAuthenticated: false }),
}));

vi.mock('../hooks/useMeasurementPrefs', () => ({
  useMeasurementPrefs: () => ({
    prefs: {
      lengthDisplayUnit: 'in',
      yarnLengthDisplayUnit: 'yd',
      weightDisplayUnit: 'g',
      gaugeBase: '4in',
      gaugeDetail: 'per_base',
      needleSizeFormat: 'us',
      hookSizeFormat: 'us',
    },
  }),
}));

vi.mock('../lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import GiftSizeCalculator from './GiftSizeCalculator';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/calculators/size"
          element={<GiftSizeCalculator />}
        />
        <Route
          path="/calculators/gift-size"
          element={<GiftSizeCalculator />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // useSeo writes into <head> on each mount; reset between tests.
  document.head.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"], meta')
    .forEach((el) => el.remove());
});

afterEach(() => {
  document.head.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"], meta')
    .forEach((el) => el.remove());
});

describe('Size Calculator route + SEO contract', () => {
  it('renders at the canonical /calculators/size route', async () => {
    renderAt('/calculators/size');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: /knitting size calculator/i })).toBeInTheDocument();
  });

  it('still renders at the legacy /calculators/gift-size alias', async () => {
    renderAt('/calculators/gift-size');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: /knitting size calculator/i })).toBeInTheDocument();
  });

  it('emits a canonical link tag pointing at /calculators/size', async () => {
    renderAt('/calculators/size');
    await act(async () => {
      await Promise.resolve();
    });
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(canonical).not.toBeNull();
    expect(canonical!.href).toMatch(/\/calculators\/size$/);
    expect(canonical!.href).not.toMatch(/gift-size/);
  });

  it('emits the canonical /calculators/size link even when served from the legacy alias', async () => {
    // Prevents two-URL duplicate-content penalties: search engines see
    // /calculators/gift-size but follow the canonical hint to
    // /calculators/size.
    renderAt('/calculators/gift-size');
    await act(async () => {
      await Promise.resolve();
    });
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(canonical).not.toBeNull();
    expect(canonical!.href).toMatch(/\/calculators\/size$/);
  });

  it('the unauthenticated CTA uses Sprint 1 paid-app copy (no "free", trial language present)', async () => {
    renderAt('/calculators/size');
    await act(async () => {
      await Promise.resolve();
    });
    // Sprint 1 Public Tools Conversion — the CTA panel below the
    // result is now driven by SaveToRowlyCTA. The button reads "Create
    // a project from this size" and the surrounding copy mentions the
    // 30-day trial. The phrase "Sign up free" was on-strategy when
    // Rowly was free in early access; it no longer is.
    expect(
      screen.getByRole('button', { name: /create a project from this size/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/30-day trial/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign up free/i })).not.toBeInTheDocument();
  });

  it('emits WebApplication JSON-LD with url=/calculators/size', async () => {
    renderAt('/calculators/size');
    await act(async () => {
      await Promise.resolve();
    });
    const jsonLdScripts = Array.from(
      document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
    );
    const payloads = jsonLdScripts.map((s) => JSON.parse(s.text));
    const webApp = payloads.find((p) => p['@type'] === 'WebApplication');
    expect(webApp).toBeDefined();
    expect(webApp.url).toBe('https://rowlyknit.com/calculators/size');
  });
});
