import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import ErrorBoundary from './components/ErrorBoundary';

// Layouts
import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Patterns from './pages/Patterns';
import PatternDetail from './pages/PatternDetail';
import YarnStash from './pages/YarnStash';
import YarnDetail from './pages/YarnDetail';
import Tools from './pages/Tools';
import Calculators from './pages/Calculators';
import GaugeCalculator from './pages/GaugeCalculator';
import Recipients from './pages/Recipients';
import Profile from './pages/Profile';
import Stats from './pages/Stats';
import Help from './pages/Help';
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

function App() {
  return (
    <>
      <OfflineIndicator />
      <PWAInstallPrompt />
      <Routes>
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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ErrorBoundary><ProjectDetail /></ErrorBoundary>} />
        <Route path="/patterns" element={<Patterns />} />
        <Route path="/patterns/:id" element={<ErrorBoundary><PatternDetail /></ErrorBoundary>} />
        <Route path="/yarn" element={<ErrorBoundary><YarnStash /></ErrorBoundary>} />
        <Route path="/yarn/:id" element={<ErrorBoundary><YarnDetail /></ErrorBoundary>} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/calculators" element={<Calculators />} />
        <Route path="/calculators/gauge" element={<ErrorBoundary><GaugeCalculator /></ErrorBoundary>} />
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
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
