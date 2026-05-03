/**
 * Tests for the Make Mode page — PR 6 of the Designer rebuild.
 *
 * Coverage focuses on render branches that are easy to verify without
 * standing up the full backend: feature-flag gate, loading, error,
 * and the happy-path render with a sample pattern. Counter mutation
 * paths are unit-tested in `progressMath.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

import MakeMode, { patchSectionTotalRows } from './MakeMode';
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

describe('MakeMode — loading + error', () => {
  it('shows loading state while the pattern fetches', () => {
    vi.mocked(usePatternModel).mockReturnValue({ data: undefined, isLoading: true } as any);
    renderRoute();
    expect(screen.getByText(/loading pattern/i)).toBeInTheDocument();
  });

  it('shows the not-found state on error', () => {
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

describe('MakeMode — total rows editing', () => {
  it('persists _totalRows via the sections patch when the user saves a new total', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdatePatternModel).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);
    vi.mocked(usePatternModel).mockReturnValue({
      data: samplePattern,
      isLoading: false,
    } as any);
    renderRoute();

    fireEvent.click(screen.getByRole('button', { name: /edit total \(120\)/i }));
    const input = screen.getByLabelText(/total rows for this section/i);
    fireEvent.change(input, { target: { value: '144' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());

    const sectionsCall = mutateAsync.mock.calls.find(
      ([arg]) => arg?.patch?.sections !== undefined,
    );
    expect(sectionsCall).toBeDefined();
    const sentSections = sectionsCall![0].patch.sections;
    const body = sentSections.find((s: any) => s.id === 'sec-body');
    expect(body.parameters._totalRows).toBe(144);
    // Existing parameters on other sections must be preserved.
    const sleeve = sentSections.find((s: any) => s.id === 'sec-sleeve');
    expect(sleeve.parameters._totalRows).toBe(80);
  });

  it('rejects an empty / non-positive total rows value with an inline error', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdatePatternModel).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);
    const noTotal = {
      ...samplePattern,
      sections: samplePattern.sections.map((s) =>
        s.id === 'sec-body' ? { ...s, parameters: {} } : s,
      ),
    };
    vi.mocked(usePatternModel).mockReturnValue({ data: noTotal, isLoading: false } as any);
    renderRoute();

    fireEvent.click(screen.getByRole('button', { name: /set total rows/i }));
    const input = screen.getByLabelText(/total rows for this section/i);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/greater than 0/i);
    expect(
      mutateAsync.mock.calls.find(([arg]) => arg?.patch?.sections !== undefined),
    ).toBeUndefined();
  });

  it('drops the legacy "Use Author mode" copy from the editor body', () => {
    vi.mocked(usePatternModel).mockReturnValue({
      data: samplePattern,
      isLoading: false,
    } as any);
    renderRoute();
    fireEvent.click(screen.getByRole('button', { name: /edit total \(120\)/i }));
    expect(screen.queryByText(/use author mode/i)).toBeNull();
  });
});

describe('MakeMode — touch targets', () => {
  it('applies min-h-[44px] to the frequent active-section controls', () => {
    vi.mocked(usePatternModel).mockReturnValue({
      data: samplePattern,
      isLoading: false,
    } as any);
    renderRoute();

    const ariaLabels = [
      /increment row/i,
      /decrement row/i,
      /reset section/i,
      /jump to row/i,
      /edit total \(120\)/i,
    ];
    for (const label of ariaLabels) {
      const btn = screen.getByRole('button', { name: label });
      expect(btn.className).toMatch(/min-h-\[(44|48|64)px\]/);
    }
  });

  it('applies min-h/min-w 44px to counter +/-/remove and the add controls', () => {
    const withCounters = {
      ...samplePattern,
      progressState: {
        ...samplePattern.progressState,
        counters: { Decreases: 4 },
      },
    };
    vi.mocked(usePatternModel).mockReturnValue({ data: withCounters, isLoading: false } as any);
    renderRoute();

    for (const label of [
      /increment decreases/i,
      /decrement decreases/i,
      /remove counter decreases/i,
    ]) {
      const btn = screen.getByRole('button', { name: label });
      expect(btn.className).toMatch(/min-h-\[44px\]/);
      expect(btn.className).toMatch(/min-w-\[44px\]/);
    }
    const addBtn = screen.getByRole('button', { name: /^add$/i });
    expect(addBtn.className).toMatch(/min-h-\[44px\]/);
    const newCounterInput = screen.getByPlaceholderText(/new counter name/i);
    expect(newCounterInput.className).toMatch(/min-h-\[44px\]/);
  });
});

describe('patchSectionTotalRows', () => {
  it('updates the matching section without losing other parameters', () => {
    const sections = [
      {
        id: 'a',
        name: 'A',
        kind: 'sweater-body' as const,
        sortOrder: 0,
        parameters: { _totalRows: 10, foo: 'bar' },
        chartPlacement: null,
        notes: null,
      },
      {
        id: 'b',
        name: 'B',
        kind: 'sweater-sleeve' as const,
        sortOrder: 1,
        parameters: { _totalRows: 5 },
        chartPlacement: null,
        notes: null,
      },
    ];
    const next = patchSectionTotalRows(sections, 'a', 22);
    expect(next[0].parameters._totalRows).toBe(22);
    expect(next[0].parameters.foo).toBe('bar');
    expect(next[1].parameters._totalRows).toBe(5);
    // input not mutated
    expect(sections[0].parameters._totalRows).toBe(10);
  });

  it('is a no-op when sectionId does not match', () => {
    const sections = [
      {
        id: 'a',
        name: 'A',
        kind: 'sweater-body' as const,
        sortOrder: 0,
        parameters: { _totalRows: 10 },
        chartPlacement: null,
        notes: null,
      },
    ];
    const next = patchSectionTotalRows(sections, 'missing', 99);
    expect(next).toEqual(sections);
  });

  it('seeds parameters when the existing section has no parameters object', () => {
    const sections = [
      {
        id: 'a',
        name: 'A',
        kind: 'sweater-body' as const,
        sortOrder: 0,
        parameters: undefined as unknown as Record<string, unknown>,
        chartPlacement: null,
        notes: null,
      },
    ];
    const next = patchSectionTotalRows(sections, 'a', 50);
    expect(next[0].parameters._totalRows).toBe(50);
  });
});

describe('MakeMode — section without parameters object', () => {
  it('does not crash when section.parameters is undefined (regression: PR #370 prod smoke)', () => {
    const pattern = {
      ...samplePattern,
      sections: [
        {
          id: 'sec-body',
          name: 'Body',
          kind: 'sweater-body' as const,
          sortOrder: 0,
          // canonical patterns created via the bare API (no parameters seeded)
          // used to crash totalRowsFor with `Cannot read properties of undefined`
          parameters: undefined as unknown as Record<string, unknown>,
          chartPlacement: null,
          notes: null,
        },
      ],
    };
    vi.mocked(usePatternModel).mockReturnValue({
      data: pattern,
      isLoading: false,
    } as any);
    expect(() => renderRoute()).not.toThrow();
    expect(screen.getAllByText('Body').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Set total rows/i })).toBeInTheDocument();
  });
});
