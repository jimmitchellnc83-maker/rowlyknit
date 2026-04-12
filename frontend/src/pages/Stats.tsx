import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiCheckCircle,
  FiLayers,
  FiClock,
  FiTrendingUp,
  FiFolder,
  FiChevronRight,
  FiAward
} from 'react-icons/fi';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

interface StatsData {
  totalCompleted: number;
  totalRows: number;
  totalSeconds: number;
  currentStreak: number;
  longestStreak: number;
  activityData: Array<{ date: string; rows: number }>;
  recentProjects: Array<{
    id: string;
    name: string;
    status: string;
    rows_completed: number;
    total_seconds: number;
    updated_at: string;
  }>;
}

type TimePeriod = 'today' | 'week' | 'month' | 'all';

// Helper to format seconds to readable time
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

// Stat Card Component
interface StatCardProps {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
  sublabel?: string;
}

function StatCard({ value, label, icon, color, loading, sublabel }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-3 rounded-lg`}>
          {icon}
        </div>
        {sublabel && (
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {sublabel}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

// Activity Graph Component
interface ActivityGraphProps {
  data: Array<{ date: string; rows: number }>;
  loading?: boolean;
}

function ActivityGraph({ data, loading }: ActivityGraphProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Activity Over Time
        </h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <FiTrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Start knitting to see your activity!</p>
          </div>
        </div>
      </div>
    );
  }

  // Format date for tooltip
  const formatTooltipDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format date for x-axis
  const formatAxisDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Activity Over Time
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => value.toLocaleString()}
            />
            <Tooltip
              labelFormatter={formatTooltipDate}
              formatter={(value: number) => [`${value.toLocaleString()} rows`, 'Rows Knitted']}
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
                color: '#F9FAFB'
              }}
            />
            <Line
              type="monotone"
              dataKey="rows"
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={{ fill: '#8B5CF6', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: '#8B5CF6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Recent Projects List Component
interface RecentProjectsProps {
  projects: StatsData['recentProjects'];
  loading?: boolean;
}

function RecentProjectsList({ projects, loading }: RecentProjectsProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center p-4 animate-pulse">
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg mr-4" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Projects
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <FiFolder className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No projects yet. Create one to get started!</p>
          <Link
            to="/projects"
            className="mt-4 inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Create Project
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Projects
        </h3>
        <Link
          to="/projects"
          className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center"
        >
          View all
          <FiChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
      <div className="space-y-2">
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition group"
          >
            <div className="flex items-center">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-lg mr-4">
                <FiFolder className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                  {project.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {project.rows_completed.toLocaleString()} rows
                  {project.total_seconds > 0 && ` in ${formatTime(project.total_seconds)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full capitalize ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
              <FiChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Main Stats Page Component
export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');

  useEffect(() => {
    fetchStats();
  }, [timePeriod]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/stats?period=${timePeriod}`);
      if (response.data.success) {
        setStats(response.data.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const periodLabels: Record<TimePeriod, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    all: 'All Time'
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Your Knitting Stats
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your progress and celebrate your achievements
        </p>
      </div>

      {/* Time Period Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(Object.keys(periodLabels) as TimePeriod[]).map((period) => (
          <button
            key={period}
            onClick={() => setTimePeriod(period)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              timePeriod === period
                ? 'bg-purple-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {periodLabels[period]}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          value={stats?.totalCompleted || 0}
          label="Projects Completed"
          icon={<FiCheckCircle className="h-6 w-6 text-white" />}
          color="bg-green-500"
          loading={loading}
        />
        <StatCard
          value={stats?.totalRows || 0}
          label="Rows Knitted"
          icon={<FiLayers className="h-6 w-6 text-white" />}
          color="bg-purple-500"
          loading={loading}
        />
        <StatCard
          value={stats ? formatTime(stats.totalSeconds) : '0h'}
          label="Time Knitting"
          icon={<FiClock className="h-6 w-6 text-white" />}
          color="bg-blue-500"
          loading={loading}
        />
        <StatCard
          value={stats?.currentStreak || 0}
          label="Day Streak"
          icon={<FiTrendingUp className="h-6 w-6 text-white" />}
          color="bg-orange-500"
          loading={loading}
          sublabel={stats && stats.longestStreak > 0 ? `Best: ${stats.longestStreak}` : undefined}
        />
      </div>

      {/* Achievement Banner (if current streak is active) */}
      {!loading && stats && stats.currentStreak >= 3 && (
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl p-6 mb-8 text-white">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full">
              <FiAward className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {stats.currentStreak} Day Streak!
              </h3>
              <p className="text-white/80">
                You've been knitting for {stats.currentStreak} days in a row. Keep it up!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Activity Graph */}
      <div className="mb-8">
        <ActivityGraph data={stats?.activityData || []} loading={loading} />
      </div>

      {/* Recent Projects */}
      <RecentProjectsList projects={stats?.recentProjects || []} loading={loading} />
    </div>
  );
}
