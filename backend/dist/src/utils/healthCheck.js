"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheckHandler = healthCheckHandler;
exports.livenessProbe = livenessProbe;
exports.readinessProbe = readinessProbe;
const database_1 = __importDefault(require("../config/database"));
const redis_1 = require("../config/redis");
const logger_1 = __importDefault(require("../config/logger"));
const os_1 = __importDefault(require("os"));
/**
 * Check database connectivity
 */
async function checkDatabase() {
    const startTime = Date.now();
    try {
        await database_1.default.raw('SELECT 1');
        const responseTime = Date.now() - startTime;
        // Get pool stats
        const pool = database_1.default.client.pool;
        const poolStats = {
            min: pool.min,
            max: pool.max,
            used: pool.numUsed(),
            free: pool.numFree(),
            pending: pool.numPendingAcquires(),
        };
        return {
            status: 'pass',
            responseTime,
            details: {
                pool: poolStats,
                healthy: poolStats.free > 0,
            },
        };
    }
    catch (error) {
        logger_1.default.error('Database health check failed', { error: error.message });
        return {
            status: 'fail',
            message: `Database connection failed: ${error.message}`,
            responseTime: Date.now() - startTime,
        };
    }
}
/**
 * Check Redis connectivity
 */
async function checkRedis() {
    const startTime = Date.now();
    try {
        const pong = await redis_1.redisClient.ping();
        const responseTime = Date.now() - startTime;
        if (pong !== 'PONG') {
            return {
                status: 'fail',
                message: 'Redis PING did not return PONG',
                responseTime,
            };
        }
        // Get Redis info
        const info = await redis_1.redisClient.info();
        const memoryMatch = info.match(/used_memory_human:(\S+)/);
        const connectedClientsMatch = info.match(/connected_clients:(\d+)/);
        return {
            status: 'pass',
            responseTime,
            details: {
                memory: memoryMatch ? memoryMatch[1] : 'unknown',
                clients: connectedClientsMatch ? parseInt(connectedClientsMatch[1]) : 0,
            },
        };
    }
    catch (error) {
        logger_1.default.error('Redis health check failed', { error: error.message });
        return {
            status: 'fail',
            message: `Redis connection failed: ${error.message}`,
            responseTime: Date.now() - startTime,
        };
    }
}
/**
 * Check memory usage
 */
function checkMemory() {
    const totalMemory = os_1.default.totalmem();
    const freeMemory = os_1.default.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercent = (usedMemory / totalMemory) * 100;
    // Warn if memory usage is above 85%
    const status = usagePercent > 90 ? 'fail' : usagePercent > 85 ? 'warn' : 'pass';
    return {
        status,
        message: usagePercent > 85 ? `High memory usage: ${usagePercent.toFixed(2)}%` : undefined,
        details: {
            total: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
            used: `${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
            free: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
            usagePercent: `${usagePercent.toFixed(2)}%`,
        },
    };
}
/**
 * Check disk usage (using process info)
 */
function checkDisk() {
    const heapTotal = process.memoryUsage().heapTotal;
    const heapUsed = process.memoryUsage().heapUsed;
    const heapPercent = (heapUsed / heapTotal) * 100;
    // Warn if heap usage is above 85%
    const status = heapPercent > 90 ? 'fail' : heapPercent > 85 ? 'warn' : 'pass';
    return {
        status,
        message: heapPercent > 85 ? `High heap usage: ${heapPercent.toFixed(2)}%` : undefined,
        details: {
            heapTotal: `${(heapTotal / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heapPercent: `${heapPercent.toFixed(2)}%`,
            rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
            external: `${(process.memoryUsage().external / 1024 / 1024).toFixed(2)} MB`,
        },
    };
}
/**
 * Comprehensive health check handler
 */
async function healthCheckHandler(req, res) {
    const startTime = Date.now();
    try {
        // Run all health checks in parallel
        const [database, redis, memory, disk] = await Promise.all([
            checkDatabase(),
            checkRedis(),
            Promise.resolve(checkMemory()),
            Promise.resolve(checkDisk()),
        ]);
        const checks = { database, redis, memory, disk };
        // Determine overall status
        // Only database and Redis failures should make the service unhealthy (503)
        // Memory and heap issues are degraded (200) - service can still function
        const hasCriticalFailure = database.status === 'fail' || redis.status === 'fail';
        const hasFailure = Object.values(checks).some(check => check.status === 'fail');
        const hasWarning = Object.values(checks).some(check => check.status === 'warn');
        const status = hasCriticalFailure ? 'unhealthy' : hasFailure || hasWarning ? 'degraded' : 'healthy';
        const healthStatus = {
            status,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            checks,
        };
        const responseTime = Date.now() - startTime;
        logger_1.default.info('Health check completed', {
            status,
            responseTime,
            checks: Object.entries(checks).map(([name, check]) => ({ name, status: check.status })),
        });
        // Return HTTP 200 for healthy and degraded, 503 only for critical failures
        const httpStatus = status === 'unhealthy' ? 503 : 200;
        res.status(httpStatus).json({
            success: status !== 'unhealthy',
            ...healthStatus,
            responseTime,
        });
    }
    catch (error) {
        logger_1.default.error('Health check failed', { error: error.message });
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            message: 'Health check failed',
            error: error.message,
        });
    }
}
/**
 * Simple liveness probe (doesn't check dependencies)
 */
function livenessProbe(req, res) {
    res.status(200).json({
        success: true,
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
}
/**
 * Readiness probe (checks if service is ready to accept traffic)
 */
async function readinessProbe(req, res) {
    try {
        // Check critical dependencies
        await Promise.all([
            database_1.default.raw('SELECT 1'),
            redis_1.redisClient.ping(),
        ]);
        res.status(200).json({
            success: true,
            status: 'ready',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.default.error('Readiness check failed', { error: error.message });
        res.status(503).json({
            success: false,
            status: 'not ready',
            timestamp: new Date().toISOString(),
            error: error.message,
        });
    }
}
