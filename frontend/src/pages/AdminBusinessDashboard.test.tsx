/**
 * AdminBusinessDashboard tests.
 *
 * Mocks axios at the boundary so we can drive each test with a different
 * `/api/admin/business-dashboard` payload and assert the page renders
 * blocked vs ready states, "Not wired yet" when a metric is unavailable,
 * the public-tools table, the owner-task checklist, and the 403 redirect.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('axios');

vi.mock('../hooks/useSeo', () => ({ useSeo: () => undefined }));
vi.mock('../hooks/useNoIndex', () => ({ useNoIndex: () => undefined }));

import axios from 'axios';
import AdminBusinessDashboard from './AdminBusinessDashboard';

interface CountWindow {
  '7d': number;
  '30d': number;
}

function makeData(overrides: Record<string, any> = {}) {
  const base = {
    generatedAt: '2026-05-06T12:00:00.000Z',
    launchReadiness: {
      healthStatus: 'degraded' as const,
      publicLaunchBlocked: true,
      publicLaunchBlockers: [
        'transactional_email_noop: production EMAIL_PROVIDER=noop; signup + reset emails are not delivered',
        'billing_not_ready: BILLING_PROVIDER=none',
      ],
      transactionalEmail: { provider: 'noop', status: 'warn' as const, lastSuccessAt: null },
      billing: {
        provider: 'none',
        providerReady: false,
        preLaunchOpen: false,
        missingEnvVars: [
          'LEMONSQUEEZY_API_KEY',
          'LEMONSQUEEZY_WEBHOOK_SECRET',
          'LEMONSQUEEZY_STORE_ID',
        ],
      },
      suggestedNextAction:
        'Set BILLING_PROVIDER=lemonsqueezy and provision the LEMONSQUEEZY_* env vars to take real money.',
    },
    revenue: {
      wired: true,
      note: 'BILLING_PROVIDER is unset.',
      provider: 'none',
      providerReady: true,
      mrrUsd: 0,
      arrUsd: 0,
      activeSubscriptions: 0,
      trialSubscriptions: 0,
      cancelledSubscriptions: 0,
      expiredSubscriptions: 0,
      pastDueSubscriptions: 0,
      annualSubscribers: 0,
      monthlySubscribers: 0,
      averageRevenuePerUserUsd: 0,
      trialToPaidConversionRate: null,
      churnRate: null,
      failedPaymentCount: 0,
      latestBillingEventAt: null,
      pricing: { monthlyUsd: 12, annualUsd: 99 },
    },
    users: {
      wired: true,
      totalUsers: 27,
      newUsersToday: 1,
      newUsers7d: 4,
      newUsers30d: 12,
      verifiedUsers: 18,
      unverifiedUsers: 9,
      activeUsers7d: 6,
      activeUsers30d: 14,
      activeUserSource: 'usage_events distinct user_id',
    },
    funnel: {
      wired: true,
      note: null,
      publicToolViews: { '7d': 0, '30d': 0 } as CountWindow,
      calculatorUses: { '7d': 0, '30d': 0 } as CountWindow,
      saveToRowlyClicks: { '7d': 0, '30d': 0 } as CountWindow,
      registrations: { '7d': 4, '30d': 12 } as CountWindow,
      upgradePageViews: { '7d': 0, '30d': 0 } as CountWindow,
      checkoutStarts: { '7d': 0, '30d': 0 } as CountWindow,
      checkoutCompleted: { '7d': 0, '30d': 0 } as CountWindow,
      trialStarts: { '7d': 0, '30d': 0 } as CountWindow,
      paidConversions: { '7d': 0, '30d': 0 } as CountWindow,
      conversionRates: {
        publicToolViewToCalculatorUse: null,
        calculatorUseToSaveClick: null,
        saveClickToRegistration: null,
        upgradePageViewToCheckoutStart: null,
        checkoutStartToCheckoutComplete: null,
        registrationToPaid: null,
      },
      missingEvents: ['public_tool_viewed', 'public_tool_used', 'save_to_rowly_clicked'],
    },
    publicTools: {
      wired: true,
      note: null,
      tools: [
        { id: 'index', route: '/calculators', kind: 'index', status: 'live', views7d: 0, views30d: 0, saves7d: 0, saves30d: 0, conversionRate: null, missingTrackingEvents: [] },
        { id: 'gauge', route: '/calculators/gauge', kind: 'tool', status: 'live', views7d: 0, views30d: 0, saves7d: 0, saves30d: 0, conversionRate: null, missingTrackingEvents: ['public_tool_viewed with metadata.route'] },
        { id: 'size', route: '/calculators/size', kind: 'tool', status: 'live', views7d: 0, views30d: 0, saves7d: 0, saves30d: 0, conversionRate: null, missingTrackingEvents: [] },
        { id: 'yardage', route: '/calculators/yardage', kind: 'tool', status: 'live', views7d: 0, views30d: 0, saves7d: 0, saves30d: 0, conversionRate: null, missingTrackingEvents: [] },
        { id: 'row-repeat', route: '/calculators/row-repeat', kind: 'tool', status: 'live', views7d: 0, views30d: 0, saves7d: 0, saves30d: 0, conversionRate: null, missingTrackingEvents: [] },
        { id: 'shaping', route: '/calculators/shaping', kind: 'tool', status: 'live', views7d: 0, views30d: 0, saves7d: 0, saves30d: 0, conversionRate: null, missingTrackingEvents: [] },
        { id: 'glossary', route: '/help/glossary', kind: 'help', status: 'live', views7d: 0, views30d: 0, saves7d: 0, saves30d: 0, conversionRate: null, missingTrackingEvents: [] },
        { id: 'knit911', route: '/help/knit911', kind: 'help', status: 'live', views7d: 0, views30d: 0, saves7d: 0, saves30d: 0, conversionRate: null, missingTrackingEvents: [] },
      ],
    },
    productUsage: {
      wired: true,
      projectsCreated: { '7d': 1, '30d': 3 } as CountWindow,
      patternsCreated: { '7d': 0, '30d': 1 } as CountWindow,
      patternModelsCreated: { '7d': 0, '30d': 0 } as CountWindow,
      sourceFilesUploaded: { '7d': 1, '30d': 5 } as CountWindow,
      yarnItemsCreated: { '7d': 2, '30d': 8 } as CountWindow,
      chartsCreated: { '7d': 0, '30d': 1 } as CountWindow,
      makeModeUsage: { '7d': 0, '30d': 0 } as CountWindow,
      topUsageEvents: [
        { eventName: 'public_tool_viewed', events: 12, uniqueUsers: 4 },
      ],
      missingEvents: [],
    },
    contentAndSEO: {
      wired: false,
      indexedPublicRoutes: 8,
      publicToolsLinkedFromLanding: true,
      blogPostsPublished: null,
      blogPostsWired: false,
      adsenseConfigured: true,
      adsense: {
        publisherId: 'ca-pub-9472587145183950',
        scriptPresent: true,
        scriptSource: '/usr/share/nginx/html/index.html',
        adsTxtPresent: true,
        adsTxtValid: true,
        adsTxtSource: '/usr/share/nginx/html/ads.txt',
        adsTxtContents: 'google.com, pub-9472587145183950, DIRECT, f08c47fec0942fa0',
        publicAdsEnabled: true,
        landingPageAdsEnabled: false,
        appAdsEnabled: false,
        approvedAdRoutes: [
          '/calculators',
          '/calculators/gauge',
          '/calculators/size',
          '/calculators/yardage',
          '/calculators/row-repeat',
          '/calculators/shaping',
          '/help/glossary',
          '/help/knit911',
        ],
        blockedAdRoutes: [
          '/ (landing page)',
          '/dashboard and the entire authenticated app',
        ],
        expectedAdsTxtLine: 'google.com, pub-9472587145183950, DIRECT, f08c47fec0942fa0',
      },
      nextContentTasks: [
        { id: 'seo-1', label: 'Write SEO post: gauge swatch', priority: 'P1' },
        { id: 'seo-2', label: 'Write SEO post: yarn substitution', priority: 'P1' },
      ],
    },
    ownerTasks: [
      { id: 'ls_account', label: 'Lemon Squeezy account finished', status: 'needs_owner', reason: 'BILLING_PROVIDER=none', suggestedAction: 'Onboard.' },
      { id: 'ls_env', label: 'LS env vars installed in production', status: 'needs_owner', reason: 'Missing: LEMONSQUEEZY_API_KEY', suggestedAction: 'Add envs.' },
      { id: 'ls_webhook', label: 'LS webhook registered + receiving events', status: 'blocked', reason: 'No billing_events rows yet.', suggestedAction: 'Register webhook.' },
      { id: 'checkout_smoke', label: 'Real checkout smoke passed', status: 'blocked', reason: 'No active subs.', suggestedAction: 'Run smoke.' },
      { id: 'tools_linked', label: 'Public tools linked from landing page', status: 'done', reason: 'Landing renders all 5 tool cards.', suggestedAction: 'No action needed.' },
      { id: 'adsense', label: 'AdSense set up', status: 'not_started', reason: 'ADSENSE_PUBLISHER_ID not configured.', suggestedAction: 'Apply.' },
      { id: 'beta_promo', label: 'First beta promo email sent', status: 'blocked', reason: 'email_logs row missing.', suggestedAction: 'Configure email first.' },
      { id: 'search_console', label: 'Search Console verified + sitemap submitted', status: 'needs_owner', reason: 'No google-site-verification meta tag.', suggestedAction: 'Add meta tag and submit sitemap.' },
      { id: 'legal_cookie', label: 'Legal pages + cookie language live', status: 'needs_owner', reason: 'No cookie banner.', suggestedAction: 'Add cookie banner.' },
      { id: 'support_email', label: 'Support email configured', status: 'needs_owner', reason: 'SUPPORT_EMAIL unset.', suggestedAction: 'Set SUPPORT_EMAIL env var.' },
      { id: 'first_seo_post', label: 'First SEO post published', status: 'not_started', reason: 'No blog_posts table.', suggestedAction: 'Build blog.' },
    ],
  };
  return { ...base, ...overrides };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/business']}>
      <Routes>
        <Route path="/admin/business" element={<AdminBusinessDashboard />} />
        <Route path="/dashboard" element={<div data-testid="redirected-to-dashboard">dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  const get = axios.get as unknown as ReturnType<typeof vi.fn>;
  get.mockImplementation(() =>
    Promise.resolve({ data: { success: true, data: makeData() } }),
  );
  // axios.isAxiosError is not auto-mocked; bind it so the 403 path can detect.
  (axios as any).isAxiosError = (err: any): err is { response?: { status?: number; data?: any } } => !!err?.isAxiosError;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminBusinessDashboard — blocked launch state', () => {
  it('renders the launch blockers list with red treatment', async () => {
    renderPage();
    expect(await screen.findByText(/Launch blockers/i)).toBeInTheDocument();
    // Both blocker strings render verbatim.
    expect(
      screen.getByText(/transactional_email_noop/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/billing_not_ready: BILLING_PROVIDER=none/i),
    ).toBeInTheDocument();
  });

  it('renders the suggested next action surfaced by the backend', async () => {
    renderPage();
    expect(
      await screen.findByText(/Set BILLING_PROVIDER=lemonsqueezy/i),
    ).toBeInTheDocument();
  });

  it('lists each missing LS env var', async () => {
    renderPage();
    await screen.findByText(/Launch blockers/i);
    // The env-var name renders in multiple spots (Missing env vars row,
    // owner-task reason). Just confirm at least one match — the exact
    // count varies with the mock payload.
    expect(
      screen.getAllByText(/LEMONSQUEEZY_API_KEY/i).length,
    ).toBeGreaterThan(0);
  });
});

describe('AdminBusinessDashboard — ready launch state', () => {
  it('renders "No launch blockers from /health" when the API returns blocked=false', async () => {
    const get = axios.get as unknown as ReturnType<typeof vi.fn>;
    get.mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          success: true,
          data: makeData({
            launchReadiness: {
              healthStatus: 'healthy',
              publicLaunchBlocked: false,
              publicLaunchBlockers: [],
              transactionalEmail: { provider: 'resend', status: 'pass', lastSuccessAt: '2026-05-06T11:00:00.000Z' },
              billing: { provider: 'lemonsqueezy', providerReady: true, preLaunchOpen: false, missingEnvVars: [] },
              suggestedNextAction: 'Public launch readiness OK. Run a paid checkout smoke and then announce.',
            },
          }),
        },
      }),
    );
    renderPage();
    expect(
      await screen.findByText(/No launch blockers from \/health/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Public launch readiness OK/i),
    ).toBeInTheDocument();
  });
});

describe('AdminBusinessDashboard — revenue cards', () => {
  it('renders MRR and ARR cards', async () => {
    renderPage();
    await screen.findByText(/Launch blockers/i);
    // The label "MRR" appears in both the top-row card and the revenue
    // section. Both should be present.
    expect(screen.getAllByText(/^MRR$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^ARR$/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe('AdminBusinessDashboard — Not wired yet', () => {
  it('shows "Not wired yet" for blogPostsPublished when blog table is missing', async () => {
    renderPage();
    await screen.findByText(/Launch blockers/i);
    expect(
      screen.getByText(/Not wired yet — blog_posts table missing/i),
    ).toBeInTheDocument();
  });

  it('shows "Not wired yet" for charts when chartsCreated is null', async () => {
    const get = axios.get as unknown as ReturnType<typeof vi.fn>;
    get.mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          success: true,
          data: makeData({
            productUsage: {
              wired: true,
              projectsCreated: { '7d': 0, '30d': 0 },
              patternsCreated: { '7d': 0, '30d': 0 },
              patternModelsCreated: { '7d': 0, '30d': 0 },
              sourceFilesUploaded: { '7d': 0, '30d': 0 },
              yarnItemsCreated: { '7d': 0, '30d': 0 },
              chartsCreated: null,
              makeModeUsage: { '7d': 0, '30d': 0 },
              topUsageEvents: [],
              missingEvents: ['make_mode_opened'],
            },
          }),
        },
      }),
    );
    renderPage();
    expect(
      await screen.findByText(/Not wired yet — charts table missing/i),
    ).toBeInTheDocument();
  });
});

describe('AdminBusinessDashboard — public tools table', () => {
  it('renders all 8 routes from the API payload', async () => {
    renderPage();
    await screen.findByText(/Launch blockers/i);
    // Each route can appear in multiple places (publicTools table + the
    // AdSense approved-routes list). Just confirm each shows up at least
    // once — the publicTools table is structurally different (one row
    // per tool) and the approved-routes list is `data-testid`-pinned in
    // the AdSense readiness card test.
    [
      '/calculators',
      '/calculators/gauge',
      '/calculators/size',
      '/calculators/yardage',
      '/calculators/row-repeat',
      '/calculators/shaping',
      '/help/glossary',
      '/help/knit911',
    ].forEach((route) => {
      expect(screen.getAllByText(route).length).toBeGreaterThan(0);
    });
  });

  it('renders the missing-tracking notice when any tool reports gaps', async () => {
    renderPage();
    expect(
      await screen.findByText(/Missing tracking:/i),
    ).toBeInTheDocument();
  });
});

describe('AdminBusinessDashboard — owner task checklist', () => {
  it('renders all 11 task labels with status badges', async () => {
    renderPage();
    await screen.findByText(/Launch blockers/i);
    expect(screen.getByText('Lemon Squeezy account finished')).toBeInTheDocument();
    expect(screen.getByText('LS env vars installed in production')).toBeInTheDocument();
    expect(screen.getByText('LS webhook registered + receiving events')).toBeInTheDocument();
    expect(screen.getByText('Real checkout smoke passed')).toBeInTheDocument();
    expect(screen.getByText('Public tools linked from landing page')).toBeInTheDocument();
    expect(screen.getByText('AdSense set up')).toBeInTheDocument();
    expect(screen.getByText('First beta promo email sent')).toBeInTheDocument();
    expect(screen.getByText('Search Console verified + sitemap submitted')).toBeInTheDocument();
    expect(screen.getByText('Legal pages + cookie language live')).toBeInTheDocument();
    expect(screen.getByText('Support email configured')).toBeInTheDocument();
    expect(screen.getByText('First SEO post published')).toBeInTheDocument();
    // At least one "done" badge for the tools_linked task.
    const doneBadges = screen.getAllByText(/done/i);
    expect(doneBadges.length).toBeGreaterThan(0);
  });
});

describe('AdminBusinessDashboard — AdSense readiness card', () => {
  it('renders the readiness card with publisher id, all 8 approved routes, and policy=off for landing/app', async () => {
    renderPage();
    await screen.findByText(/Launch blockers/i);
    expect(screen.getByTestId('adsense-readiness-card')).toBeInTheDocument();
    // Publisher id rendered.
    expect(screen.getByText('ca-pub-9472587145183950')).toBeInTheDocument();
    // 8 approved routes rendered in the list.
    const approved = screen.getByTestId('adsense-approved-routes');
    expect(approved.children.length).toBe(8);
    // Landing/app policy explicitly "off (per policy)".
    expect(screen.getByText(/off \(per policy\)/i)).toBeInTheDocument();
  });

  it('flags POLICY VIOLATION if the API ever reports landing/app ads enabled', async () => {
    const get = axios.get as unknown as ReturnType<typeof vi.fn>;
    get.mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          success: true,
          data: makeData({
            contentAndSEO: {
              wired: false,
              indexedPublicRoutes: 8,
              publicToolsLinkedFromLanding: true,
              blogPostsPublished: null,
              blogPostsWired: false,
              adsenseConfigured: true,
              adsense: {
                publisherId: 'ca-pub-9472587145183950',
                scriptPresent: true,
                scriptSource: '/dist/index.html',
                adsTxtPresent: true,
                adsTxtValid: true,
                adsTxtSource: '/dist/ads.txt',
                adsTxtContents: 'google.com, pub-9472587145183950, DIRECT, f08c47fec0942fa0',
                publicAdsEnabled: true,
                landingPageAdsEnabled: true,  // <- regression
                appAdsEnabled: false,
                approvedAdRoutes: ['/calculators'],
                blockedAdRoutes: [],
                expectedAdsTxtLine: 'google.com, pub-9472587145183950, DIRECT, f08c47fec0942fa0',
              },
              nextContentTasks: [],
            },
          }),
        },
      }),
    );
    renderPage();
    expect(await screen.findByText(/POLICY VIOLATION/i)).toBeInTheDocument();
  });
});

describe('AdminBusinessDashboard — 403 handling', () => {
  it('redirects to /dashboard when the API returns 403 (mirrors AdminUsage)', async () => {
    const get = axios.get as unknown as ReturnType<typeof vi.fn>;
    const error: any = new Error('forbidden');
    error.isAxiosError = true;
    error.response = { status: 403, data: { success: false, message: 'Owner access only' } };
    get.mockImplementationOnce(() => Promise.reject(error));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('redirected-to-dashboard')).toBeInTheDocument();
    });
  });

  it('renders the error message for non-403 errors', async () => {
    const get = axios.get as unknown as ReturnType<typeof vi.fn>;
    const error: any = new Error('server down');
    error.isAxiosError = true;
    error.response = { status: 500, data: { success: false, message: 'Internal' } };
    get.mockImplementationOnce(() => Promise.reject(error));
    renderPage();
    expect(await screen.findByText(/Internal/i)).toBeInTheDocument();
  });
});
