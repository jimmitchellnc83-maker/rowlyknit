import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
  FiFolder,
  FiBook,
  FiPackage,
  FiUsers,
  FiPlus,
  FiAlertCircle,
  FiHelpCircle,
  FiPlay,
  FiArrowRight,
} from 'react-icons/fi';
import { useAuthStore } from '../stores/authStore';
import { useDashboardStats } from '../hooks/useApi';
import { useMeasurementPrefs } from '../hooks/useMeasurementPrefs';
import { LoadingSkeleton, ErrorState } from '../components/LoadingSpinner';
import CmdKTooltip from '../components/CmdKTooltip';
import OnboardingGoalCard, {
  type OnboardingGoal,
} from '../components/dashboard/OnboardingGoalCard';
import CycEventBanner from '../components/cyc/CycEventBanner';
import { metersToYards } from '../utils/yarnUnits';
import { formatDate } from '../utils/formatDate';

const GOAL_DESTINATION: Record<OnboardingGoal, string> = {
  track_project: '/projects',
  organize_stash: '/yarn',
  follow_pattern: '/patterns',
  design_new: '/designer',
  explore_examples: '/dashboard',
};

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  FiFolder,
  FiBook,
  FiPackage,
  FiUsers,
};

interface FeasibilitySummary {
  projectId: string;
  patternId: string;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: dashboardData, isLoading: loading, isError, refetch } = useDashboardStats();
  const { fmt, labels } = useMeasurementPrefs();

  // Onboarding goal — null until the user answers the goal-pick card or
  // skips it. Initialised to undefined so the card doesn't flash before
  // we know the persisted value. Skip persists `track_project` per spec.
  const [onboardingGoal, setOnboardingGoal] = useState<OnboardingGoal | null | undefined>(
    undefined,
  );
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/api/users/me/examples')
      .then((res) => {
        if (cancelled) return;
        setOnboardingGoal(res.data?.data?.onboardingGoal ?? null);
      })
      .catch(() => {
        if (!cancelled) setOnboardingGoal(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistGoal = async (goal: OnboardingGoal) => {
    setSavingGoal(true);
    try {
      await axios.put('/api/users/me/onboarding-goal', { goal });
      setOnboardingGoal(goal);
      // Best-effort usage event — never block the UX on telemetry failures.
      axios
        .post('/api/usage-events', {
          eventName: 'onboarding_goal_selected',
          metadata: { goal },
        })
        .catch(() => undefined);
      const dest = GOAL_DESTINATION[goal];
      if (dest && dest !== '/dashboard') navigate(dest);
    } finally {
      setSavingGoal(false);
    }
  };

  const stats = dashboardData?.stats ?? [
    { name: 'Active Projects', value: '0', iconName: 'FiFolder', href: '/projects', color: 'bg-purple-500' },
    { name: 'Patterns', value: '0', iconName: 'FiBook', href: '/patterns', color: 'bg-blue-500' },
    { name: 'Yarn Skeins', value: '0', iconName: 'FiPackage', href: '/yarn', color: 'bg-green-500' },
    { name: 'Recipients', value: '0', iconName: 'FiUsers', href: '/recipients', color: 'bg-orange-500' },
  ];
  const recentProjects = dashboardData?.recentProjects ?? [];
  const lowStockYarn = dashboardData?.lowStockYarn ?? [];

  // Lightweight per-project pattern map — used to flag "this project doesn't
  // have a pattern attached yet" on the Continue cards. Falls back gracefully
  // when the endpoint hiccups so the Dashboard always renders.
  const { data: feasibilitySummaries } = useQuery<FeasibilitySummary[]>({
    queryKey: ['dashboard-feasibility-summary'],
    queryFn: async () => {
      const { data } = await axios.get('/api/projects/feasibility-summary');
      return (data?.data?.summaries as FeasibilitySummary[]) ?? [];
    },
    staleTime: 30_000,
  });

  const projectHasPattern = useMemo(() => {
    const set = new Set<string>();
    for (const s of feasibilitySummaries ?? []) {
      if (s.patternId) set.add(s.projectId);
    }
    return (id: string) => set.has(id);
  }, [feasibilitySummaries]);

  // The Continue queue: most recent ACTIVE projects, capped to 3 cards. We
  // surface only active projects so this section reads as "things you're
  // working on now," not a duplicate of the Recent Projects list below.
  const continueQueue = useMemo(
    () => recentProjects.filter((p: any) => p.status === 'active').slice(0, 3),
    [recentProjects],
  );

  // Setup-gap rollups across the recent slice — each card has its own hint
  // already; this banner gives an at-a-glance count when several projects
  // are missing the same thing so the user can act in bulk.
  const setupGapCount = useMemo(() => {
    return recentProjects.filter(
      (p: any) => p.status === 'active' && !projectHasPattern(p.id),
    ).length;
  }, [recentProjects, projectHasPattern]);

  const quickActions = [
    {
      name: 'New Project',
      description: 'Start tracking a new knit or crochet project',
      href: '/projects?new=1',
      icon: FiFolder,
      color: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
      testId: 'quick-action-new-project',
    },
    {
      name: 'Add Pattern',
      description: 'Save a pattern to your library',
      href: '/patterns?new=1',
      icon: FiBook,
      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
      testId: 'quick-action-add-pattern',
    },
    {
      name: 'Add Yarn',
      description: 'Add yarn to your stash',
      href: '/yarn?new=1',
      icon: FiPackage,
      color: 'text-green-600 bg-green-50 hover:bg-green-100',
      testId: 'quick-action-add-yarn',
    },
  ];

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Pick up where you left off, or start something new — knit, crochet, all of it lives here.
          </p>
        </div>
        <Link
          to="/help"
          className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition min-h-[44px]"
        >
          <FiHelpCircle className="h-4 w-4" />
          Help
        </Link>
      </div>

      {/* CYC seasonal banner — renders only during Stitch Away Stress
          (April) and I Love Yarn Day (2nd Sat of October). Idle the
          rest of the year. */}
      <div className="mb-6">
        <CycEventBanner />
      </div>

      {isError && (
        <ErrorState
          title="Couldn't load your dashboard"
          message="We hit an error fetching your dashboard data. Some numbers below may be stale or missing."
          onRetry={() => refetch()}
          className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow"
        />
      )}

      {/* Goal-pick card — shown once after registration until answered. Skip
          persists `track_project` so we don't reshow it. Replaces the old
          three-card "Get started with Rowly" hero, which was duplicative once
          this card began driving routing. Profile → Onboarding lets the user
          reset the goal if they want the card back. */}
      {onboardingGoal === null && (
        <OnboardingGoalCard
          saving={savingGoal}
          onSelect={persistGoal}
          onSkip={() => persistGoal('track_project')}
        />
      )}

      <CmdKTooltip />

      {/* Continue area — only shown when the user has at least one active
          project. Direct-resume CTA goes to ProjectDetail where the
          "Resume Knitting" toggle lives. */}
      {!loading && continueQueue.length > 0 && (
        <section className="mb-8" aria-label="Continue your work">
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Continue
            </h2>
            <Link
              to="/projects?status=active"
              className="text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              All active projects →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {continueQueue.map((project: any) => {
              const missingPattern = !projectHasPattern(project.id);
              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  data-testid="continue-project-card"
                  className="group bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {project.name}
                      </h3>
                      {project.project_type && (
                        <p className="text-xs text-gray-500 capitalize">
                          {project.project_type}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-800">
                      Active
                    </span>
                  </div>

                  {missingPattern ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                      No pattern attached yet — add one to unlock feasibility + Make Mode.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mb-3">
                      Started {formatDate(project.created_at)}
                    </p>
                  )}

                  <span className="mt-auto inline-flex items-center justify-center min-h-[44px] gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white group-hover:bg-purple-700">
                    <FiPlay className="h-4 w-4" />
                    Resume
                  </span>
                </Link>
              );
            })}
          </div>

          {setupGapCount > 0 && (
            <div
              className="mt-4 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-3"
              role="status"
            >
              <FiAlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                {setupGapCount === 1
                  ? '1 active project is missing a pattern.'
                  : `${setupGapCount} active projects are missing a pattern.`}{' '}
                <Link
                  to="/patterns?new=1"
                  className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
                >
                  Add one now
                </Link>
                .
              </p>
            </div>
          )}
        </section>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="animate-pulse flex items-center justify-between">
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
                <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            </div>
          ))
        ) : (
          stats.map((stat) => {
            const Icon = iconMap[stat.iconName] || FiFolder;
            return (
              <Link
                key={stat.name}
                to={stat.href}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Quick Actions — every link carries `?new=1` so the destination
          page opens its create modal immediately instead of dropping the
          user on a list page they have to scan. */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.name}
                to={action.href}
                data-testid={action.testId}
                className={`${action.color} rounded-lg p-6 transition min-h-[88px]`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-semibold flex items-center gap-1">
                      {action.name}
                      <FiArrowRight className="h-3 w-3 opacity-70" />
                    </h3>
                    <p className="text-xs mt-1 opacity-75">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {!loading && lowStockYarn.length > 0 && (
        <div className="mb-8">
          <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-6">
            <div className="flex items-start mb-4">
              <FiAlertCircle className="h-6 w-6 text-orange-600 mr-3 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-orange-900 mb-1">
                  Low Stock Alerts
                </h2>
                <p className="text-sm text-orange-700">
                  The following yarn items are running low and need restocking:
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {lowStockYarn.map((yarn) => {
                const currentQty = yarn.remaining_length_m != null
                  ? metersToYards(yarn.remaining_length_m)
                  : (yarn.yards_remaining || 0);
                const threshold = yarn.low_stock_threshold || 0;
                const percentRemaining = threshold > 0 ? (currentQty / threshold) * 100 : 0;

                return (
                  <Link
                    key={yarn.id}
                    to="/yarn"
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {yarn.brand} {yarn.name}
                        </h3>
                        <span className="text-sm font-medium text-orange-600">
                          {fmt.yarnLength(yarn.remaining_length_m ?? (yarn.yards_remaining != null ? yarn.yards_remaining * 0.9144 : null))} / {threshold} {labels.yardageShort}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, percentRemaining)}%` }}
                        />
                      </div>

                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <FiPackage className="mr-2 h-4 w-4" />
                        {yarn.color && <span className="mr-3">Color: {yarn.color}</span>}
                        {yarn.weight && <span>Weight: {yarn.weight}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-orange-200">
              <Link
                to="/yarn"
                className="text-sm font-medium text-orange-700 hover:text-orange-800 flex items-center"
              >
                View all yarn in stash
                <span className="ml-2">→</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Recent Projects</h2>
        {loading ? (
          <LoadingSkeleton lines={4} />
        ) : recentProjects.length === 0 ? (
          <div className="text-center py-12">
            <FiFolder className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No projects yet</p>
            <Link
              to="/projects?new=1"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition min-h-[44px]"
            >
              <FiPlus className="mr-2 h-4 w-4" />
              Create Your First Project
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <FiFolder className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{project.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {project.type && (
                        <span className="capitalize">{project.type}</span>
                      )}
                      {project.status && (
                        <span className="ml-2 capitalize">{project.status}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(project.created_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
