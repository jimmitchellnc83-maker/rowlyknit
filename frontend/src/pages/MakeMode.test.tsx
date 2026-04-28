/**
 * Tests for the Make Mode page — PR 6 of the Designer rebuild.
 *
 * Coverage focuses on render branches that are easy to verify without
 * standing up the full backend: feature-flag gate, loading, error,
 * and the happy-path render with a sample pattern. Counter mutation
 * paths are unit-tested in `progressMath.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../utils/featureFlags', () => ({
  isMakeModeEnabled: vi.fn(),
  isAuthorModeEnabled: vi.fn(),
}));

vi.mock('../hooks/usePatternModel', () => ({
  usePatternModel: vi.fn(),
  useUpdatePatternModel: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  })),
}));

vi.mock('../hooks/useSeo', () => ({
  useSeo: vi.fn(),
}));

import MakeMode from './MakeMode';
import { isMakeModeEnabled } from '../utils/featureFlags';
import { usePatternModel, useUpdatePatternModel } from '../hooks/usePatternModel';

const renderRoute = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/patterns/abc/make']}>
        <Routes>
          <Route path="/patterns/:id/make" element={<MakeMode />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const samplePattern = {
  id: 'abc',
  userId: 'u',
  sourcePatternId: null,
  sourceProjectId: null,
  name: 'Cabled Sweater',
  craft: 'knit' as const,
  technique: 'cables' as const,
  gaugeProfile: { stitches: 20, rows: 28, measurement: 4, unit: 'in' as const },
  sizeSet: { active: 's', sizes: [{ id: 's', label: 'M', measurements: {} }] },
  sections: [
    {
      id: 'sec-body',
      name: 'Body',
      kind: 'sweater-body' as const,
      sortOrder: 0,
      parameters: { _totalRows: 120 },
      chartPlacement: null,
      notes: null,
    },
    {
      id: 'sec-sleeve',
      name: 'Sleeve',
      kind: 'sweater-sleeve' as const,
      sortOrder: 1,
      parameters: { _totalRows: 80 },
      chartPlacement: null,
      notes: null,
    },
  ],
  legend: { overrides: {} },
  materials: [],
  progressState: { rowsBySection: { 'sec-body': 30 }, activeSectionId: 'sec-body' },
  notes: null,
  schemaVersion: 1,
  createdAt: '2026-04-28T00:00:00Z',
  updatedAt: '2026-04-28T00:00:00Z',
  deletedAt: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('MakeMode — feature flag gate', () => {
  it('renders the disabled notice when the flag is off', () => {
    vi.mocked(isMakeModeEnabled).mockReturnValue(false);
    vi.mocked(usePatternModel).mockReturnValue({ data: undefined, isLoading: false } as any);
    renderRoute();
    expect(screen.getByText(/make mode is disabled/i)).toBeInTheDocument();
  });
});

describe('MakeMode — loading + error', () => {
  it('shows loading state while the pattern fetches', () => {
    vi.mocked(isMakeModeEnabled).mockReturnValue(true);
    vi.mocked(usePatternModel).mockReturnValue({ data: undefined, isLoading: true } as any);
    renderRoute();
    expect(screen.getByText(/loading pattern/i)).toBeInTheDocument();
  });

  it('shows the not-found state on error', () => {
    vi.mocked(isMakeModeEnabled).mockReturnValue(true);
    vi.mocked(usePatternModel).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('404'),
    } as any);
    renderRoute();
    expect(screen.getByText(/pattern not found/i)).toBeInTheDocument();
  });
});

describe('MakeMode — happy path', () => {
  it('renders pattern name + active section + counters panel', () => {
    vi.mocked(isMakeModeEnabled).mockReturnValue(true);
    vi.mocked(usePatternModel).mockReturnValue({
      data: samplePattern,
      isLoading: false,
    } as any);
    renderRoute();

    expect(screen.getByRole('heading', { name: /cabled sweater/i })).toBeInTheDocument();
    // Active section panel shows the big "30 / 120" — the picker shows
    // "Row 30 / 120" so we match both occurrences and just assert > 0.
    expect(screen.getAllByText(/\/\s*120/).length).toBeGreaterThan(0);
    // Section picker has both sections
    expect(screen.getAllByRole('button', { name: /Body|Sleeve/i }).length).toBeGreaterThan(0);
    // Counters panel renders even when empty
    expect(screen.getByRole('heading', { name: /linked counters/i })).toBeInTheDocument();
  });

  it('calls the mutation when +1 is clicked', () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdatePatternModel).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);
    vi.mocked(isMakeModeEnabled).mockReturnValue(true);
    vi.mocked(usePatternModel).mockReturnValue({
      data: samplePattern,
      isLoading: false,
    } as any);
    renderRoute();

    const inc = screen.getByRole('button', { name: /increment row/i });
    fireEvent.click(inc);
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'abc',
        patch: expect.objectContaining({
          progressState: expect.objectContaining({
            rowsBySection: expect.objectContaining({ 'sec-body': 31 }),
          }),
        }),
      }),
    );
  });

  it('disables +1 when the section is at total', () => {
    vi.mocked(isMakeModeEnabled).mockReturnValue(true);
    const atTotal = {
      ...samplePattern,
      progressState: { rowsBySection: { 'sec-body': 120 } },
    };
    vi.mocked(usePatternModel).mockReturnValue({ data: atTotal, isLoading: false } as any);
    renderRoute();

    const inc = screen.getByRole('button', { name: /increment row/i }) as HTMLButtonElement;
    expect(inc.disabled).toBe(true);
    expect(screen.getByText(/section complete/i)).toBeInTheDocument();
  });

  it('shows the "at the same time" panel when another section has progress', () => {
    vi.mocked(isMakeModeEnabled).mockReturnValue(true);
    const concurrent = {
      ...samplePattern,
      progressState: {
        rowsBySection: { 'sec-body': 30, 'sec-sleeve': 12 },
        activeSectionId: 'sec-body',
      },
    };
    vi.mocked(usePatternModel).mockReturnValue({ data: concurrent, isLoading: false } as any);
    renderRoute();

    expect(screen.getByText(/at the same time/i)).toBeInTheDocument();
    // Sleeve at row 12/80 appears in both the picker and the
    // concurrent panel — assert at least one match.
    expect(screen.getAllByText(/12.*\/\s*80/).length).toBeGreaterThan(0);
  });

  it('adds a new counter when the user submits a name', () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdatePatternModel).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);
    vi.mocked(isMakeModeEnabled).mockReturnValue(true);
    vi.mocked(usePatternModel).mockReturnValue({
      data: samplePattern,
      isLoading: false,
    } as any);
    renderRoute();

    const input = screen.getByPlaceholderText(/new counter name/i);
    fireEvent.change(input, { target: { value: 'Decreases' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({
          progressState: expect.objectContaining({
            counters: expect.objectContaining({ Decreases: 0 }),
          }),
        }),
      }),
    );
  });
});
