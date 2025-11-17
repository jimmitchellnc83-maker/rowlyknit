import { Request, Response } from 'express';
import db from '../config/database';
import { redisClient } from '../config/redis';
import logger from '../config/logger';
import os from 'os';

/**
 * Health check status interface
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    memory: CheckResult;
    disk: CheckResult;
  };
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  responseTime?: number;
  details?: Record<string, any>;
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    await db.raw('SELECT 1');
    const responseTime = Date.now() - startTime;

    // Get pool stats
    const pool = (db.client as any).pool;
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
  } catch (error: any) {
    logger.error('Database health check failed', { error: error.message });
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
async function checkRedis(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const pong = await redisClient.ping();
    const responseTime = Date.now() - startTime;

    if (pong !== 'PONG') {
      return {
        status: 'fail',
        message: 'Redis PING did not return PONG',
        responseTime,
      };
    }

    // Get Redis info
    const info = await redisClient.info();
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
  } catch (error: any) {
    logger.error('Redis health check failed', { error: error.message });
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
function checkMemory(): CheckResult {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
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
function checkDisk(): CheckResult {
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
export async function healthCheckHandler(req: Request, res: Response): Promise<void> {
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
    const hasFailure = Object.values(checks).some(check => check.status === 'fail');
    const hasWarning = Object.values(checks).some(check => check.status === 'warn');

    const status: HealthStatus['status'] = hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';

    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };

    const responseTime = Date.now() - startTime;

    logger.info('Health check completed', {
      status,
      responseTime,
      checks: Object.entries(checks).map(([name, check]) => ({ name, status: check.status })),
    });

    // Return appropriate HTTP status code
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

    res.status(httpStatus).json({
      success: status !== 'unhealthy',
      ...healthStatus,
      responseTime,
    });
  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });

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
export function livenessProbe(req: Request, res: Response): void {
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
export async function readinessProbe(req: Request, res: Response): Promise<void> {
  try {
    // Check critical dependencies
    await Promise.all([
      db.raw('SELECT 1'),
      redisClient.ping(),
    ]);

    res.status(200).json({
      success: true,
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Readiness check failed', { error: error.message });

    res.status(503).json({
      success: false,
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
}
