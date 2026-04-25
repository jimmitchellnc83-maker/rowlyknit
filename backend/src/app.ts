import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

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

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/shared/', publicSharedLimiter);

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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
app.use('/shared', sharedRoutes); // Public shared content routes
app.use('/', ogRenderRoutes); // Server-side OG meta for /p/:slug

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
