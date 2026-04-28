import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { usePageviews } from './hooks/usePageviews';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import ErrorBoundary from './components/ErrorBoundary';

// Layouts
import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';
import PublicLayout from './components/layouts/PublicLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import PanelHub from './pages/PanelHub';
import PanelKnittingView from './pages/PanelKnittingView';
import PanelGroupSetup from './pages/PanelGroupSetup';
import Patterns from './pages/Patterns';
import PatternDetail from './pages/PatternDetail';
import YarnStash from './pages/YarnStash';
import YarnDetail from './pages/YarnDetail';
import Tools from './pages/Tools';
import Calculators from './pages/Calculators';
import GaugeCalculator from './pages/GaugeCalculator';
import YarnSubstitutionCalculator from './pages/YarnSubstitutionCalculator';
import GiftSizeCalculator from './pages/GiftSizeCalculator';
import PatternDesigner from './pages/PatternDesigner';
import AuthorMode from './pages/AuthorMode';
import MakeMode from './pages/MakeMode';
import PatternPrintView from './pages/PatternPrintView';
import ChartsLibrary from './pages/ChartsLibrary';
import Recipients from './pages/Recipients';
import Profile from './pages/Profile';
import Stats from './pages/Stats';
import Help from './pages/Help';
import AdminUsage from './pages/AdminUsage';
import PublicProjectPage from './pages/PublicProjectPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import RavelryCallback from './pages/auth/RavelryCallback';
import RavelrySync from './pages/RavelrySync';
import RavelryStashSync from './pages/RavelryStashSync';
import RavelryProjectsSync from './pages/RavelryProjectsSync';
import RavelryFavoriteYarnsSync from './pages/RavelryFavoriteYarnsSync';
import RavelryBookmarks from './pages/RavelryBookmarks';
import RavelryBookmarksSync from './pages/RavelryBookmarksSync';
import RavelryFavorites from './pages/RavelryFavorites';
import NotFound from './pages/NotFound';

// Lazy-load public pages so unauthenticated visitors don't pay for the full
// authenticated-app bundle just to read marketing or legal copy.
const Landing = lazy(() => import('./pages/Landing'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));

// Protected route wrapper
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Public route wrapper (redirect to dashboard if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

// Shared Suspense fallback for every lazy-loaded public page.
function PublicSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

// Landing route — redirect authenticated visitors straight into the app so
// the root URL is still "home" for returning users; new visitors get the
// public marketing page with signup CTAs.
function LandingOrDashboard() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return (
    <PublicSuspense>
      <Landing />
    </PublicSuspense>
  );
}

function App() {
  usePageviews();
  return (
    <>
      <OfflineIndicator />
      <PWAInstallPrompt />
      <Routes>
      {/* Public root — landing page for unauthenticated visitors */}
      <Route path="/" element={<LandingOrDashboard />} />

      {/* Public legal pages — accessible regardless of auth state */}
      <Route path="/privacy" element={<PublicSuspense><Privacy /></PublicSuspense>} />
      <Route path="/terms" element={<PublicSuspense><Terms /></PublicSuspense>} />

      {/* Public, indexable calculator pages. Drives organic search ("knitting
          gauge calculator") and surfaces Rowly to knitters who haven't
          signed up yet. Yarn-substitution stays auth-only because it scores
          the user's stash. */}
      <Route element={<PublicLayout />}>
        <Route path="/calculators" element={<Calculators />} />
        <Route path="/calculators/gauge" element={<ErrorBoundary><GaugeCalculator /></ErrorBoundary>} />
        <Route path="/calculators/gift-size" element={<ErrorBoundary><GiftSizeCalculator /></ErrorBoundary>} />
        <Route path="/p/:slug" element={<ErrorBoundary><PublicProjectPage /></ErrorBoundary>} />
      </Route>

        {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Route>

      {/* Protected routes */}
      <Route
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ErrorBoundary><ProjectDetail /></ErrorBoundary>} />
        <Route path="/projects/:id/panels" element={<ErrorBoundary><PanelHub /></ErrorBoundary>} />
        <Route path="/projects/:id/panels/:groupId" element={<ErrorBoundary><PanelKnittingView /></ErrorBoundary>} />
        <Route path="/projects/:id/panels/:groupId/setup" element={<ErrorBoundary><PanelGroupSetup /></ErrorBoundary>} />
        <Route path="/patterns" element={<Patterns />} />
        <Route path="/patterns/:id" element={<ErrorBoundary><PatternDetail /></ErrorBoundary>} />
        <Route path="/patterns/:id/author" element={<ErrorBoundary><AuthorMode /></ErrorBoundary>} />
        <Route path="/patterns/:id/make" element={<ErrorBoundary><MakeMode /></ErrorBoundary>} />
        <Route path="/yarn" element={<ErrorBoundary><YarnStash /></ErrorBoundary>} />
        <Route path="/yarn/:id" element={<ErrorBoundary><YarnDetail /></ErrorBoundary>} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/calculators/yarn-sub" element={<ErrorBoundary><YarnSubstitutionCalculator /></ErrorBoundary>} />
        <Route path="/designer" element={<ErrorBoundary><PatternDesigner /></ErrorBoundary>} />
        <Route path="/designer/print" element={<ErrorBoundary><PatternPrintView /></ErrorBoundary>} />
        <Route path="/charts" element={<ErrorBoundary><ChartsLibrary /></ErrorBoundary>} />
        <Route path="/recipients" element={<Recipients />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth/ravelry/callback" element={<RavelryCallback />} />
        <Route path="/ravelry/sync" element={<RavelrySync />} />
        <Route path="/ravelry/stash/sync" element={<RavelryStashSync />} />
        <Route path="/ravelry/projects/sync" element={<RavelryProjectsSync />} />
        <Route path="/ravelry/favorites/yarns/sync" element={<RavelryFavoriteYarnsSync />} />
        <Route path="/ravelry/bookmarks" element={<RavelryBookmarks />} />
        <Route path="/ravelry/bookmarks/sync" element={<RavelryBookmarksSync />} />
        <Route path="/ravelry/favorites" element={<RavelryFavorites />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/help" element={<Help />} />
        <Route path="/admin/usage" element={<ErrorBoundary><AdminUsage /></ErrorBoundary>} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
