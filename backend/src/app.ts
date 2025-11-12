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

// Import configuration
import './config/database';
import './config/redis';
import logger, { morganStream } from './config/logger';

// Import middleware
import { apiLimiter } from './middleware/rateLimiter';
import { sanitizeInput } from './middleware/validator';
import { auditMiddleware } from './middleware/auditLog';
import { errorHandler, notFoundHandler } from './utils/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import projectsRoutes from './routes/projects';
import patternsRoutes from './routes/patterns';
import yarnRoutes from './routes/yarn';
import recipientsRoutes from './routes/recipients';
import toolsRoutes from './routes/tools';
import uploadsRoutes from './routes/uploads';

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

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Compression middleware
app.use(compression());

// HTTP request logging
app.use(morgan('combined', { stream: morganStream }));

// Input sanitization
app.use(sanitizeInput);

// Audit logging
app.use(auditMiddleware);

// Rate limiting
app.use('/api/', apiLimiter);

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Rowly API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
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

// Global error handler
app.use(errorHandler);

export default app;
