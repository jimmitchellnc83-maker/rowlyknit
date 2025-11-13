import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import GlobalSearch from '../GlobalSearch';
import ThemeToggle from '../ThemeToggle';
import { SyncIndicator } from '../offline/SyncIndicator';
import { ConflictResolver, DataConflict } from '../offline/ConflictResolver';
import {
  FiHome,
  FiFolder,
  FiBook,
  FiPackage,
  FiTool,
  FiUsers,
  FiUser,
  FiLogOut
} from 'react-icons/fi';

export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [conflicts, setConflicts] = useState<DataConflict[]>([]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleResolveConflict = async (conflictId: string, resolution: 'local' | 'server' | 'merge') => {
    // Remove resolved conflict from state
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
    // In a real app, this would sync the resolution to the server
    console.log(`Resolved conflict ${conflictId} with ${resolution}`);
  };

  const handleResolveAllConflicts = async (resolution: 'local' | 'server') => {
    setConflicts([]);
    console.log(`Resolved all conflicts with ${resolution}`);
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: FiHome, shortName: 'Home' },
    { name: 'Projects', href: '/projects', icon: FiFolder, shortName: 'Projects' },
    { name: 'Patterns', href: '/patterns', icon: FiBook, shortName: 'Patterns' },
    { name: 'Yarn Stash', href: '/yarn', icon: FiPackage, shortName: 'Stash' },
    { name: 'Tools', href: '/tools', icon: FiTool, shortName: 'Tools' },
    { name: 'Recipients', href: '/recipients', icon: FiUsers, shortName: 'Recipients' },
  ];

  const mainNavigation = navigation.slice(0, 5); // First 5 for mobile bottom nav

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 pb-20 md:pb-0">
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:w-64 md:block bg-white dark:bg-gray-800 shadow-lg transition-colors duration-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-4 h-16 bg-purple-600 dark:bg-purple-700">
            <h1 className="text-2xl font-bold text-white">Rowly</h1>
            <ThemeToggle />
          </div>

          {/* Search */}
          <div className="px-4 py-3">
            <GlobalSearch />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-6 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-r-4 border-purple-600 dark:border-purple-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-purple-600 dark:bg-purple-700 flex items-center justify-center text-white font-semibold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>

            <Link
              to="/profile"
              className="flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg mb-2 transition"
            >
              <FiUser className="mr-2 h-4 w-4" />
              Profile
            </Link>

            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            >
              <FiLogOut className="mr-2 h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 md:hidden z-40">
        <div className="flex justify-around items-center h-20">
          {mainNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 ${
                  isActive
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon className="h-7 w-7 mb-1" />
                <span className="text-xs font-medium truncate">{item.shortName}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <div className="md:ml-64">
        {/* Sync Indicator - Fixed position */}
        <div className="fixed top-4 right-4 z-50">
          <SyncIndicator />
        </div>

        {/* Conflict Resolver - Top of content area */}
        {conflicts.length > 0 && (
          <div className="p-4 md:p-6 lg:p-8 pb-0">
            <ConflictResolver
              conflicts={conflicts}
              onResolve={handleResolveConflict}
              onResolveAll={handleResolveAllConflicts}
            />
          </div>
        )}

        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
