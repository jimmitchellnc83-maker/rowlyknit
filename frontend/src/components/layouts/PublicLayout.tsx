import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import ThemeToggle from '../ThemeToggle';

// Layout for public, indexable pages (calculators, future SEO landing
// pages). Auth-aware: signed-in users see "Open Dashboard"; anonymous
// visitors get sign-in / sign-up CTAs. Kept intentionally minimal so the
// calculator content dominates the viewport.
export default function PublicLayout() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:py-4">
          <Link
            to="/"
            className="text-xl font-bold text-purple-600 dark:text-purple-400"
          >
            Rowly
          </Link>
          <nav aria-label="Public" className="flex items-center gap-1 md:gap-3">
            <Link
              to="/calculators"
              className="px-2 py-2 text-sm font-medium text-gray-700 hover:text-purple-600 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-gray-700/50 md:px-3"
            >
              Tools
            </Link>
            <Link
              to="/help/glossary"
              className="hidden px-3 py-2 text-sm font-medium text-gray-700 hover:text-purple-600 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-gray-700/50 md:inline-flex"
            >
              Glossary
            </Link>
            <ThemeToggle />
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 md:px-4 md:py-2"
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden text-sm font-medium text-gray-700 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 sm:inline-flex sm:px-3 sm:py-2"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 md:px-4 md:py-2"
                >
                  Sign up free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">
        <Outlet />
      </main>

      <footer className="mt-12 border-t border-gray-200 bg-white py-8 dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Built by{' '}
            <Link to="/" className="font-medium text-purple-600 hover:underline dark:text-purple-400">
              Rowly
            </Link>{' '}
            — your knitting workspace. Track projects, organize your stash, design garments.
          </p>
          <div className="mt-3 flex justify-center gap-4 text-xs">
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link to="/terms" className="hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
