import { Link } from 'react-router-dom';
import { FiFolder, FiBook, FiPackage, FiUsers, FiPlus } from 'react-icons/fi';
import { useAuthStore } from '../stores/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();

  const stats = [
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
  ];

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
        {stats.map((stat) => {
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
        })}
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

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
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
      </div>
    </div>
  );
}
