/**
 * MainLayout (logged-in app shell) ad-policy gate.
 *
 * Policy: the entire authenticated app must NEVER render ad slots. This
 * test imports the layout, renders it as if a logged-in user landed on
 * `/dashboard`, and asserts no `<ins class="adsbygoogle">` element exists.
 *
 * `PublicAdSlot` is route-gated so even if a developer drops it into
 * MainLayout by mistake, it would render as null on every authed
 * route — but this test fails fast if anyone bypasses the gate by
 * dropping a raw `<ins class="adsbygoogle">` into the shell.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { firstName: 'Sam', email: 's@example.com' },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock('../GlobalSearch', () => ({ default: () => null }));
vi.mock('../ThemeToggle', () => ({ default: () => null }));
vi.mock('../offline/SyncIndicator', () => ({ SyncIndicator: () => null }));
vi.mock('../offline/ConflictResolver', () => ({
  ConflictResolver: () => null,
  DataConflict: {},
}));
vi.mock('../help/PageHelp', () => ({ default: () => null }));
vi.mock('../quick-create/QuickCreate', () => ({ default: () => null }));
vi.mock('../tour/GuidedTour', () => ({ default: () => null }));

import MainLayout from './MainLayout';

describe('MainLayout — AdSense policy', () => {
  it('renders no ad-slot markup anywhere in the authenticated app shell', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('ins.adsbygoogle').length).toBe(0);
    expect(container.querySelectorAll('[data-testid="public-ad-slot"]').length).toBe(0);
  });
});
