import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiFolder, FiBook, FiPackage, FiUsers, FiPlus, FiAlertCircle } from 'react-icons/fi';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState([
    {
      name: 'Active Projects',
      value: '0',
      icon: FiFolder,
      href: '/projects',
      color: 'bg-purple-500',
    },
    {
      name: 'Patterns',
      value: '0',
      icon: FiBook,
      href: '/patterns',
      color: 'bg-blue-500',
    },
    {
      name: 'Yarn Skeins',
      value: '0',
      icon: FiPackage,
      href: '/yarn',
      color: 'bg-green-500',
    },
    {
      name: 'Recipients',
      value: '0',
      icon: FiUsers,
      href: '/recipients',
      color: 'bg-orange-500',
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [lowStockYarn, setLowStockYarn] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [projectsRes, patternsRes, yarnRes, recipientsRes, recentProjectsRes, allYarnRes] = await Promise.all([
        axios.get('/api/projects/stats'),
        axios.get('/api/patterns/stats'),
        axios.get('/api/yarn/stats'),
        axios.get('/api/recipients/stats'),
        axios.get('/api/projects?limit=5'),
        axios.get('/api/yarn'),
      ]);

      setStats([
        {
          name: 'Active Projects',
          value: String(projectsRes.data.data.stats.active_count || 0),
          icon: FiFolder,
          href: '/projects',
          color: 'bg-purple-500',
        },
        {
          name: 'Patterns',
          value: String(patternsRes.data.data.stats.total_count || 0),
          icon: FiBook,
          href: '/patterns',
          color: 'bg-blue-500',
        },
        {
          name: 'Yarn Skeins',
          value: String(yarnRes.data.data.stats.total_skeins || 0),
          icon: FiPackage,
          href: '/yarn',
          color: 'bg-green-500',
        },
        {
          name: 'Recipients',
          value: String(recipientsRes.data.data.stats.total_count || 0),
          icon: FiUsers,
          href: '/recipients',
          color: 'bg-orange-500',
        },
      ]);

      setRecentProjects(recentProjectsRes.data.data.projects || []);

      // Filter yarn items with low stock alerts
      const allYarn = allYarnRes.data.data.yarn || [];
      const lowStock = allYarn.filter((y: any) => {
        if (!y.low_stock_alert || !y.low_stock_threshold) return false;
        const currentQuantity = y.quantity_remaining || y.skeins || 0;
        return currentQuantity <= y.low_stock_threshold;
      });
      setLowStockYarn(lowStock);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your knitting projects today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
          <div className="col-span-full text-center py-8">
            <div className="text-gray-500">Loading statistics...</div>
          </div>
        ) : (
          stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.name}
                to={stat.href}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
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
                const currentQty = yarn.quantity_remaining || yarn.skeins || 0;
                const threshold = yarn.low_stock_threshold || 0;
                const percentRemaining = threshold > 0 ? (currentQty / threshold) * 100 : 0;

                return (
                  <Link
                    key={yarn.id}
                    to="/yarn"
                    className="flex items-center justify-between p-4 bg-white rounded-lg hover:shadow-md transition"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {yarn.brand} {yarn.name}
                        </h3>
                        <span className="text-sm font-medium text-orange-600">
                          {currentQty} / {threshold} {yarn.unit}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, percentRemaining)}%` }}
                        />
                      </div>

                      <div className="flex items-center text-sm text-gray-600">
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
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Projects</h2>
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading recent projects...</div>
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="text-center py-12">
            <FiFolder className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">No projects yet</p>
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
                className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <FiFolder className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-500">
                      {project.type && (
                        <span className="capitalize">{project.type}</span>
                      )}
                      {project.status && (
                        <span className="ml-2 capitalize">{project.status}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
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
