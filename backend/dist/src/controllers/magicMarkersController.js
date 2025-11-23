"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMagicMarkers = getMagicMarkers;
exports.getMagicMarker = getMagicMarker;
exports.createMagicMarker = createMagicMarker;
exports.updateMagicMarker = updateMagicMarker;
exports.deleteMagicMarker = deleteMagicMarker;
exports.toggleMagicMarker = toggleMagicMarker;
exports.checkMagicMarkers = checkMagicMarkers;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
/**
 * Get all magic markers for a project
 */
async function getMagicMarkers(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { counterId, isActive } = req.query;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    let query = (0, database_1.default)('magic_markers')
        .where({ project_id: projectId });
    if (counterId) {
        query = query.where({ counter_id: counterId });
    }
    if (isActive !== undefined) {
        query = query.where({ is_active: isActive === 'true' });
    }
    const magicMarkers = await query.orderBy('created_at', 'desc');
    res.json({
        success: true,
        data: { magicMarkers },
    });
}
/**
 * Get single magic marker by ID
 */
async function getMagicMarker(req, res) {
    const userId = req.user.userId;
    const { id: projectId, markerId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const magicMarker = await (0, database_1.default)('magic_markers')
        .where({ id: markerId, project_id: projectId })
        .first();
    if (!magicMarker) {
        throw new errorHandler_1.NotFoundError('Magic marker not found');
    }
    res.json({
        success: true,
        data: { magicMarker },
    });
}
/**
 * Create a magic marker
 */
async function createMagicMarker(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { counterId, name, triggerType, triggerCondition, alertMessage, alertType, isActive = true, } = req.body;
    if (!name || !triggerType || !triggerCondition || !alertMessage) {
        throw new errorHandler_1.ValidationError('Name, trigger type, trigger condition, and alert message are required');
    }
    const validTriggerTypes = ['counter_value', 'row_interval', 'stitch_count', 'time_based', 'custom'];
    if (!validTriggerTypes.includes(triggerType)) {
        throw new errorHandler_1.ValidationError(`Trigger type must be one of: ${validTriggerTypes.join(', ')}`);
    }
    const validAlertTypes = ['notification', 'sound', 'vibration', 'visual'];
    if (alertType && !validAlertTypes.includes(alertType)) {
        throw new errorHandler_1.ValidationError(`Alert type must be one of: ${validAlertTypes.join(', ')}`);
    }
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Verify counter ownership if counterId is provided
    if (counterId) {
        const counter = await (0, database_1.default)('counters')
            .where({ id: counterId, project_id: projectId })
            .first();
        if (!counter) {
            throw new errorHandler_1.NotFoundError('Counter not found');
        }
    }
    const [magicMarker] = await (0, database_1.default)('magic_markers')
        .insert({
        project_id: projectId,
        counter_id: counterId || null,
        name,
        trigger_type: triggerType,
        trigger_condition: JSON.stringify(triggerCondition),
        alert_message: alertMessage,
        alert_type: alertType || 'notification',
        is_active: isActive,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'magic_marker_created',
        entityType: 'magic_marker',
        entityId: magicMarker.id,
        newValues: magicMarker,
    });
    res.status(201).json({
        success: true,
        message: 'Magic marker created successfully',
        data: { magicMarker },
    });
}
/**
 * Update a magic marker
 */
async function updateMagicMarker(req, res) {
    const userId = req.user.userId;
    const { id: projectId, markerId } = req.params;
    const updates = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const magicMarker = await (0, database_1.default)('magic_markers')
        .where({ id: markerId, project_id: projectId })
        .first();
    if (!magicMarker) {
        throw new errorHandler_1.NotFoundError('Magic marker not found');
    }
    const updateData = { updated_at: new Date() };
    if (updates.name !== undefined)
        updateData.name = updates.name;
    if (updates.triggerType !== undefined)
        updateData.trigger_type = updates.triggerType;
    if (updates.triggerCondition !== undefined) {
        updateData.trigger_condition = JSON.stringify(updates.triggerCondition);
    }
    if (updates.alertMessage !== undefined)
        updateData.alert_message = updates.alertMessage;
    if (updates.alertType !== undefined)
        updateData.alert_type = updates.alertType;
    if (updates.isActive !== undefined)
        updateData.is_active = updates.isActive;
    const [updatedMagicMarker] = await (0, database_1.default)('magic_markers')
        .where({ id: markerId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'magic_marker_updated',
        entityType: 'magic_marker',
        entityId: markerId,
        oldValues: magicMarker,
        newValues: updatedMagicMarker,
    });
    res.json({
        success: true,
        message: 'Magic marker updated successfully',
        data: { magicMarker: updatedMagicMarker },
    });
}
/**
 * Delete a magic marker
 */
async function deleteMagicMarker(req, res) {
    const userId = req.user.userId;
    const { id: projectId, markerId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const magicMarker = await (0, database_1.default)('magic_markers')
        .where({ id: markerId, project_id: projectId })
        .first();
    if (!magicMarker) {
        throw new errorHandler_1.NotFoundError('Magic marker not found');
    }
    await (0, database_1.default)('magic_markers').where({ id: markerId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'magic_marker_deleted',
        entityType: 'magic_marker',
        entityId: markerId,
        oldValues: magicMarker,
    });
    res.json({
        success: true,
        message: 'Magic marker deleted successfully',
    });
}
/**
 * Toggle magic marker active status
 */
async function toggleMagicMarker(req, res) {
    const userId = req.user.userId;
    const { id: projectId, markerId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const magicMarker = await (0, database_1.default)('magic_markers')
        .where({ id: markerId, project_id: projectId })
        .first();
    if (!magicMarker) {
        throw new errorHandler_1.NotFoundError('Magic marker not found');
    }
    const [updatedMagicMarker] = await (0, database_1.default)('magic_markers')
        .where({ id: markerId })
        .update({
        is_active: !magicMarker.is_active,
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'magic_marker_toggled',
        entityType: 'magic_marker',
        entityId: markerId,
        oldValues: magicMarker,
        newValues: updatedMagicMarker,
    });
    res.json({
        success: true,
        message: `Magic marker ${updatedMagicMarker.is_active ? 'activated' : 'deactivated'} successfully`,
        data: { magicMarker: updatedMagicMarker },
    });
}
/**
 * Check and trigger magic markers based on counter values
 * This can be called internally when counters are updated
 */
async function checkMagicMarkers(projectId, counterId, counterValue) {
    // Get all active magic markers for this counter
    const magicMarkers = await (0, database_1.default)('magic_markers')
        .where({
        project_id: projectId,
        counter_id: counterId,
        is_active: true,
    });
    const triggeredMarkers = [];
    for (const marker of magicMarkers) {
        let shouldTrigger = false;
        const condition = JSON.parse(marker.trigger_condition);
        switch (marker.trigger_type) {
            case 'counter_value':
                if (condition.operator === 'equals' && counterValue === condition.value) {
                    shouldTrigger = true;
                }
                else if (condition.operator === 'greater_than' && counterValue > condition.value) {
                    shouldTrigger = true;
                }
                else if (condition.operator === 'less_than' && counterValue < condition.value) {
                    shouldTrigger = true;
                }
                else if (condition.operator === 'multiple_of' && counterValue % condition.value === 0) {
                    shouldTrigger = true;
                }
                break;
            case 'row_interval':
                if (counterValue % condition.interval === 0 && counterValue > 0) {
                    shouldTrigger = true;
                }
                break;
            case 'stitch_count':
                if (counterValue === condition.stitchCount) {
                    shouldTrigger = true;
                }
                break;
            // Add more trigger type logic as needed
        }
        if (shouldTrigger) {
            triggeredMarkers.push(marker);
        }
    }
    return triggeredMarkers;
}
