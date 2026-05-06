import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate environment variables before starting app
import { validateEnvironmentVariables, validateSecretStrength } from './utils/validateEnv';
validateEnvironmentVariables();
validateSecretStrength();

// Import configuration
import './config/database';
import './config/redis';
import { morganStream } from './config/logger';

// Import middleware
import { apiLimiter, publicSharedLimiter } from './middleware/rateLimiter';
import { sanitizeInput } from './middleware/validator';
import { auditMiddleware } from './middleware/auditLog';
import { errorHandler, notFoundHandler } from './utils/errorHandler';
import { conditionalCsrf, csrfErrorHandler, sendCsrfToken } from './middleware/csrf';
import { requestMetrics, metricsEndpoint } from './middleware/monitoring';

// Import routes
import authRoutes from './routes/auth';
import projectsRoutes from './routes/projects';
import patternsRoutes from './routes/patterns';
import patternModelsRoutes from './routes/pattern-models';
import yarnRoutes from './routes/yarn';
import recipientsRoutes from './routes/recipients';
import toolsRoutes from './routes/tools';
import uploadsRoutes from './routes/uploads';
import countersRoutes from './routes/counters';
import piecesRoutes from './routes/pieces';
import sessionsRoutes from './routes/sessions';
import ratingsRoutes from './routes/ratings';
import patternEnhancementsRoutes from './routes/pattern-enhancements';
import notesRoutes from './routes/notes';
import magicMarkersRoutes from './routes/magic-markers';
import statsRoutes from './routes/stats';
import chartsRoutes from './routes/charts';
import colorPlanningRoutes from './routes/color-planning';
import sharedRoutes from './routes/shared';
import ravelryRoutes from './routes/ravelry';
import usageEventsRoutes from './routes/usage-events';
import panelsRoutes from './routes/panels';
import userExamplesRoutes from './routes/user-examples';
import ogRenderRoutes from './routes/og-render';
import calculatorsSsrRoutes from './routes/calculators-ssr';
import abbreviationsRoutes from './routes/abbreviations';
import gdprRoutes from './routes/gdpr';
import sourceFilesRoutes from './routes/source-files';
import billingRoutes from './routes/billing';
import adminBusinessDashboardRoutes from './routes/admin-business-dashboard';
import publicAnalyticsRoutes from './routes/public-analytics';
import * as billingController from './controllers/billingController';
import { asyncHandler } from './utils/errorHandler';

// Create Express app
const app: Application = express();

// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);

