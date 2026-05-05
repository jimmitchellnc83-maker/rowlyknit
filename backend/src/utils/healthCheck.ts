import { Request, Response } from 'express';
import v8 from 'v8';
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
    nodeHeap: CheckResult;
    transactionalEmail: CheckResult;
  };
  /**
   * `true` when at least one launch-blocking placeholder is active in
   * production. Today the only condition is `EMAIL_PROVIDER=noop`
   * (signup welcome + password reset go to `email_logs.status='skipped'`
   * and the email body never leaves the box). Surfaced at the top
   * level so an admin / monitoring ping can read one boolean instead
   * of walking the per-check tree.
   */
  publicLaunchBlocked: boolean;
  /**
   * Human-readable list of every blocker driving `publicLaunchBlocked`.
   * Empty array when there are no blockers. The shape is stable so
   * callers can render the list verbatim.
   */
  publicLaunchBlockers: string[];
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
 * Snapshot of Node.js memory state, factored out so the threshold logic is
 * testable without actually running a V8 process.
 */
export interface HeapSnapshot {
  heapUsed: number;      // bytes — v8.used_heap_size
  heapLimit: number;     // bytes — v8.heap_size_limit (≈ max-old-space-size)
  heapCommitted: number; // bytes — process.memoryUsage().heapTotal
  rss: number;
  external: number;
}

