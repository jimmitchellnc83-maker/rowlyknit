/**
 * Verifies that Projects, Patterns, and YarnStash auto-open their
 * "create" modal when the user lands with `?new=1`. This is the
 * Dashboard quick-action bridge — when it breaks, the user clicks
 * "New Project" on the Dashboard and lands on a list page with no
 * obvious next step.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('axios');
vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  ToastContainer: () => null,
}));

vi.mock('../hooks/useApi', () => ({
  useProjects: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateProject: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProject: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  usePatterns: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreatePattern: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePattern: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePattern: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useYarn: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateYarn: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateYarn: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteYarn: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    ...actual,
    useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  };
});

vi.mock('../hooks/useUndoableDelete', () => ({
  useUndoableDelete: () => ({ execute: vi.fn() }),
}));

vi.mock('../hooks/useMeasurementPrefs', () => ({
  useMeasurementPrefs: () => ({
    fmt: { yarnLength: () => '0' },
    labels: { yardageShort: 'yd' },
    prefs: {},
  }),
}));

vi.mock('../components/PageHelpButton', () => ({ default: () => null }));
vi.mock('../components/ListControls', () => ({
  default: () => null,
  applyListControls: (rows: unknown[]) => rows,
}));
vi.mock('../components/LoadingSpinner', () => ({
  default: () => null,
  LoadingSkeleton: () => null,
  ErrorState: () => null,
  LoadingCardGrid: () => null,
}));
vi.mock('../components/RavelryYarnSearch', () => ({ default: () => null }));
vi.mock('../components/RavelryPatternSearch', () => ({ default: () => null }));
vi.mock('../components/yarn/StashValueCard', () => ({ default: () => null }));
vi.mock('../components/yarn/YarnLabelCapture', () => ({ default: () => null }));
vi.mock('../components/yarn/CareSymbolPicker', () => ({ default: () => null }));
vi.mock('../components/forms/CollapsibleSection', () => ({ default: () => null }));
vi.mock('../components/forms/FileUploadField', () => ({ default: () => null }));
vi.mock('../components/HelpTooltip', () => ({ default: () => null }));
vi.mock('../components/ConfirmModal', () => ({ default: () => null }));
vi.mock('../components/patterns', () => ({ PDFCollation: () => null }));

import axios from 'axios';
import Projects from './Projects';
import Patterns from './Patterns';
import YarnStash from './YarnStash';

const renderAt = (Component: React.ComponentType, path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Component />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  const get = axios.get as unknown as ReturnType<typeof vi.fn>;
  get.mockResolvedValue({ data: { data: { projectTypes: [] } } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('?new=1 auto-opens the create modal', () => {
  it('opens the Projects create modal', async () => {
    renderAt(Projects, '/projects?new=1');
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('opens the Patterns create modal', async () => {
    renderAt(Patterns, '/patterns?new=1');
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('opens the YarnStash create modal', async () => {
    renderAt(YarnStash, '/yarn?new=1');
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
