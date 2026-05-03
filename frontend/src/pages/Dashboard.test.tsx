/**
 * Dashboard command-center tests.
 *
 * The Dashboard pulls a lot of pieces — auth store, stats query, low-stock
 * yarn, onboarding goal, feasibility summary. We mock at the boundary
 * (axios + the dashboard hook) so we can assert the new command-center
 * behaviors: quick actions hit `?new=1`, the Continue area surfaces
 * active projects, and copy includes both crafts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('axios');

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ user: { firstName: 'Sam' }, isAuthenticated: true }),
}));

vi.mock('../hooks/useApi', () => ({
  useDashboardStats: vi.fn(),
}));

vi.mock('../hooks/useMeasurementPrefs', () => ({
  useMeasurementPrefs: () => ({
    fmt: { yarnLength: () => '0' },
    labels: { yardageShort: 'yd' },
    prefs: {},
  }),
}));

vi.mock('../components/CmdKTooltip', () => ({ default: () => null }));
vi.mock('../components/cyc/CycEventBanner', () => ({ default: () => null }));
vi.mock('../components/dashboard/OnboardingGoalCard', () => ({
  default: () => null,
}));
vi.mock('../components/LoadingSpinner', () => ({
  LoadingSkeleton: () => null,
  ErrorState: () => null,
}));

import axios from 'axios';
import Dashboard from './Dashboard';
import { useDashboardStats } from '../hooks/useApi';

const renderDashboard = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  // No-pattern projects → setup gap appears.
  const get = axios.get as unknown as ReturnType<typeof vi.fn>;
  get.mockImplementation((url: string) => {
    if (url === '/api/users/me/examples') {
      // Skip onboarding card — return a goal so we render the main UI.
      return Promise.resolve({ data: { data: { onboardingGoal: 'track_project' } } });
    }
    if (url === '/api/projects/feasibility-summary') {
      return Promise.resolve({
        data: { data: { summaries: [{ projectId: 'p2', patternId: 'pat-1' }] } },
      });
    }
    return Promise.resolve({ data: { data: {} } });
  });

  vi.mocked(useDashboardStats).mockReturnValue({
    data: {
      stats: [
        { name: 'Active Projects', value: '3', iconName: 'FiFolder', href: '/projects', color: 'bg-purple-500' },
        { name: 'Patterns', value: '12', iconName: 'FiBook', href: '/patterns', color: 'bg-blue-500' },
        { name: 'Yarn Skeins', value: '42', iconName: 'FiPackage', href: '/yarn', color: 'bg-green-500' },
        { name: 'Recipients', value: '1', iconName: 'FiUsers', href: '/recipients', color: 'bg-orange-500' },
      ],
      recentProjects: [
        { id: 'p1', name: 'Cabled Sweater', status: 'active', project_type: 'sweater', created_at: '2026-05-01' },
        { id: 'p2', name: 'Granny Square Blanket', status: 'active', project_type: 'blanket', created_at: '2026-04-30' },
        { id: 'p3', name: 'Old Hat', status: 'completed', project_type: 'hat', created_at: '2026-04-20' },
      ],
      lowStockYarn: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Dashboard — quick actions', () => {
  it('points each create CTA to its page with ?new=1 so the modal opens', () => {
    renderDashboard();
    const newProject = screen.getByTestId('quick-action-new-project');
    const addPattern = screen.getByTestId('quick-action-add-pattern');
    const addYarn = screen.getByTestId('quick-action-add-yarn');

    expect(newProject.getAttribute('href')).toBe('/projects?new=1');
    expect(addPattern.getAttribute('href')).toBe('/patterns?new=1');
    expect(addYarn.getAttribute('href')).toBe('/yarn?new=1');
  });
});

describe('Dashboard — Continue area', () => {
  it('renders only active projects, capped at 3', () => {
    renderDashboard();
    const cards = screen.getAllByTestId('continue-project-card');
    expect(cards).toHaveLength(2); // p1 + p2 are active; p3 is completed
    expect(cards[0]).toHaveTextContent('Cabled Sweater');
    expect(cards[1]).toHaveTextContent('Granny Square Blanket');
  });

  it('uses a 44px+ touch target on the Resume CTA', () => {
    renderDashboard();
    const resumeCtas = screen
      .getAllByText(/^Resume$/i)
      .map((el) => el.closest('span') ?? el);
    for (const cta of resumeCtas) {
      expect(cta?.className).toMatch(/min-h-\[44px\]/);
    }
  });

  it('flags projects without a pattern as a setup gap once feasibility data loads', async () => {
    renderDashboard();
    // p1 has no pattern (only p2 does in the feasibility summary).
    expect(
      await screen.findByText(/no pattern attached yet/i),
    ).toBeInTheDocument();
    // Banner rolls up the count — exactly 1 active project missing a pattern.
    expect(
      await screen.findByText(/1 active project is missing a pattern/i),
    ).toBeInTheDocument();
  });

  it('does not show missing-pattern warnings while feasibility data is still loading', async () => {
    // Feasibility summary never resolves → query stays in pending state.
    // Continue cards must still render; missing-pattern chrome must stay
    // hidden so we don't falsely accuse configured projects.
    const get = axios.get as unknown as ReturnType<typeof vi.fn>;
    get.mockImplementation((url: string) => {
      if (url === '/api/users/me/examples') {
        return Promise.resolve({ data: { data: { onboardingGoal: 'track_project' } } });
      }
      if (url === '/api/projects/feasibility-summary') {
        return new Promise(() => {
          /* never resolves */
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    renderDashboard();
    // Cards still render — Dashboard isn't blocked on feasibility.
    expect(await screen.findAllByTestId('continue-project-card')).toHaveLength(2);
    // Give React Query a tick to settle into its pending state.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/no pattern attached yet/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/active project is missing a pattern/i),
    ).not.toBeInTheDocument();
  });

  it('does not show missing-pattern warnings or setup-gap banner when feasibility query errors', async () => {
    // Feasibility summary fails → with retry:false the query lands in error
    // state. Continue cards must still render; missing-pattern chrome must
    // stay hidden so an unrelated outage doesn't pollute the Dashboard.
    const get = axios.get as unknown as ReturnType<typeof vi.fn>;
    get.mockImplementation((url: string) => {
      if (url === '/api/users/me/examples') {
        return Promise.resolve({ data: { data: { onboardingGoal: 'track_project' } } });
      }
      if (url === '/api/projects/feasibility-summary') {
        return Promise.reject(new Error('boom'));
      }
      return Promise.resolve({ data: { data: {} } });
    });

    renderDashboard();
    // Cards render even though the side query errored.
    expect(await screen.findAllByTestId('continue-project-card')).toHaveLength(2);
    // Allow React Query to flush the rejected promise.
    await waitFor(() => {
      expect(
        screen.queryByText(/no pattern attached yet/i),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText(/active project is missing a pattern/i),
    ).not.toBeInTheDocument();
  });
});

describe('Dashboard — copy', () => {
  it('mentions both knit and crochet (no longer "knitting projects" only)', () => {
    renderDashboard();
    // Welcome line acknowledges both crafts.
    expect(
      screen.getByText(/knit, crochet, all of it lives here/i),
    ).toBeInTheDocument();
    // Quick action description mentions both.
    expect(
      screen.getByText(/knit or crochet project/i),
    ).toBeInTheDocument();
  });
});

describe('Dashboard — recent projects empty state', () => {
  it('routes the "Create Your First Project" CTA to /projects?new=1', () => {
    vi.mocked(useDashboardStats).mockReturnValue({
      data: {
        stats: [],
        recentProjects: [],
        lowStockYarn: [],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    renderDashboard();
    const cta = screen.getByRole('link', { name: /create your first project/i });
    expect(cta.getAttribute('href')).toBe('/projects?new=1');
  });
});
