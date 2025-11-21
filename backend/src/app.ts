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
import logger, { morganStream } from './config/logger';

// Import middleware
import { apiLimiter } from './middleware/rateLimiter';
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
import sessionsRoutes from './routes/sessions';
import patternEnhancementsRoutes from './routes/pattern-enhancements';
import notesRoutes from './routes/notes';
import magicMarkersRoutes from './routes/magic-markers';
import patternBookmarksRoutes from './routes/patternBookmarks';
import statsRoutes from './routes/stats';

// Create Express app
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration with origin validation
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is in whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

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
app.use('/api', countersRoutes);
app.use('/api', notesRoutes);
app.use('/api', magicMarkersRoutes);
app.use('/api', patternEnhancementsRoutes);
app.use('/api', patternBookmarksRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/patterns', patternsRoutes);
app.use('/api/yarn', yarnRoutes);
app.use('/api/recipients', recipientsRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/uploads', uploadsRoutes);

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

// Global error handler
app.use(errorHandler);

export default app;
