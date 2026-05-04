/**
 * Make Mode entry button tests for PatternDetail.
 *
 * Sprint 1 of the post-PR #370–#373 seam fix: PatternDetail surfaces an
 * "Open in Make Mode" Link for any legacy pattern that has a canonical
 * `pattern_models` twin AND while the `VITE_DESIGNER_MAKE_MODE` flag is
 * on. Without both conditions the button must NOT render — dead links
 * are explicitly out of scope for this PR.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('axios');
vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('../components/source-files/SourceFilesPanel', () => ({
  default: () => <div data-testid="source-files-panel" />,
}));
vi.mock('../components/charts', () => ({
  ChartImageUpload: () => <div data-testid="chart-image-upload" />,
}));
vi.mock('../components/patterns/BookmarkManager', () => ({
  default: () => <div data-testid="bookmark-manager" />,
}));
vi.mock('../components/patterns/FeasibilityPanel', () => ({
  default: () => <div data-testid="feasibility-panel" />,
}));
vi.mock('../components/PatternFileUpload', () => ({
  default: () => <div data-testid="pattern-file-upload" />,
}));
vi.mock('../components/designer/DesignCard', () => ({
  default: () => <div data-testid="design-card" />,
}));
vi.mock('../components/patterns/MadeByChip', () => ({
  default: () => null,
}));
vi.mock('../components/patterns/ComplexityBadge', () => ({
  default: () => null,
}));
vi.mock('../components/LoadingSpinner', () => ({
  default: () => <div>loading-spinner</div>,
  LoadingSkeleton: () => null,
  ErrorState: () => null,
  LoadingCardGrid: () => null,
}));
vi.mock('../lib/featureFlags', () => ({
  isDesignerMakeModeEnabled: vi.fn(() => true),
}));

import axios from 'axios';
import PatternDetail from './PatternDetail';
import { isDesignerMakeModeEnabled } from '../lib/featureFlags';

const renderDetail = async (patternOverrides: Record<string, unknown>) => {
  const get = axios.get as unknown as ReturnType<typeof vi.fn>;
  get.mockImplementation((url: string) => {
    if (url === '/api/patterns/abc') {
      return Promise.resolve({
        data: {
          data: {
            pattern: {
              id: 'abc',
              name: 'Test Pattern',
              created_at: '2026-05-01',
              ...patternOverrides,
            },
          },
        },
      });
    }
    if (url === '/api/uploads/patterns/abc/files') {
      return Promise.resolve({ data: { data: { files: [] } } });
    }
    if (url === '/api/patterns/abc/charts') {
      return Promise.resolve({ data: { data: { charts: [] } } });
    }
    return Promise.resolve({ data: { data: {} } });
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/patterns/abc']}>
        <Routes>
          <Route path="/patterns/:id" element={<PatternDetail />} />
          <Route path="/patterns/:id/make" element={<div>make-mode-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /test pattern/i })).toBeInTheDocument();
  });
  return view;
};

beforeEach(() => {
  vi.mocked(isDesignerMakeModeEnabled).mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PatternDetail — canonical Make Mode entry button', () => {
  it('renders the entry Link to the canonical id when flag is on AND twin exists', async () => {
    await renderDetail({ canonicalPatternModelId: 'twin-uuid-1' });

    const link = screen.getByTestId('open-canonical-make-mode');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent(/open in make mode/i);
    expect(link.getAttribute('href')).toBe('/patterns/twin-uuid-1/make');
  });

  it('does NOT render the entry button when canonicalPatternModelId is null (no twin)', async () => {
    await renderDetail({ canonicalPatternModelId: null });
    expect(screen.queryByTestId('open-canonical-make-mode')).toBeNull();
  });

  it('does NOT render the entry button when canonicalPatternModelId is missing entirely', async () => {
    await renderDetail({});
    expect(screen.queryByTestId('open-canonical-make-mode')).toBeNull();
  });

  it('does NOT render the entry button when the flag is off, even with a twin', async () => {
    vi.mocked(isDesignerMakeModeEnabled).mockReturnValue(false);
    await renderDetail({ canonicalPatternModelId: 'twin-uuid-1' });
    expect(screen.queryByTestId('open-canonical-make-mode')).toBeNull();
  });
});
