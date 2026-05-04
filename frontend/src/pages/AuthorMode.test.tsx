/**
 * Tests for the Author Mode page — PR 5 of the Designer rebuild.
 *
 * Coverage focuses on the safety-net branches that are easy to verify
 * without standing up the full backend: the feature-flag gate and the
 * loading / error states. The happy-path edit flow is exercised
 * end-to-end via the preview verification workflow against a real
 * backend with a real canonical pattern row.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/usePatternModel', () => ({
  usePatternModel: vi.fn(),
  useUpdatePatternModel: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('../hooks/useSeo', () => ({
  useSeo: vi.fn(),
}));

vi.mock('../lib/featureFlags', () => ({
  isDesignerAuthorModeEnabled: vi.fn(() => true),
}));

import AuthorMode from './AuthorMode';
import { usePatternModel } from '../hooks/usePatternModel';
import { isDesignerAuthorModeEnabled } from '../lib/featureFlags';

const renderRoute = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/patterns/abc/author']}>
        <Routes>
          <Route path="/patterns/:id/author" element={<AuthorMode />} />
          <Route path="/patterns/:id/make" element={<div>make-mode</div>} />
          <Route path="/patterns/:id" element={<div>pattern-detail</div>} />
          <Route path="/patterns" element={<div>patterns-list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.mocked(isDesignerAuthorModeEnabled).mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AuthorMode — flag gate', () => {
  it('redirects to /patterns/:id/make (the canonical-pattern surface) when the flag is off', () => {
    vi.mocked(isDesignerAuthorModeEnabled).mockReturnValue(false);
    vi.mocked(usePatternModel).mockReturnValue({ data: undefined, isLoading: false } as any);

    renderRoute();

    expect(screen.getByText('make-mode')).toBeInTheDocument();
    // Hooks for the inner impl should not have run when the gate redirects.
    expect(usePatternModel).not.toHaveBeenCalled();
  });
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

// ---------------------------------------------------------------------------
// Regression test for the SectionsEditor sorted-vs-unsorted index bug
// (Sprint 1, post-PR #370–#373 audit, finding #3).
//
// Before the fix, `updateSection(idx, patch)` consumed the index from
// `sortedSections.map`, but `sections.map((s, i) => i === idx ? ... : s)`
// iterated the unsorted array. When sortOrder diverged from array order,
// editing the visually-first section silently mutated a different one.
// ---------------------------------------------------------------------------

describe('AuthorMode — SectionsEditor edits the right section when sortOrder ≠ array order', () => {
  it('mutates the correct section when sections are stored out of array order', async () => {
    // `sections[0]` is "Sleeve" (sortOrder 1) — but the user sees "Body"
    // (sortOrder 0) at the TOP of the rendered list because the editor
    // sorts by sortOrder. Editing the visually-first ("Body") input must
    // mutate the Body section, NOT sections[0] (which is Sleeve).
    const reorderedPattern = {
      id: 'abc',
      userId: 'u',
      sourcePatternId: null,
      sourceProjectId: null,
      name: 'Test Sweater',
      craft: 'knit' as const,
      technique: 'standard' as const,
      gaugeProfile: { stitches: 20, rows: 28, measurement: 4, unit: 'in' as const },
      sizeSet: { active: 's', sizes: [{ id: 's', label: 'M', measurements: {} }] },
      sections: [
        {
          id: 'sec-sleeve',
          name: 'Sleeve',
          kind: 'sweater-sleeve' as const,
          sortOrder: 1,
          parameters: {},
          chartPlacement: null,
          notes: null,
        },
        {
          id: 'sec-body',
          name: 'Body',
          kind: 'sweater-body' as const,
          sortOrder: 0,
          parameters: {},
          chartPlacement: null,
          notes: null,
        },
      ],
      legend: { overrides: {} },
      materials: [],
      progressState: {},
      notes: null,
      schemaVersion: 1,
      createdAt: '2026-04-28T00:00:00Z',
      updatedAt: '2026-04-28T00:00:00Z',
      deletedAt: null,
    };

    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    const { useUpdatePatternModel } = await import('../hooks/usePatternModel');
    vi.mocked(useUpdatePatternModel).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);
    vi.mocked(usePatternModel).mockReturnValue({
      data: reorderedPattern,
      isLoading: false,
    } as any);

    renderRoute();

    // The visually-first input (sortOrder 0 = Body). Inputs are name fields.
    const bodyInput = screen.getByDisplayValue('Body');
    fireEvent.change(bodyInput, { target: { value: 'Body — renamed' } });

    // Click Save and assert the patch mutated Body, NOT Sleeve.
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const patchArg = mutateAsync.mock.calls[0][0];
    expect(patchArg.id).toBe('abc');
    const patchedSections = patchArg.patch.sections as Array<{
      id: string;
      name: string;
    }>;

    // The section identified as `sec-body` MUST carry the new name. The
    // pre-fix bug would have rewritten `sec-sleeve.name` instead because
    // it sat at array index 0 (the same index "Body" had in sorted view).
    const bodyAfter = patchedSections.find((s) => s.id === 'sec-body');
    const sleeveAfter = patchedSections.find((s) => s.id === 'sec-sleeve');
    expect(bodyAfter?.name).toBe('Body — renamed');
    expect(sleeveAfter?.name).toBe('Sleeve');
  });
});
