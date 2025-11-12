import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import logger from '../config/logger';

export interface AuditLogData {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  req: Request,
  data: AuditLogData
): Promise<void> {
  try {
    await db('audit_logs').insert({
      user_id: data.userId || (req as any).user?.userId || null,
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId || null,
      old_values: data.oldValues ? JSON.stringify(data.oldValues) : null,
      new_values: data.newValues ? JSON.stringify(data.newValues) : null,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      created_at: new Date(),
    });
  } catch (error) {
    // Don't throw error, just log it
    logger.error('Failed to create audit log', {
      error: error instanceof Error ? error.message : 'Unknown error',
      data,
    });
  }
}

/**
 * Audit middleware - logs all state-changing operations
 */
export function auditMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Only audit state-changing operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Store original json method
    const originalJson = res.json;

    // Override json method to capture response
    res.json = function (body: any) {
      // Extract entity info from URL
      const pathParts = req.path.split('/').filter(Boolean);
      const entityType = pathParts[1] || 'unknown'; // e.g., /api/projects -> projects
      const entityId = pathParts[2] || null;

      // Create audit log (async, don't block response)
      createAuditLog(req, {
        action: `${req.method.toLowerCase()}_${entityType}`,
        entityType,
        entityId,
        newValues: req.body,
        metadata: {
          path: req.path,
          query: req.query,
          statusCode: res.statusCode,
        },
      }).catch((err) => {
        logger.error('Audit log failed', { error: err.message });
      });

      // Call original json method
      return originalJson.call(this, body);
    };
  }

  next();
}
