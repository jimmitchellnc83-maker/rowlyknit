"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
exports.auditMiddleware = auditMiddleware;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
/**
 * Create an audit log entry
 */
async function createAuditLog(req, data) {
    try {
        await (0, database_1.default)('audit_logs').insert({
            user_id: data.userId || req.user?.userId || null,
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
    }
    catch (error) {
        // Don't throw error, just log it
        logger_1.default.error('Failed to create audit log', {
            error: error instanceof Error ? error.message : 'Unknown error',
            data,
        });
    }
}
/**
 * Audit middleware - logs all state-changing operations
 */
function auditMiddleware(req, res, next) {
    // Only audit state-changing operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        // Store original json method
        const originalJson = res.json;
        // Override json method to capture response
        res.json = function (body) {
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
                logger_1.default.error('Audit log failed', { error: err.message });
            });
            // Call original json method
            return originalJson.call(this, body);
        };
    }
    next();
}
