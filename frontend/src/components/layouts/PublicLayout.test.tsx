import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicLayout from './PublicLayout';
import { useAuthStore } from '../../stores/authStore';

// PublicLayout wraps every public, indexable route (calculators, glossary,
// shared-project pages, etc.). The Tools link is a load-bearing piece of
// the public-tools-discovery contract — if a `hidden` class slips back in
// without a responsive override, mobile visitors lose the only nav path
// to /calculators.

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/calculators']}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/calculators" element={<div data-testid="outlet" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicLayout — public nav', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null, accessToken: null });
  });

  it('renders a Tools link to /calculators', () => {
    renderLayout();
    const nav = screen.getByRole('navigation', { name: /public/i });
    const toolsLink = within(nav).getByRole('link', { name: /^tools$/i });
    expect(toolsLink).toHaveAttribute('href', '/calculators');
  });

  it('Tools link is visible on mobile (no `hidden` without responsive override)', () => {
    renderLayout();
    const nav = screen.getByRole('navigation', { name: /public/i });
    const toolsLink = within(nav).getByRole('link', { name: /^tools$/i });
    const className = toolsLink.className;
    // The bug we are pinning: the previous "Calculators" link was
    // `hidden ... sm:inline`, which hid it entirely below the `sm`
    // breakpoint. Tools should not depend on any responsive utility
    // for visibility.
    expect(className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(className).not.toMatch(/sm:inline\b/);
    expect(className).not.toMatch(/sm:block\b/);
  });

  it('shows Sign up free for anonymous visitors', () => {
    renderLayout();
    expect(
      screen.getByRole('link', { name: /sign up free/i }),
    ).toHaveAttribute('href', '/register');
  });

  it('shows Open Dashboard when authenticated, hides Sign up', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B' } as any,
      accessToken: null,
    });
    renderLayout();
    expect(
      screen.getByRole('link', { name: /open dashboard/i }),
    ).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: /sign up free/i })).toBeNull();
  });

  it('keeps the Tools link visible when authenticated', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B' } as any,
      accessToken: null,
    });
    renderLayout();
    const nav = screen.getByRole('navigation', { name: /public/i });
    const toolsLink = within(nav).getByRole('link', { name: /^tools$/i });
    expect(toolsLink).toHaveAttribute('href', '/calculators');
  });
});
