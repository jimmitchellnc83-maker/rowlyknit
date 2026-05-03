/**
 * Targeted test for the PatternDetail "Tools" tab consolidation.
 *
 * After PR `claude/app-completion-sprint-2026-05-03`, the Tools tab
 * should:
 *  - NOT expose "Pattern Annotations" (PDF Workspace owns annotations)
 *  - NOT expose "Pattern Collation" (Patterns list owns multi-PDF collation)
 *  - Keep "Pattern page sections" with clearer copy + link to PDF Workspace
 *
 * The full PatternDetail page has a deep dependency tree; this test
 * mounts it with stubbed axios and react-toastify and only asserts the
 * Tools tab body.
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

import axios from 'axios';
import PatternDetail from './PatternDetail';

const renderTools = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/patterns/abc?tab=tools']}>
        <Routes>
          <Route path="/patterns/:id" element={<PatternDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /pattern tools/i })).toBeInTheDocument();
  });
  return view;
};

beforeEach(() => {
  const get = axios.get as unknown as ReturnType<typeof vi.fn>;
  get.mockImplementation((url: string) => {
    if (url === '/api/patterns/abc') {
      return Promise.resolve({
        data: { data: { pattern: { id: 'abc', name: 'Test', created_at: '2026-05-01' } } },
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PatternDetail — Tools tab consolidation', () => {
  it('renders only the page-sections tool, not annotations or collation', async () => {
    await renderTools();

    expect(
      screen.getByRole('heading', { name: /pattern page sections/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /manage page sections/i }),
    ).toBeInTheDocument();

    expect(screen.queryByText(/pattern annotations/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /add annotations/i })).toBeNull();
    expect(screen.queryByText(/pattern collation/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /collate pdfs/i })).toBeNull();
  });

  it('points users to the PDF Workspace tab for annotation work', async () => {
    await renderTools();

    // Two buttons match "PDF Workspace": the tab button and the inline
    // pointer in the consolidation hint copy. We only care that the
    // hint exists.
    const hintButtons = screen.getAllByRole('button', { name: /pdf workspace/i });
    expect(hintButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('uses a 44px+ touch target on the manage-sections button', async () => {
    await renderTools();
    const btn = screen.getByRole('button', { name: /manage page sections/i });
    expect(btn.className).toMatch(/min-h-\[44px\]/);
  });
});