/** Pure threshold evaluator — 85% warns, 90%+ fails against the limit. */
export function evaluateNodeHeap(snap: HeapSnapshot): CheckResult {
  const heapPercent = snap.heapLimit > 0 ? (snap.heapUsed / snap.heapLimit) * 100 : 0;
  const status: CheckResult['status'] =
    heapPercent > 90 ? 'fail' : heapPercent > 85 ? 'warn' : 'pass';

  return {
    status,
    message: heapPercent > 85 ? `High heap usage: ${heapPercent.toFixed(2)}%` : undefined,
    details: {
      heapUsed: `${(snap.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapLimit: `${(snap.heapLimit / 1024 / 1024).toFixed(2)} MB`,
      heapPercent: `${heapPercent.toFixed(2)}%`,
      heapCommitted: `${(snap.heapCommitted / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(snap.rss / 1024 / 1024).toFixed(2)} MB`,
      external: `${(snap.external / 1024 / 1024).toFixed(2)} MB`,
    },
  };
}

/**
 * Check Node.js V8 heap usage against its configured ceiling.
 *
 * `process.memoryUsage().heapTotal` is the currently-committed heap size,
 * which V8 grows adaptively up to `--max-old-space-size` as allocation
 * demand increases. Ratios against heapTotal routinely sit at 90%+ during
 * normal operation because that's exactly when V8 is about to grow the
 * heap further — so that ratio is useless as a pressure signal. The actual
 * ceiling is `v8.getHeapStatistics().heap_size_limit`, which reflects the
 * max-old-space-size (default ~2 GB on 64-bit, lower if constrained).
 *
 * Previously exposed as `disk` — misnamed since it never measured disk.
 * Key renamed to `nodeHeap` so the output matches what's being measured.
 */
export function checkNodeHeap(): CheckResult {
  const heapStats = v8.getHeapStatistics();
  const mem = process.memoryUsage();
  return evaluateNodeHeap({
    heapUsed: heapStats.used_heap_size,
    heapLimit: heapStats.heap_size_limit,
    heapCommitted: mem.heapTotal,
    rss: mem.rss,
    external: mem.external,
  });
}

/**
 * Inspect transactional-email configuration without actually sending a
 * message. Reports `pass` for any real provider (resend / postmark /
 * sendgrid / ses / smtp), `warn` when the no-op adapter is in use
 * — production no-op is loud-warn-logged on adapter init too, but we
 * also surface it here so /health is the single source of truth for
 * "are we ready for real users."
 *
 * Reads `EMAIL_PROVIDER` and `ALLOW_NOOP_EMAIL_IN_PRODUCTION` directly
 * (mirrors `createEmailAdapter`) instead of importing emailService —
 * importing emailService would force the `new EmailService()`
 * singleton to run during the unit test, which in turn instantiates
 * `nodemailer` etc. The adapter-name reporting at runtime is what
 * matters; envs and the singleton's `getAdapterName()` always agree.
 */
export function checkTransactionalEmail(): CheckResult {
  const provider = (process.env.EMAIL_PROVIDER || 'sendgrid').toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';
  const noopOverride = process.env.ALLOW_NOOP_EMAIL_IN_PRODUCTION === 'true';

  // Mirror the createEmailAdapter() decision tree without instantiating
  // an adapter. Anything that resolves to the no-op adapter at runtime
  // also returns `noop` here.
  let resolvedProvider = provider;
  if (provider === 'noop') {
    resolvedProvider = 'noop';
  } else if (provider === 'ses') {
    if (!process.env.AWS_SES_ACCESS_KEY || !process.env.AWS_SES_SECRET_KEY) {
      resolvedProvider = 'noop';
    }
  } else {
    // resend / postmark / sendgrid / default — all need EMAIL_API_KEY.
    if (!process.env.EMAIL_API_KEY) resolvedProvider = 'noop';
  }

  if (resolvedProvider !== 'noop') {
    return {
      status: 'pass',
      details: {
        provider: resolvedProvider,
        publicLaunchBlocked: false,
      },
    };
  }

  // No-op path. In dev / test this is fine (warn so it's visible but
  // not a fail). In production this is the launch-blocker the user
  // explicitly named; same reason `createEmailAdapter` requires an
  // explicit `ALLOW_NOOP_EMAIL_IN_PRODUCTION=true` opt-in.
  return {
    status: 'warn',
    message: isProduction
      ? 'Transactional email is in placeholder mode (EMAIL_PROVIDER=noop). ' +
        'Signup welcome + password reset are logged as `skipped` and the email ' +
        'body never leaves the box. PUBLIC LAUNCH IS BLOCKED until a real ' +
        'provider (Resend / Postmark / SendGrid / SES) is provisioned with ' +
        'SPF + DKIM + DMARC and re-smoked.'
      : 'No transactional email provider configured (dev / test default).',
    details: {
      provider: 'noop',
      configuredProvider: provider,
      isProduction,
      noopOverride,
      // The single boolean that admin tooling can latch on to.
      publicLaunchBlocked: isProduction,
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
    const [database, redis, memory, nodeHeap, transactionalEmail] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      Promise.resolve(checkMemory()),
      Promise.resolve(checkNodeHeap()),
      Promise.resolve(checkTransactionalEmail()),
    ]);

    const checks = { database, redis, memory, nodeHeap, transactionalEmail };

    // Determine overall status
    // Only database and Redis failures should make the service unhealthy (503)
    // Memory, heap, and email-noop issues are degraded (200) - service can still function
    const hasCriticalFailure = database.status === 'fail' || redis.status === 'fail';
    const hasFailure = Object.values(checks).some(check => check.status === 'fail');
    const hasWarning = Object.values(checks).some(check => check.status === 'warn');

    const status: HealthStatus['status'] = hasCriticalFailure ? 'unhealthy' : hasFailure || hasWarning ? 'degraded' : 'healthy';

    // Surface launch-blockers at the top level so admin / monitoring
    // can ping `/health` and read one boolean. Today the only blocker
    // is `EMAIL_PROVIDER=noop` in production; the list is structured
    // so a future blocker (SMS, payment provider, etc.) plugs in here.
    const publicLaunchBlockers: string[] = [];
    if (transactionalEmail.details?.publicLaunchBlocked) {
      publicLaunchBlockers.push(
        'transactional_email_noop: ' +
          'production EMAIL_PROVIDER=noop with ALLOW_NOOP_EMAIL_IN_PRODUCTION=true; ' +
          'signup + reset emails are not delivered',
      );
    }
    const publicLaunchBlocked = publicLaunchBlockers.length > 0;

    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks,
      publicLaunchBlocked,
      publicLaunchBlockers,
    };

    const responseTime = Date.now() - startTime;

    logger.info('Health check completed', {
      status,
      responseTime,
      publicLaunchBlocked,
      checks: Object.entries(checks).map(([name, check]) => ({ name, status: check.status })),
    });

    // Return HTTP 200 for healthy and degraded, 503 only for critical failures
    const httpStatus = status === 'unhealthy' ? 503 : 200;

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