// Security middleware
//
// CSP is owned by nginx (see deployment/nginx/conf.d/rowlyknit.conf), not here.
// In prod the frontend HTML is served by nginx — the browser never sees this
// Express response for the page, so a Helmet CSP on API JSON is dead weight
// and the two drifted over time (Helmet blocked unsafe-eval, nginx allowed it
// for PDF.js; Helmet blocked wss:, nginx allowed it for WebSockets). Keeping
// Helmet for the rest (X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
// and turning CSP off here so nginx is the single source of truth.
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration with origin validation
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// Billing webhook MUST receive the raw request body so we can verify
// the HMAC signature byte-for-byte. Register it BEFORE express.json so
// the JSON parser doesn't drain the stream first. The route's own
// `express.raw({type:'*\/*'})` parser is what populates `req.body` as a
// Buffer; we mount this single endpoint here, and the rest of the
// billing surface (status / checkout / portal) lives on the regular
// `/api/billing/*` mount further down with normal JSON parsing.
app.post(
  '/api/billing/lemonsqueezy/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  asyncHandler(billingController.lemonSqueezyWebhook),
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser with CSRF secret for signed cookies
if (!process.env.CSRF_SECRET) {
  throw new Error('Missing required environment variable: CSRF_SECRET. Please set it in your .env file.');
}
app.use(cookieParser(process.env.CSRF_SECRET));

// Compression middleware
app.use(compression());

// HTTP request logging (skip health checks to reduce noise)
app.use(morgan('combined', {
  stream: morganStream,
  skip: (req) => req.url === '/health'
}));

// Request metrics (Prometheus)
app.use(requestMetrics);

// Input sanitization
app.use(sanitizeInput);

// CSRF protection (conditional - skips JWT routes)
app.use(conditionalCsrf);

// Audit logging
app.use(auditMiddleware);

// Public first-party analytics intake mounts BEFORE the broader
// `/shared/` rate limiter. The router applies its own
// `publicAnalyticsLimiter` (120/min/IP) on POST /event — without this
// ordering, the 60/min `publicSharedLimiter` below would always trip
// first and the dedicated 120/min cap would be dead code. See M1 fix
// for PR #390 and the matching app-routing pin in
// `__tests__/sharedAnalyticsMountOrder.test.ts`.
app.use('/shared/analytics', publicAnalyticsRoutes); // First-party usage events from public surfaces

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/shared/', publicSharedLimiter);

// Static `/uploads` mount intentionally removed (migration 070, 2026-05-02).
// Every uploaded asset is now served by an authenticated streaming
// endpoint with ownership/sharing checks (see uploadsController,
// notesController, projectSharingController). Filenames on disk are
// random hex tokens so guessing a row id no longer yields a URL.

// Import health check handlers
import { healthCheckHandler, livenessProbe, readinessProbe } from './utils/healthCheck';

// Health check endpoints
app.get('/health', healthCheckHandler); // Comprehensive health check
app.get('/health/live', livenessProbe); // Kubernetes liveness probe
app.get('/health/ready', readinessProbe); // Kubernetes readiness probe

// Metrics endpoint (Prometheus)
app.get('/metrics', metricsEndpoint);

// CSRF token endpoint
app.get('/api/csrf-token', sendCsrfToken);

// API routes
// Note: More specific routes (sessions, counters, notes) must come BEFORE generic /projects route
app.use('/api/auth', authRoutes);
app.use('/api', sessionsRoutes);
app.use('/api', ratingsRoutes);
app.use('/api', countersRoutes);
app.use('/api', panelsRoutes);
app.use('/api', piecesRoutes);
app.use('/api', notesRoutes);
app.use('/api', magicMarkersRoutes);
app.use('/api', patternEnhancementsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/patterns', patternsRoutes);
app.use('/api/pattern-models', patternModelsRoutes);
app.use('/api/yarn', yarnRoutes);
app.use('/api/recipients', recipientsRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/charts', chartsRoutes);
// Legacy alias for /api/chart-symbols -> /api/charts/symbols
app.get('/api/chart-symbols', (req, res, next) => {
  req.url = '/symbols';
  chartsRoutes(req, res, next);
});
app.use('/api', colorPlanningRoutes);
app.use('/api/ravelry', ravelryRoutes);
app.use('/api/usage-events', usageEventsRoutes);
app.use('/api/users', userExamplesRoutes);
app.use('/api/abbreviations', abbreviationsRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/source-files', sourceFilesRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminBusinessDashboardRoutes); // Owner-only business dashboard
// Note: /shared/analytics is mounted earlier in the chain (before
// publicSharedLimiter) so its dedicated 120/min cap takes precedence
// over the default 60/min. Keeping the comment here as a breadcrumb.
app.use('/shared', sharedRoutes); // Public shared content routes
app.use('/', ogRenderRoutes); // Server-side OG meta for /p/:slug
app.use('/', calculatorsSsrRoutes); // Server-side JSON-LD for /calculators

// API documentation
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Rowly API',
    version: process.env.API_VERSION || 'v1',
    endpoints: {
      auth: '/api/auth',
      projects: '/api/projects',
      patterns: '/api/patterns',
      yarn: '/api/yarn',
      tools: '/api/tools',
      recipients: '/api/recipients',
    },
  });
});

// 404 handler
app.use(notFoundHandler);

// CSRF error handler (must be before global error handler)
app.use(csrfErrorHandler);

// Sentry error handler (must be before global error handler)
import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler
app.use(errorHandler);

export default app;
