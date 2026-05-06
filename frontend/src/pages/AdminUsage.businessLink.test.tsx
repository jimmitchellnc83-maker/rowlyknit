/**
 * Pin the AdminUsage → AdminBusiness link contract.
 *
 * The business command center is the founder's daily landing pane.
 * /admin/usage is a sister surface that pre-dates the dashboard and was
 * the only admin surface for a long time — without a discoverable link
 * the founder has to know the URL by heart. This test guards that link.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('axios');
vi.mock('../hooks/useSeo', () => ({ useSeo: () => undefined }));

import axios from 'axios';
import AdminUsage from './AdminUsage';

beforeEach(() => {
  const get = axios.get as unknown as ReturnType<typeof vi.fn>;
  get.mockImplementation(() =>
    Promise.resolve({ data: { success: true, data: { days: 14, summary: [] } } }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminUsage → AdminBusiness link', () => {
  it('renders a discoverable link to /admin/business with a 44px+ touch target', () => {
    render(
      <MemoryRouter initialEntries={['/admin/usage']}>
        <Routes>
          <Route path="/admin/usage" element={<AdminUsage />} />
        </Routes>
      </MemoryRouter>,
    );
    const link = screen.getByTestId('admin-business-link');
    expect(link.getAttribute('href')).toBe('/admin/business');
    // Touch target — feedback memory pins 44px minimum.
    expect(link.className).toMatch(/min-h-\[44px\]/);
  });
});
