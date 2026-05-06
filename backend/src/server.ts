import http from 'http';
import * as Sentry from '@sentry/node';
import app from './app';
import { initializeSocket } from './config/socket';
import { assertDatabaseReady } from './config/database';
import { assertAppUrlValid } from './config/appUrl';
import logger from './config/logger';

// Initialize Sentry (before anything else). When the DSN is unset in
// production we log a loud warning so missing error tracking is visible
// at startup; the audit caught this once already (2026-04-30) and we
// didn't want a silent regression.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
  logger.info('Sentry error monitoring initialized');
} else if (process.env.NODE_ENV === 'production') {
  logger.warn(
    'SENTRY_DSN is not set — production errors are NOT being tracked. ' +
    'Set SENTRY_DSN in backend/.env (and VITE_SENTRY_DSN at frontend build time) ' +
    'to enable error monitoring.'
  );
}

const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = http.createServer(app);

// Request timeout configuration
httpServer.timeout = 30000;          // 30s general timeout
httpServer.keepAliveTimeout = 65000; // above nginx keepalive (60s)
httpServer.headersTimeout = 66000;   // slightly above keepAliveTimeout

// Initialize Socket.IO
initializeSocket(httpServer);

// Start server. Database readiness now runs here (was at module-import
// time inside config/database.ts) so unit tests don't crash on a missing
// Postgres. assertDatabaseReady will process.exit(1) on failure outside
// the test env, mirroring the prior behavior at the right boundary.
if (process.env.NODE_ENV !== 'test') {
  // Fail fast in production if APP_URL is missing or invalid. Email
  // links, checkout redirects, share URLs, and GDPR confirm links all
  // depend on it; a silent localhost fallback ships broken links to
  // real users. Throws synchronously → process exits non-zero.
  try {
    assertAppUrlValid();
  } catch (err) {
    logger.error('APP_URL validation failed at boot', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  void assertDatabaseReady().then(() => {
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Rowly API server running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔌 Socket.IO ready for real-time connections`);
    });
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection:', err);
  httpServer.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  httpServer.close(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default httpServer;
