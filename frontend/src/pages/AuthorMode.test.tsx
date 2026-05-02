/**
 * Tests for the Author Mode page — PR 5 of the Designer rebuild.
 *
 * Coverage focuses on the safety-net branches that are easy to verify
 * without standing up the full backend: the feature-flag gate and the
 * loading / error states. The happy-path edit flow is exercised
 * end-to-end via the preview verification workflow against a real
 * backend with a real canonical pattern row.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/usePatternModel', () => ({
  usePatternModel: vi.fn(),
  useUpdatePatternModel: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('../hooks/useSeo', () => ({
  useSeo: vi.fn(),
}));

import AuthorMode from './AuthorMode';
import { usePatternModel } from '../hooks/usePatternModel';

const renderRoute = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/patterns/abc/author']}>
        <Routes>
          <Route path="/patterns/:id/author" element={<AuthorMode />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('AuthorMode — loading + error', () => {
  it('shows a loading message while the pattern fetches', () => {
    vi.mocked(usePatternModel).mockReturnValue({ data: undefined, isLoading: true } as any);

    renderRoute();

    expect(screen.getByText(/loading pattern/i)).toBeInTheDocument();
  });

  it('shows the not-found state when the query errors', () => {
    vi.mocked(usePatternModel).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('404'),
    } as any);

    renderRoute();

    expect(screen.getByText(/pattern not found/i)).toBeInTheDocument();
  });
});

describe('AuthorMode — happy path render', () => {
  const samplePattern = {
    id: 'abc',
    userId: 'user-1',
    sourcePatternId: null,
    sourceProjectId: null,
    name: 'Test Sweater',
    craft: 'knit' as const,
    technique: 'cables' as const,
    gaugeProfile: { stitches: 20, rows: 28, measurement: 4, unit: 'in' as const },
    sizeSet: { active: 's1', sizes: [{ id: 's1', label: 'M', measurements: {} }] },
    sections: [
      {
        id: 'sec-body',
        name: 'Body',
        kind: 'sweater-body' as const,
        sortOrder: 0,
        parameters: {},
        chartPlacement: null,
        notes: null,
      },
      {
        id: 'sec-sleeve',
        name: 'Sleeve',
        kind: 'sweater-sleeve' as const,
        sortOrder: 1,
        parameters: {},
        chartPlacement: { chartId: 'chart-1', repeatMode: 'tile' as const },
        notes: 'Knit two of these',
      },
    ],
    legend: { overrides: {} },
    materials: [],
    progressState: {},
    notes: 'Initial notes',
    schemaVersion: 1,
    createdAt: '2026-04-28T00:00:00Z',
    updatedAt: '2026-04-28T00:00:00Z',
    deletedAt: null,
  };

  it('renders pattern metadata, sections, and gauge', () => {
vi.mocked(usePatternModel).mockReturnValue({
      data: samplePattern,
      isLoading: false,
    } as any);

    renderRoute();

    expect(screen.getByDisplayValue('Test Sweater')).toBeInTheDocument();
    expect(screen.getByText(/knit · cables/i)).toBeInTheDocument();
    expect(screen.getByText(/20 sts × 28 rows over 4 in/i)).toBeInTheDocument();
    expect(screen.getByText(/sections \(2\)/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Body')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sleeve')).toBeInTheDocument();
    expect(screen.getByText(/chart chart-1/i)).toBeInTheDocument();
  });

  it('does not render the US/UK toggle for knit patterns', () => {
vi.mocked(usePatternModel).mockReturnValue({
      data: samplePattern,
      isLoading: false,
    } as any);

    renderRoute();

    expect(screen.queryByRole('group', { name: /terminology dialect/i })).not.toBeInTheDocument();
  });

  it('renders the US/UK toggle for crochet patterns', () => {
vi.mocked(usePatternModel).mockReturnValue({
      data: { ...samplePattern, craft: 'crochet' },
      isLoading: false,
    } as any);

    renderRoute();

    expect(screen.getByRole('group', { name: /terminology dialect/i })).toBeInTheDocument();
  });
});
