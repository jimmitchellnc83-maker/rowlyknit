import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { KnittingModeProvider, useKnittingMode } from '../../contexts/KnittingModeContext';
import GlobalSearch from '../GlobalSearch';
import ThemeToggle from '../ThemeToggle';
import { SyncIndicator } from '../offline/SyncIndicator';
import { ConflictResolver, DataConflict } from '../offline/ConflictResolver';
import PageHelp from '../help/PageHelp';
import QuickCreate from '../quick-create/QuickCreate';
import GuidedTour from '../tour/GuidedTour';
import {
  FiHome,
  FiFolder,
  FiBook,
  FiPackage,
  FiTool,
  FiUsers,
  FiUser,
  FiLogOut,
  FiBarChart2,
  FiGrid,
  FiPenTool,
  FiMoreHorizontal,
} from 'react-icons/fi';

export default function MainLayout() {
  return (
    <KnittingModeProvider>
      <MainLayoutInner />
    </KnittingModeProvider>
  );
}

function MainLayoutInner() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [conflicts, setConflicts] = useState<DataConflict[]>([]);
  const { knittingMode } = useKnittingMode();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  // Close the mobile More popover whenever the route changes — the
  // user just navigated, no reason to keep it open. Also close on a
  // tap outside the popover so it doesn't stick around when the user
  // taps a non-nav target.
  useEffect(() => {
    if (mobileMoreOpen) setMobileMoreOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMoreOpen) return;
    function onPointerDown(e: PointerEvent) {
      const el = moreMenuRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setMobileMoreOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [mobileMoreOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleResolveConflict = async (conflictId: string, _resolution: 'local' | 'server' | 'merge') => {
    // Remove resolved conflict from state
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
    // In a real app, this would sync the resolution to the server
  };

  const handleResolveAllConflicts = async (_resolution: 'local' | 'server') => {
    setConflicts([]);
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: FiHome, shortName: 'Home' },
    { name: 'Stats', href: '/stats', icon: FiBarChart2, shortName: 'Stats' },
    { name: 'Projects', href: '/projects', icon: FiFolder, shortName: 'Projects' },
    { name: 'Patterns', href: '/patterns', icon: FiBook, shortName: 'Patterns' },
    { name: 'Designer', href: '/designer', icon: FiPenTool, shortName: 'Design' },
    { name: 'Charts', href: '/charts', icon: FiGrid, shortName: 'Charts' },
    { name: 'Yarn Stash', href: '/yarn', icon: FiPackage, shortName: 'Stash' },
    { name: 'Tools', href: '/tools', icon: FiTool, shortName: 'Tools' },
    { name: 'Calculators', href: '/calculators', icon: FiGrid, shortName: 'Calc' },
    { name: 'Recipients', href: '/recipients', icon: FiUsers, shortName: 'Recipients' },
  ];

  // Mobile bottom nav surfaces the four destinations a knitter actually
  // taps mid-session — Home / Projects / Patterns / Yarn — plus a More
  // bucket for everything else. Trying to fit all ten routes across a
  // phone-width strip squashed every label illegibly and no tap target
  // was comfortable. The "primary" set is the most-trafficked routes
  // per Plausible; if traffic shifts, swap entries here.
  const PRIMARY_ROUTES = ['/dashboard', '/projects', '/patterns', '/yarn'];
  const primaryNavigation = PRIMARY_ROUTES.map(
    (href) => navigation.find((n) => n.href === href)!,
  ).filter(Boolean);
  const moreNavigation = navigation.filter(
    (n) => !PRIMARY_ROUTES.includes(n.href),
  );
  const moreActive = moreNavigation.some((n) => location.pathname === n.href);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 pb-20 md:pb-0">
      {/* Desktop Sidebar - Hidden on mobile. Dimmed + non-interactive in Knitting
          Mode so the user can't misclick away mid-row. */}
      <aside
        aria-hidden={knittingMode}
        tabIndex={knittingMode ? -1 : undefined}
        className={`hidden md:fixed md:inset-y-0 md:left-0 md:w-64 md:block bg-white dark:bg-gray-800 shadow-lg transition-all duration-200 ${
          knittingMode ? 'opacity-30 pointer-events-none' : ''
        }`}
      >
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
          <nav className="flex-1 overflow-y-auto py-4" aria-label="Main navigation">
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
                  aria-label={item.name}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="mr-3 h-5 w-5" aria-hidden="true" />
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

      {/* Mobile Bottom Navigation — 4 primary destinations + a More
          surface that pops a sheet of the rest. Stops the strip from
          turning into a 10-icon mush at phone widths. */}
      <nav
        aria-hidden={knittingMode}
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 md:hidden z-40 transition-opacity duration-200 ${
          knittingMode ? 'opacity-30 pointer-events-none' : ''
        }`}
        aria-label="Main navigation"
      >
        <div className="flex justify-around items-stretch h-20">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 px-1 ${
                  isActive
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                aria-label={item.name}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-6 w-6 mb-1" aria-hidden="true" />
                <span className="text-xs font-medium truncate w-full text-center">
                  {item.shortName}
                </span>
              </Link>
            );
          })}

          {/* More: a 5th tab that opens a sheet of the rest of the nav. */}
          <button
            type="button"
            onClick={() => setMobileMoreOpen((v) => !v)}
            aria-expanded={mobileMoreOpen}
            aria-haspopup="menu"
            aria-label="More navigation"
            className={`flex flex-col items-center justify-center flex-1 min-w-0 px-1 ${
              mobileMoreOpen || moreActive
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            data-testid="mobile-nav-more"
          >
            <FiMoreHorizontal className="h-6 w-6 mb-1" aria-hidden="true" />
            <span className="text-xs font-medium truncate w-full text-center">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet — sits just above the bottom nav, opens on
          tap. The popover uses the same bg + border tokens so it feels
          continuous with the strip and not like a floating modal. */}
      {mobileMoreOpen && (
        <div
          ref={moreMenuRef}
          role="menu"
          aria-label="More navigation"
          className="md:hidden fixed bottom-20 left-2 right-2 z-50 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl p-2"
        >
          <div className="grid grid-cols-3 gap-1">
            {moreNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  role="menuitem"
                  onClick={() => setMobileMoreOpen(false)}
                  className={`flex flex-col items-center justify-center min-h-[64px] rounded-lg px-2 py-2 ${
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-6 w-6 mb-1" aria-hidden="true" />
                  <span className="text-xs font-medium truncate w-full text-center">
                    {item.shortName}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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

      <QuickCreate />
      <PageHelp />
      <GuidedTour />
    </div>
  );
}
