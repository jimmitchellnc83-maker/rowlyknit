import { Link } from 'react-router-dom';
import {
  FiFolder,
  FiBook,
  FiPackage,
  FiUsers,
  FiPlus,
  FiAlertCircle,
  FiHelpCircle,
  FiTool,
  FiArrowRight,
  FiDownload,
} from 'react-icons/fi';
import { useAuthStore } from '../stores/authStore';
import { useDashboardStats } from '../hooks/useApi';
import { useMeasurements } from '../hooks/useMeasurements';
import { LoadingSkeleton, ErrorState } from '../components/LoadingSpinner';
import { metersToYards } from '../utils/yarnUnits';

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  FiFolder,
  FiBook,
  FiPackage,
  FiUsers,
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const { data: dashboardData, isLoading: loading, isError, refetch } = useDashboardStats();
  const { fmt } = useMeasurements();

  const stats = dashboardData?.stats ?? [
    { name: 'Active Projects', value: '0', iconName: 'FiFolder', href: '/projects', color: 'bg-purple-500' },
    { name: 'Patterns', value: '0', iconName: 'FiBook', href: '/patterns', color: 'bg-blue-500' },
    { name: 'Yarn Skeins', value: '0', iconName: 'FiPackage', href: '/yarn', color: 'bg-green-500' },
    { name: 'Recipients', value: '0', iconName: 'FiUsers', href: '/recipients', color: 'bg-orange-500' },
  ];
  const recentProjects = dashboardData?.recentProjects ?? [];
  const lowStockYarn = dashboardData?.lowStockYarn ?? [];

  // A brand-new user has empty counts across the board. We show a dedicated
  // "get started" hero only in that state so returning users aren't nagged
  // with onboarding content. We rely on the stats payload when present and
  // fall back to the recent-projects list to avoid a flash of onboarding
  // during initial fetch for existing users.
  const isBrandNewUser =
    !loading &&
    dashboardData !== undefined &&
    stats.every((s) => String(s.value) === '0') &&
    recentProjects.length === 0;

  const quickActions = [
    {
      name: 'New Project',
      description: 'Start tracking a new knitting project',
      href: '/projects',
      icon: FiFolder,
      color: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
    },
    {
      name: 'Add Pattern',
      description: 'Save a new knitting pattern',
      href: '/patterns',
      icon: FiBook,
      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
    },
    {
      name: 'Add Yarn',
      description: 'Add yarn to your stash',
      href: '/yarn',
      icon: FiPackage,
      color: 'text-green-600 bg-green-50 hover:bg-green-100',
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
            Here's what's happening with your knitting projects today.
          </p>
        </div>
        <Link
          to="/help"
          className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
        >
          <FiHelpCircle className="h-4 w-4" />
          Help
        </Link>
      </div>

      {isError && (
        <ErrorState
          title="Couldn't load your dashboard"
          message="We hit an error fetching your dashboard data. Some numbers below may be stale or missing."
          onRetry={() => refetch()}
          className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow"
        />
      )}

      {/* First-run onboarding — visible only when the user has no data yet. */}
      {isBrandNewUser && (
        <section
          aria-labelledby="onboarding-heading"
          className="mb-8 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm dark:border-purple-900/40 dark:from-purple-900/20 dark:to-gray-800 md:p-8"
        >
          <h2
            id="onboarding-heading"
            className="text-2xl font-bold text-gray-900 dark:text-gray-100"
          >
            Get started with Rowly
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Pick the door that matches what you're doing right now. You can always come back.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <OnboardingAction
              icon={<FiFolder className="h-5 w-5" />}
              title="Start a project"
              body="Log what you're knitting right now — counters, notes, photos, pattern files."
              cta="New project"
              to="/projects"
              accent="purple"
            />
            <OnboardingAction
              icon={<FiTool className="h-5 w-5" />}
              title="Design a pattern"
              body="Gauge + measurements → cast-on, shaping, schematic. Eight item types."
              cta="Open Designer"
              to="/designer"
              accent="blue"
            />
            <OnboardingAction
              icon={<FiDownload className="h-5 w-5" />}
              title="Import from Ravelry"
              body="Bring in projects, stash, favorite yarns, and bookmarks from your Ravelry account."
              cta="Connect Ravelry"
              to="/ravelry/sync"
              accent="amber"
            />
          </div>
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

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.name}
                to={action.href}
                className={`${action.color} rounded-lg p-6 transition`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-semibold">{action.name}</h3>
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
                          {fmt.yarnLength(yarn.remaining_length_m, yarn.yards_remaining)} / {threshold} {fmt.yarnLengthUnit()}
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
              to="/projects"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
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
                  {new Date(project.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ACTION_ACCENTS = {
  purple: {
    icon: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    cta: 'text-purple-700 dark:text-purple-300 hover:underline',
  },
  blue: {
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    cta: 'text-blue-700 dark:text-blue-300 hover:underline',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    cta: 'text-amber-700 dark:text-amber-300 hover:underline',
  },
} as const;

function OnboardingAction({
  icon,
  title,
  body,
  cta,
  to,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  to: string;
  accent: keyof typeof ACTION_ACCENTS;
}) {
  const a = ACTION_ACCENTS[accent];
  return (
    <Link
      to={to}
      className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-purple-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/70 dark:hover:border-purple-500"
    >
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${a.icon}`}>
        {icon}
      </div>
      <h3 className="mt-3 font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{body}</p>
      <span className={`mt-3 inline-flex items-center gap-1 text-sm font-medium ${a.cta}`}>
        {cta} <FiArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
