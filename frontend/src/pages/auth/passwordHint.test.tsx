/**
 * QA sprint 2026-05-04: backend password validator (utils/password.ts)
 * requires lowercase, uppercase, number, and a special character. The
 * Register hint used to read "letters, numbers, and a special character"
 * — omitting the uppercase requirement — and ResetPassword had no hint
 * at all. Both surfaces now carry the same explicit hint string. These
 * tests pin the wording so a future copy-edit can't silently drop the
 * uppercase clause and reintroduce the "registration mysteriously
 * failed" bug.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import ResetPassword from './ResetPassword';

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => vi.fn(),
}));

vi.mock('../../hooks/useNoIndex', () => ({
  useNoIndex: () => undefined,
}));

vi.mock('../../lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('Auth password hints match backend requirements', () => {
  it('Register hint mentions uppercase, lowercase, number, and special character', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );
    const hint = screen.getByText(/at least 8 characters/i);
    expect(hint.textContent).toMatch(/uppercase/i);
    expect(hint.textContent).toMatch(/lowercase/i);
    expect(hint.textContent).toMatch(/number/i);
    expect(hint.textContent).toMatch(/special character/i);
  });

  it('ResetPassword hint exists and lists the same four requirements', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc']}>
        <ResetPassword />
      </MemoryRouter>,
    );
    const hint = screen.getByText(/at least 8 characters/i);
    expect(hint.textContent).toMatch(/uppercase/i);
    expect(hint.textContent).toMatch(/lowercase/i);
    expect(hint.textContent).toMatch(/number/i);
    expect(hint.textContent).toMatch(/special character/i);
  });
});
