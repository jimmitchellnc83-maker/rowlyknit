import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDollarSign,
  FiUsers,
  FiActivity,
  FiTool,
  FiTrendingUp,
  FiClipboard,
  FiExternalLink,
  FiPauseCircle,
} from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';
import { useNoIndex } from '../hooks/useNoIndex';

/**
 * Owner-only operational dashboard at `/admin/business`. Reads
 * `/api/admin/business-dashboard` and renders the founder's daily view of
 * launch readiness, MRR, user growth, funnel, public-tools performance,
 * product usage, and the action checklist.
 *
 * UX rules:
 *   - dense, scannable, calm; no marketing hero, no nested cards
 *   - never fake a metric — `wired === false` or `value === null` →
 *     "Not wired yet" with the instrumentation gap explained
 *   - 44px minimum touch targets on interactive controls
 *   - mobile-safe: every grid collapses to single column under 640px
 */

interface CountWindow {
  '7d': number;
  '30d': number;
}

interface DashboardResponse {
  success: boolean;
  data: {
    generatedAt: string;
    launchReadiness: {
      healthStatus: 'healthy' | 'degraded' | 'unhealthy';
      publicLaunchBlocked: boolean;
      publicLaunchBlockers: string[];
      transactionalEmail: {
        provider: string;
        status: 'pass' | 'warn' | 'fail';
        lastSuccessAt: string | null;
      };
      billing: {
        provider: string;
        providerReady: boolean;
        preLaunchOpen: boolean;
        missingEnvVars: string[];
      };
      suggestedNextAction: string;
    };
    revenue: {
      wired: boolean;
      note: string | null;
      provider: string;
      providerReady: boolean;
      mrrUsd: number;
      arrUsd: number;
      activeSubscriptions: number;
      trialSubscriptions: number;
      cancelledSubscriptions: number;
      expiredSubscriptions: number;
      pastDueSubscriptions: number;
      annualSubscribers: number;
      monthlySubscribers: number;
      averageRevenuePerUserUsd: number;
      trialToPaidConversionRate: number | null;
      churnRate: number | null;
      failedPaymentCount: number;
      latestBillingEventAt: string | null;
      pricing: { monthlyUsd: number; annualUsd: number };
    };
    users: {
      wired: boolean;
      totalUsers: number;
      newUsersToday: number;
      newUsers7d: number;
      newUsers30d: number;
      verifiedUsers: number;
      unverifiedUsers: number;
      activeUsers7d: number;
      activeUsers30d: number;
      activeUserSource: string;
    };
    funnel: {
      wired: boolean;
      note: string | null;
      publicToolViews: CountWindow;
      calculatorUses: CountWindow;
      saveToRowlyClicks: CountWindow;
      registrations: CountWindow;
      upgradePageViews: CountWindow;
      checkoutStarts: CountWindow;
      checkoutCompleted: CountWindow;
      trialStarts: CountWindow;
      paidConversions: CountWindow;
      conversionRates: Record<string, number | null>;
      missingEvents: string[];
    };
    publicTools: {
      wired: boolean;
      note: string | null;
      tools: Array<{
        id: string;
        route: string;
        kind: 'tool' | 'help' | 'index';
        status: 'live';
        views7d: number;
        views30d: number;
        saves7d: number;
        saves30d: number;
        conversionRate: number | null;
        missingTrackingEvents: string[];
      }>;
    };
    productUsage: {
      wired: boolean;
      projectsCreated: CountWindow;
      patternsCreated: CountWindow;
      patternModelsCreated: CountWindow;
      sourceFilesUploaded: CountWindow;
      yarnItemsCreated: CountWindow;
      chartsCreated: CountWindow | null;
      makeModeUsage: CountWindow;
      topUsageEvents: Array<{ eventName: string; events: number; uniqueUsers: number }>;
      missingEvents: string[];
    };
    contentAndSEO: {
      wired: boolean;
      indexedPublicRoutes: number;
      publicToolsLinkedFromLanding: boolean;
      blogPostsPublished: number | null;
      blogPostsWired: boolean;
      adsenseConfigured: boolean;
      adsense: {
        publisherId: string;
        scriptPresent: boolean;
        scriptSource: string | null;
        adsTxtPresent: boolean;
        adsTxtValid: boolean;
        adsTxtSource: string | null;
        adsTxtContents: string | null;
        publicAdsEnabled: boolean;
        landingPageAdsEnabled: boolean;
        appAdsEnabled: boolean;
        approvedAdRoutes: string[];
        blockedAdRoutes: string[];
        expectedAdsTxtLine: string;
      };
      nextContentTasks: Array<{ id: string; label: string; priority: string }>;
    };
    ownerTasks: Array<{
      id: string;
      label: string;
      status: 'done' | 'blocked' | 'not_started' | 'needs_owner';
      reason: string;
      suggestedAction: string;
    }>;
  };
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function formatPct(n: number | null): string {
  return n === null ? 'Not wired yet' : `${n}%`;
}

function NotWired({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
      <FiAlertTriangle className="h-3 w-3" /> Not wired yet — {reason}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 dark:border-emerald-800/50'
      : tone === 'warn'
        ? 'border-amber-200 dark:border-amber-800/50'
        : tone === 'bad'
          ? 'border-red-200 dark:border-red-800/50'
          : 'border-gray-200 dark:border-gray-700';
  return (
    <div className={`rounded border ${toneClass} bg-white p-3 dark:bg-gray-800`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</div>}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mt-8 mb-3 flex items-start gap-2">
      <div className="mt-0.5 text-gray-500 dark:text-gray-400">{icon}</div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) {
  const cls =
    status === 'healthy'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : status === 'degraded'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${cls}`}>{status}</span>;
}

function OwnerTaskBadge({ status }: { status: 'done' | 'blocked' | 'not_started' | 'needs_owner' }) {
  const cls =
    status === 'done'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : status === 'blocked'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
        : status === 'needs_owner'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  return (
    <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${cls}`}>
      {status === 'not_started' ? 'not started' : status.replace('_', ' ')}
    </span>
  );
}

export default function AdminBusinessDashboard() {
  useSeo({
    title: 'Business Command Center — Rowly Admin',
    description: 'Owner-only operational dashboard: launch readiness, revenue, funnel, public tools, product usage.',
  });
  useNoIndex();

  const navigate = useNavigate();
  const [data, setData] = useState<DashboardResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get<DashboardResponse>('/api/admin/business-dashboard')
      .then((res) => {
        if (cancelled) return;
        setData(res.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          // Match AdminUsage: silently redirect non-owners.
          navigate('/dashboard', { replace: true });
          return;
        }
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : 'Failed to load business dashboard',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const generatedAt = useMemo(() => {
    if (!data?.generatedAt) return '';
    try {
      return new Date(data.generatedAt).toLocaleString();
    } catch {
      return data.generatedAt;
    }
  }, [data?.generatedAt]);

  if (loading) {
    return <p className="p-6 text-sm italic text-gray-500">Loading business dashboard…</p>;
  }

  if (error) {
    return (
      <div className="m-6 flex items-start gap-3 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
        <FiAlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const launch = data.launchReadiness;
  const revenue = data.revenue;
  const users = data.users;
  const funnel = data.funnel;
  const publicTools = data.publicTools;
  const productUsage = data.productUsage;
  const content = data.contentAndSEO;
  const tasks = data.ownerTasks;

  // Top-row tone for launch status mirrors the suggested action.
  const launchTone: 'good' | 'warn' | 'bad' =
    launch.healthStatus === 'healthy' ? 'good' : launch.healthStatus === 'degraded' ? 'warn' : 'bad';

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Business command center</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Daily founder dashboard. Generated {generatedAt}.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            to="/admin/usage"
            className="inline-flex min-h-[44px] items-center gap-1 rounded border border-gray-300 px-3 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Usage analytics <FiExternalLink className="h-3 w-3" />
          </Link>
          <a
            href="/health"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1 rounded border border-gray-300 px-3 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            /health <FiExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Launch status"
          value={<StatusPill status={launch.healthStatus} />}
          hint={launch.publicLaunchBlocked ? `${launch.publicLaunchBlockers.length} blocker(s)` : 'No blockers'}
          tone={launchTone}
        />
        <StatCard
          label="MRR"
          value={revenue.wired ? formatUsd(revenue.mrrUsd) : <NotWired reason="billing tables missing" />}
          hint={
            revenue.wired
              ? `${revenue.activeSubscriptions} active sub(s) · ARR ${formatUsd(revenue.arrUsd)}`
              : undefined
          }
          tone={revenue.activeSubscriptions > 0 ? 'good' : 'neutral'}
        />
        <StatCard
          label="Active users (30d)"
          value={users.activeUsers30d.toLocaleString()}
          hint={`${users.activeUsers7d} in last 7d · ${users.totalUsers} total`}
          tone="neutral"
        />
        <StatCard
          label="Trial / paid"
          value={`${revenue.trialSubscriptions} / ${revenue.activeSubscriptions}`}
          hint={
            revenue.trialToPaidConversionRate !== null
              ? `Trial→paid: ${revenue.trialToPaidConversionRate}%`
              : 'Trial→paid: not enough data yet'
          }
          tone="neutral"
        />
      </div>

      {/* Suggested next action */}
      <div className={`rounded border p-3 text-sm ${launch.publicLaunchBlocked ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100' : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100'}`}>
        <strong>Suggested next action:</strong> {launch.suggestedNextAction}
      </div>

      {/* Launch blockers */}
      <SectionHeader
        icon={<FiPauseCircle className="h-4 w-4" />}
        title="Launch blockers"
        subtitle="What's preventing public launch right now."
      />
      {launch.publicLaunchBlocked ? (
        <ul className="space-y-2 text-sm">
          {launch.publicLaunchBlockers.map((b, i) => (
            <li key={i} className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100">
              <FiAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100">
          <FiCheckCircle className="-mt-0.5 mr-1 inline h-4 w-4" /> No launch blockers from /health.
        </p>
      )}

      <div className="overflow-hidden rounded border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            <tr>
              <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Email provider</td>
              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{launch.transactionalEmail.provider}</td>
              <td className="px-3 py-2 text-gray-500">
                Last success: {launch.transactionalEmail.lastSuccessAt ?? '—'}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Billing provider</td>
              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{launch.billing.provider}</td>
              <td className="px-3 py-2 text-gray-500">
                {launch.billing.providerReady ? 'ready' : 'not ready'}
                {launch.billing.preLaunchOpen ? ' · pre-launch open' : ''}
              </td>
            </tr>
            {launch.billing.missingEnvVars.length > 0 && (
              <tr>
                <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Missing env vars</td>
                <td className="px-3 py-2 text-red-700 dark:text-red-300" colSpan={2}>
                  {launch.billing.missingEnvVars.join(', ')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Revenue */}
      <SectionHeader
        icon={<FiDollarSign className="h-4 w-4" />}
        title="Revenue"
        subtitle={`Provider: ${revenue.provider} · ${revenue.providerReady ? 'ready' : 'not ready'}`}
      />
      {revenue.note && (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          {revenue.note}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="MRR" value={revenue.wired ? formatUsd(revenue.mrrUsd) : <NotWired reason="not wired" />} />
        <StatCard label="ARR" value={revenue.wired ? formatUsd(revenue.arrUsd) : <NotWired reason="not wired" />} />
        <StatCard label="Active" value={revenue.activeSubscriptions} />
        <StatCard label="Trial" value={revenue.trialSubscriptions} />
        <StatCard label="Cancelled" value={revenue.cancelledSubscriptions} />
        <StatCard label="Past due" value={revenue.pastDueSubscriptions} />
        <StatCard label="Annual subs" value={revenue.annualSubscribers} />
        <StatCard label="Monthly subs" value={revenue.monthlySubscribers} />
        <StatCard label="ARPU" value={revenue.wired ? formatUsd(revenue.averageRevenuePerUserUsd) : <NotWired reason="not wired" />} />
        <StatCard label="Trial→paid" value={formatPct(revenue.trialToPaidConversionRate)} />
        <StatCard label="Churn (approx)" value={formatPct(revenue.churnRate)} />
        <StatCard label="Failed payments" value={revenue.failedPaymentCount} />
      </div>
      <p className="text-xs text-gray-500">
        Pricing: {formatUsd(revenue.pricing.monthlyUsd)}/mo · {formatUsd(revenue.pricing.annualUsd)}/yr.
        Latest billing event: {revenue.latestBillingEventAt ?? '—'}.
      </p>

      {/* User growth */}
      <SectionHeader
        icon={<FiUsers className="h-4 w-4" />}
        title="User growth"
        subtitle={`Active-user signal source: ${users.activeUserSource}`}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total users" value={users.totalUsers.toLocaleString()} />
        <StatCard label="New today" value={users.newUsersToday} />
        <StatCard label="New 7d" value={users.newUsers7d} />
        <StatCard label="New 30d" value={users.newUsers30d} />
        <StatCard label="Verified" value={users.verifiedUsers} hint={`${users.unverifiedUsers} unverified`} />
        <StatCard label="Active 7d" value={users.activeUsers7d} />
        <StatCard label="Active 30d" value={users.activeUsers30d} />
      </div>

      {/* Funnel */}
      <SectionHeader
        icon={<FiTrendingUp className="h-4 w-4" />}
        title="Funnel"
        subtitle="Public tool views → save clicks → registration → upgrade → checkout → paid."
      />
      {funnel.note && (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          {funnel.note}
        </p>
      )}
      <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Stage</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">7d</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">30d</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {[
              ['Public tool views', funnel.publicToolViews],
              ['Calculator uses', funnel.calculatorUses],
              ['Save-to-Rowly clicks', funnel.saveToRowlyClicks],
              ['Registrations', funnel.registrations],
              ['Upgrade page views', funnel.upgradePageViews],
              ['Checkout starts', funnel.checkoutStarts],
              ['Checkout completed', funnel.checkoutCompleted],
              ['Trial starts', funnel.trialStarts],
              ['Paid conversions', funnel.paidConversions],
            ].map(([label, win]) => {
              const w = win as CountWindow;
              return (
                <tr key={label as string}>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{label as string}</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{w['7d']}</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{w['30d']}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(funnel.conversionRates).map(([k, v]) => (
          <StatCard key={k} label={k} value={formatPct(v)} />
        ))}
      </div>
      {funnel.missingEvents.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          <strong>Missing instrumentation:</strong> {funnel.missingEvents.join(', ')}
          <p className="mt-1 text-amber-800 dark:text-amber-200">
            Add a <code>usage_events.create</code> call with these <code>event_name</code>s to wire the funnel.
          </p>
        </div>
      )}

      {/* Public tools */}
      <SectionHeader
        icon={<FiTool className="h-4 w-4" />}
        title="Public tools"
        subtitle="Per-route view + save counts. Help pages don't track saves."
      />
      <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Route</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Kind</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Views 7d</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Views 30d</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Saves 7d</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Saves 30d</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Conv.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {publicTools.tools.map((t) => (
              <tr key={t.route}>
                <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">{t.route}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{t.kind}</td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{t.views7d}</td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{t.views30d}</td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                  {t.kind === 'tool' ? t.saves7d : '—'}
                </td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                  {t.kind === 'tool' ? t.saves30d : '—'}
                </td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{formatPct(t.conversionRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {publicTools.tools.some((t) => t.missingTrackingEvents.length > 0) && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          <strong>Missing tracking:</strong> per-route metrics need
          <code className="mx-1">public_tool_viewed</code> with <code>metadata.route</code>
          and <code className="mx-1">save_to_rowly_clicked</code> with <code>metadata.tool</code>.
        </div>
      )}

      {/* Product usage */}
      <SectionHeader
        icon={<FiActivity className="h-4 w-4" />}
        title="Product usage"
        subtitle="Authenticated workspace activity (last 7d / 30d)."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Projects created"
          value={`${productUsage.projectsCreated['7d']} / ${productUsage.projectsCreated['30d']}`}
          hint="7d / 30d"
        />
        <StatCard
          label="Patterns created"
          value={`${productUsage.patternsCreated['7d']} / ${productUsage.patternsCreated['30d']}`}
          hint="7d / 30d"
        />
        <StatCard
          label="Pattern models"
          value={`${productUsage.patternModelsCreated['7d']} / ${productUsage.patternModelsCreated['30d']}`}
          hint="7d / 30d"
        />
        <StatCard
          label="Source files"
          value={`${productUsage.sourceFilesUploaded['7d']} / ${productUsage.sourceFilesUploaded['30d']}`}
          hint="7d / 30d"
        />
        <StatCard
          label="Yarn items"
          value={`${productUsage.yarnItemsCreated['7d']} / ${productUsage.yarnItemsCreated['30d']}`}
          hint="7d / 30d"
        />
        <StatCard
          label="Charts"
          value={
            productUsage.chartsCreated
              ? `${productUsage.chartsCreated['7d']} / ${productUsage.chartsCreated['30d']}`
              : <NotWired reason="charts table missing" />
          }
          hint={productUsage.chartsCreated ? '7d / 30d' : undefined}
        />
        <StatCard
          label="Make-mode opens"
          value={`${productUsage.makeModeUsage['7d']} / ${productUsage.makeModeUsage['30d']}`}
          hint={
            productUsage.missingEvents.includes('make_mode_opened')
              ? <NotWired reason="make_mode_opened event" />
              : '7d / 30d'
          }
        />
      </div>

      {productUsage.topUsageEvents.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <caption className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Top usage events (last 14 days)
            </caption>
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Event
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Events
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Unique users
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {productUsage.topUsageEvents.map((row) => (
                <tr key={row.eventName}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">{row.eventName}</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{row.events}</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{row.uniqueUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Content + SEO */}
      <SectionHeader
        icon={<FiClipboard className="h-4 w-4" />}
        title="Content & SEO"
        subtitle="Indexable surface + content backlog."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Indexed routes" value={content.indexedPublicRoutes} />
        <StatCard
          label="Tools linked from landing"
          value={content.publicToolsLinkedFromLanding ? 'yes' : 'no'}
          tone={content.publicToolsLinkedFromLanding ? 'good' : 'warn'}
        />
        <StatCard
          label="Blog posts published"
          value={
            content.blogPostsWired ? (
              content.blogPostsPublished ?? 0
            ) : (
              <NotWired reason="blog_posts table missing" />
            )
          }
        />
        <StatCard
          label="AdSense"
          value={content.adsenseConfigured ? 'configured' : 'not configured'}
        />
      </div>
      {/* AdSense readiness — broken out so the founder sees the policy
          (where ads run / where they don't) alongside the live signals. */}
      <div
        data-testid="adsense-readiness-card"
        className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold text-gray-900 dark:text-gray-100">AdSense readiness</div>
          <code className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
            {content.adsense.publisherId}
          </code>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Script present"
            value={content.adsense.scriptPresent ? 'yes' : 'no'}
            tone={content.adsense.scriptPresent ? 'good' : 'warn'}
            hint={content.adsense.scriptSource ?? undefined}
          />
          <StatCard
            label="ads.txt present"
            value={content.adsense.adsTxtPresent ? 'yes' : 'no'}
            tone={content.adsense.adsTxtPresent ? 'good' : 'warn'}
            hint={content.adsense.adsTxtSource ?? undefined}
          />
          <StatCard
            label="ads.txt valid"
            value={content.adsense.adsTxtValid ? 'yes' : 'no'}
            tone={content.adsense.adsTxtValid ? 'good' : 'warn'}
            hint={content.adsense.expectedAdsTxtLine}
          />
          <StatCard
            label="Public ads enabled"
            value={content.adsense.publicAdsEnabled ? 'yes' : 'no'}
            tone={content.adsense.publicAdsEnabled ? 'good' : 'warn'}
          />
          <StatCard
            label="Landing / app ads"
            value={
              content.adsense.landingPageAdsEnabled || content.adsense.appAdsEnabled
                ? 'POLICY VIOLATION'
                : 'off (per policy)'
            }
            tone={
              content.adsense.landingPageAdsEnabled || content.adsense.appAdsEnabled ? 'bad' : 'good'
            }
            hint="Landing page + authenticated app must never serve ads."
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Approved ad routes
            </div>
            <ul data-testid="adsense-approved-routes" className="mt-1 space-y-0.5 font-mono text-xs text-gray-800 dark:text-gray-200">
              {content.adsense.approvedAdRoutes.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Blocked surfaces
            </div>
            <ul data-testid="adsense-blocked-routes" className="mt-1 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
              {content.adsense.blockedAdRoutes.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <caption className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            Next content tasks
          </caption>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {content.nextContentTasks.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{t.label}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">{t.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Owner tasks */}
      <SectionHeader
        icon={<FiClipboard className="h-4 w-4" />}
        title="Owner tasks"
        subtitle="Punchlist computed from billing config, /health, and table contents."
      />
      <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Task</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Why</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {tasks.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{t.label}</td>
                <td className="px-3 py-2"><OwnerTaskBadge status={t.status} /></td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{t.reason}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{t.suggestedAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
