"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorTotal = exports.fileUploadSize = exports.activeUsers = exports.cacheHitRate = exports.databaseConnectionPool = exports.databaseQueryDuration = exports.httpRequestsInProgress = exports.httpRequestTotal = exports.httpRequestDuration = exports.register = void 0;
exports.requestMetrics = requestMetrics;
exports.metricsEndpoint = metricsEndpoint;
exports.trackDatabaseQuery = trackDatabaseQuery;
exports.trackCacheOperation = trackCacheOperation;
exports.trackFileUpload = trackFileUpload;
exports.trackError = trackError;
exports.updateActiveUsers = updateActiveUsers;
const prom_client_1 = __importDefault(require("prom-client"));
const logger_1 = __importDefault(require("../config/logger"));
/**
 * Prometheus Monitoring Middleware
 * Provides metrics for application performance and health monitoring
 */
// Create a Registry
exports.register = new prom_client_1.default.Registry();
// Add default metrics (CPU, memory, etc.)
prom_client_1.default.collectDefaultMetrics({ register: exports.register });
// Custom metrics
exports.httpRequestDuration = new prom_client_1.default.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
});
exports.httpRequestTotal = new prom_client_1.default.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});
exports.httpRequestsInProgress = new prom_client_1.default.Gauge({
    name: 'http_requests_in_progress',
    help: 'Number of HTTP requests currently in progress',
    labelNames: ['method', 'route'],
});
exports.databaseQueryDuration = new prom_client_1.default.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});
exports.databaseConnectionPool = new prom_client_1.default.Gauge({
    name: 'database_connection_pool_size',
    help: 'Current size of database connection pool',
    labelNames: ['status'],
});
exports.cacheHitRate = new prom_client_1.default.Counter({
    name: 'cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['operation', 'result'],
});
exports.activeUsers = new prom_client_1.default.Gauge({
    name: 'active_users_total',
    help: 'Number of currently active users',
});
exports.fileUploadSize = new prom_client_1.default.Histogram({
    name: 'file_upload_size_bytes',
    help: 'Size of uploaded files in bytes',
    labelNames: ['file_type'],
    buckets: [1024, 10240, 102400, 1048576, 10485760, 52428800],
});
exports.errorTotal = new prom_client_1.default.Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'route'],
});
// Register all metrics
exports.register.registerMetric(exports.httpRequestDuration);
exports.register.registerMetric(exports.httpRequestTotal);
exports.register.registerMetric(exports.httpRequestsInProgress);
exports.register.registerMetric(exports.databaseQueryDuration);
exports.register.registerMetric(exports.databaseConnectionPool);
exports.register.registerMetric(exports.cacheHitRate);
exports.register.registerMetric(exports.activeUsers);
exports.register.registerMetric(exports.fileUploadSize);
exports.register.registerMetric(exports.errorTotal);
/**
 * Middleware to track HTTP request metrics
 */
function requestMetrics(req, res, next) {
    // Skip metrics endpoint to avoid recursion
    if (req.path === '/metrics') {
        return next();
    }
    const start = Date.now();
    const route = req.route?.path || req.path;
    // Increment in-progress requests
    exports.httpRequestsInProgress.inc({ method: req.method, route });
    // Capture response
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        // Record metrics
        exports.httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode }, duration);
        exports.httpRequestTotal.inc({
            method: req.method,
            route,
            status_code: res.statusCode,
        });
        exports.httpRequestsInProgress.dec({ method: req.method, route });
        // Log slow requests (> 2 seconds)
        if (duration > 2) {
            logger_1.default.warn('Slow request detected', {
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
async function metricsEndpoint(req, res) {
    try {
        res.set('Content-Type', exports.register.contentType);
        const metrics = await exports.register.metrics();
        res.end(metrics);
    }
    catch (error) {
        logger_1.default.error('Error generating metrics', { error });
        res.status(500).json({
            success: false,
            message: 'Error generating metrics',
        });
    }
}
/**
 * Track database query performance
 */
function trackDatabaseQuery(operation, table, duration) {
    exports.databaseQueryDuration.observe({ operation, table }, duration / 1000);
}
/**
 * Track cache operations
 */
function trackCacheOperation(operation, result) {
    exports.cacheHitRate.inc({ operation, result });
}
/**
 * Track file uploads
 */
function trackFileUpload(fileType, sizeBytes) {
    exports.fileUploadSize.observe({ file_type: fileType }, sizeBytes);
}
/**
 * Track errors
 */
function trackError(type, route) {
    exports.errorTotal.inc({ type, route });
}
/**
 * Update active users count
 */
function updateActiveUsers(count) {
    exports.activeUsers.set(count);
}
