import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import logger from '../config/logger';

/**
 * Prometheus Monitoring Middleware
 * Provides metrics for application performance and health monitoring
 */

// Create a Registry
export const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestsInProgress = new client.Gauge({
  name: 'http_requests_in_progress',
  help: 'Number of HTTP requests currently in progress',
  labelNames: ['method', 'route'],
});

export const databaseQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const databaseConnectionPool = new client.Gauge({
  name: 'database_connection_pool_size',
  help: 'Current size of database connection pool',
  labelNames: ['status'],
});

export const cacheHitRate = new client.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'],
});

export const activeUsers = new client.Gauge({
  name: 'active_users_total',
  help: 'Number of currently active users',
});

export const fileUploadSize = new client.Histogram({
  name: 'file_upload_size_bytes',
  help: 'Size of uploaded files in bytes',
  labelNames: ['file_type'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 52428800],
});

export const errorTotal = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route'],
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestsInProgress);
register.registerMetric(databaseQueryDuration);
register.registerMetric(databaseConnectionPool);
register.registerMetric(cacheHitRate);
register.registerMetric(activeUsers);
register.registerMetric(fileUploadSize);
register.registerMetric(errorTotal);

/**
 * Middleware to track HTTP request metrics
 */
export function requestMetrics(req: Request, res: Response, next: NextFunction) {
  // Skip metrics endpoint to avoid recursion
  if (req.path === '/metrics') {
    return next();
  }

  const start = Date.now();
  const route = req.route?.path || req.path;

  // Increment in-progress requests
  httpRequestsInProgress.inc({ method: req.method, route });

  // Capture response
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    // Record metrics
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    httpRequestsInProgress.dec({ method: req.method, route });

    // Log slow requests (> 2 seconds)
    if (duration > 2) {
      logger.warn('Slow request detected', {
        method: req.method,
        route,
        duration,
        statusCode: res.statusCode,
      });
    }
  });

  next();
}

/**
 * Endpoint to expose Prometheus metrics
 */
export async function metricsEndpoint(req: Request, res: Response) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Error generating metrics', { error });
    res.status(500).json({
      success: false,
      message: 'Error generating metrics',
    });
  }
}

/**
 * Track database query performance
 */
export function trackDatabaseQuery(operation: string, table: string, duration: number) {
  databaseQueryDuration.observe({ operation, table }, duration / 1000);
}

/**
 * Track cache operations
 */
export function trackCacheOperation(operation: 'get' | 'set' | 'delete', result: 'hit' | 'miss' | 'success') {
  cacheHitRate.inc({ operation, result });
}

/**
 * Track file uploads
 */
export function trackFileUpload(fileType: string, sizeBytes: number) {
  fileUploadSize.observe({ file_type: fileType }, sizeBytes);
}

/**
 * Track errors
 */
export function trackError(type: string, route: string) {
  errorTotal.inc({ type, route });
}

/**
 * Update active users count
 */
export function updateActiveUsers(count: number) {
  activeUsers.set(count);
}
