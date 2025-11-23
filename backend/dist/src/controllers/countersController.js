"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCounters = getCounters;
exports.getCounter = getCounter;
exports.createCounter = createCounter;
exports.updateCounter = updateCounter;
exports.deleteCounter = deleteCounter;
exports.reorderCounters = reorderCounters;
exports.getCounterHistory = getCounterHistory;
exports.undoCounterToPoint = undoCounterToPoint;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
/**
 * Get all counters for a project
 */
async function getCounters(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const counters = await (0, database_1.default)('counters')
        .where({ project_id: projectId })
        .orderBy('sort_order', 'asc')
        .orderBy('created_at', 'asc');
    res.json({
        success: true,
        data: { counters },
    });
}
/**
 * Get single counter by ID
 */
async function getCounter(req, res) {
    const userId = req.user.userId;
    const { id: projectId, counterId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const counter = await (0, database_1.default)('counters')
        .where({ id: counterId, project_id: projectId })
        .first();
    if (!counter) {
        throw new errorHandler_1.NotFoundError('Counter not found');
    }
    res.json({
        success: true,
        data: { counter },
    });
}
/**
 * Create a new counter
 */
async function createCounter(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { name, type, currentValue = 0, targetValue, incrementBy = 1, minValue, maxValue, displayColor, isVisible = true, incrementPattern, sortOrder, notes, } = req.body;
    if (!name) {
        throw new errorHandler_1.ValidationError('Counter name is required');
    }
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Get next sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
        const result = await (0, database_1.default)('counters')
            .where({ project_id: projectId })
            .max('sort_order as maxOrder')
            .first();
        finalSortOrder = (result?.maxOrder ?? -1) + 1;
    }
    const [counter] = await (0, database_1.default)('counters')
        .insert({
        project_id: projectId,
        name,
        type: type || 'rows',
        current_value: currentValue,
        target_value: targetValue,
        increment_by: incrementBy,
        min_value: minValue,
        max_value: maxValue,
        display_color: displayColor,
        is_visible: isVisible,
        increment_pattern: incrementPattern ? JSON.stringify(incrementPattern) : null,
        sort_order: finalSortOrder,
        notes: notes || null,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    // Create initial history entry
    await (0, database_1.default)('counter_history').insert({
        counter_id: counter.id,
        old_value: 0, // For new counters, old value is 0
        new_value: currentValue,
        action: 'created',
        user_note: null,
        created_at: new Date(),
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'counter_created',
        entityType: 'counter',
        entityId: counter.id,
        newValues: counter,
    });
    res.status(201).json({
        success: true,
        message: 'Counter created successfully',
        data: { counter },
    });
}
/**
 * Update a counter (including value changes)
 */
async function updateCounter(req, res) {
    const userId = req.user.userId;
    const { id: projectId, counterId } = req.params;
    const updates = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const counter = await (0, database_1.default)('counters')
        .where({ id: counterId, project_id: projectId })
        .first();
    if (!counter) {
        throw new errorHandler_1.NotFoundError('Counter not found');
    }
    const oldValue = counter.current_value;
    const newValue = updates.current_value !== undefined ? updates.current_value : oldValue;
    // Prepare update data
    const updateData = {
        updated_at: new Date(),
    };
    // Update allowed fields
    if (updates.name !== undefined)
        updateData.name = updates.name;
    if (updates.type !== undefined)
        updateData.type = updates.type;
    if (updates.current_value !== undefined)
        updateData.current_value = updates.current_value;
    if (updates.target_value !== undefined)
        updateData.target_value = updates.target_value;
    if (updates.increment_by !== undefined)
        updateData.increment_by = updates.increment_by;
    if (updates.min_value !== undefined)
        updateData.min_value = updates.min_value;
    if (updates.max_value !== undefined)
        updateData.max_value = updates.max_value;
    if (updates.display_color !== undefined)
        updateData.display_color = updates.display_color;
    if (updates.is_visible !== undefined)
        updateData.is_visible = updates.is_visible;
    if (updates.increment_pattern !== undefined) {
        updateData.increment_pattern = updates.increment_pattern ? JSON.stringify(updates.increment_pattern) : null;
    }
    if (updates.sort_order !== undefined)
        updateData.sort_order = updates.sort_order;
    if (updates.notes !== undefined)
        updateData.notes = updates.notes;
    const [updatedCounter] = await (0, database_1.default)('counters')
        .where({ id: counterId })
        .update(updateData)
        .returning('*');
    // Create history entry if value changed
    if (oldValue !== newValue) {
        await (0, database_1.default)('counter_history').insert({
            counter_id: counterId,
            old_value: oldValue,
            new_value: newValue,
            action: updates.action || 'updated',
            user_note: updates.user_note || null,
            created_at: new Date(),
        });
        // Check and execute linked counter actions
        await checkAndExecuteCounterLinks(counterId, newValue, userId, req);
    }
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'counter_updated',
        entityType: 'counter',
        entityId: counterId,
        oldValues: counter,
        newValues: updatedCounter,
    });
    res.json({
        success: true,
        message: 'Counter updated successfully',
        data: { counter: updatedCounter },
    });
}
/**
 * Delete a counter
 */
async function deleteCounter(req, res) {
    const userId = req.user.userId;
    const { id: projectId, counterId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const counter = await (0, database_1.default)('counters')
        .where({ id: counterId, project_id: projectId })
        .first();
    if (!counter) {
        throw new errorHandler_1.NotFoundError('Counter not found');
    }
    // Delete counter (cascade will handle history and links)
    await (0, database_1.default)('counters').where({ id: counterId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'counter_deleted',
        entityType: 'counter',
        entityId: counterId,
        oldValues: counter,
    });
    res.json({
        success: true,
        message: 'Counter deleted successfully',
    });
}
/**
 * Reorder counters
 */
async function reorderCounters(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { counters } = req.body;
    if (!Array.isArray(counters)) {
        throw new errorHandler_1.ValidationError('Counters must be an array');
    }
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Update sort order for each counter
    await database_1.default.transaction(async (trx) => {
        for (const item of counters) {
            await trx('counters')
                .where({ id: item.id, project_id: projectId })
                .update({
                sort_order: item.sort_order,
                updated_at: new Date(),
            });
        }
    });
    res.json({
        success: true,
        message: 'Counters reordered successfully',
    });
}
/**
 * Get counter history
 */
async function getCounterHistory(req, res) {
    const userId = req.user.userId;
    const { id: projectId, counterId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const counter = await (0, database_1.default)('counters')
        .where({ id: counterId, project_id: projectId })
        .first();
    if (!counter) {
        throw new errorHandler_1.NotFoundError('Counter not found');
    }
    const [{ count }] = await (0, database_1.default)('counter_history')
        .where({ counter_id: counterId })
        .count('* as count');
    const history = await (0, database_1.default)('counter_history')
        .where({ counter_id: counterId })
        .orderBy('created_at', 'desc')
        .limit(Number(limit))
        .offset(Number(offset));
    res.json({
        success: true,
        data: {
            history,
            pagination: {
                limit: Number(limit),
                offset: Number(offset),
                total: Number(count),
            },
        },
    });
}
/**
 * Undo counter to a specific history point
 */
async function undoCounterToPoint(req, res) {
    const userId = req.user.userId;
    const { id: projectId, counterId, historyId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const counter = await (0, database_1.default)('counters')
        .where({ id: counterId, project_id: projectId })
        .first();
    if (!counter) {
        throw new errorHandler_1.NotFoundError('Counter not found');
    }
    const historyEntry = await (0, database_1.default)('counter_history')
        .where({ id: historyId, counter_id: counterId })
        .first();
    if (!historyEntry) {
        throw new errorHandler_1.NotFoundError('History entry not found');
    }
    const oldValue = counter.current_value;
    const newValue = historyEntry.old_value;
    // Update counter to the old value from history
    const [updatedCounter] = await (0, database_1.default)('counters')
        .where({ id: counterId })
        .update({
        current_value: newValue,
        updated_at: new Date(),
    })
        .returning('*');
    // Create new history entry for the undo
    await (0, database_1.default)('counter_history').insert({
        counter_id: counterId,
        old_value: oldValue,
        new_value: newValue,
        action: 'undo',
        user_note: `Undo to history entry ${historyId}`,
        created_at: new Date(),
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'counter_undo',
        entityType: 'counter',
        entityId: counterId,
        oldValues: { current_value: oldValue },
        newValues: { current_value: newValue },
    });
    res.json({
        success: true,
        message: 'Counter reverted successfully',
        data: { counter: updatedCounter },
    });
}
/**
 * Helper function to check and execute linked counter actions
 */
async function checkAndExecuteCounterLinks(counterId, newValue, userId, req) {
    // Get all active links where this counter is the source
    const links = await (0, database_1.default)('counter_links')
        .where({
        source_counter_id: counterId,
        is_active: true,
    });
    for (const link of links) {
        let shouldTrigger = false;
        // Parse trigger condition
        const condition = link.trigger_condition;
        if (typeof condition === 'object' && condition !== null) {
            const { type, value } = condition;
            switch (type) {
                case 'equals':
                    shouldTrigger = newValue === value;
                    break;
                case 'greater_than':
                    shouldTrigger = newValue > value;
                    break;
                case 'less_than':
                    shouldTrigger = newValue < value;
                    break;
                case 'multiple_of':
                    shouldTrigger = newValue % value === 0;
                    break;
                case 'every_n':
                    shouldTrigger = newValue % value === 0 && newValue > 0;
                    break;
            }
        }
        if (shouldTrigger) {
            // Get target counter
            const targetCounter = await (0, database_1.default)('counters')
                .where({ id: link.target_counter_id })
                .first();
            if (!targetCounter)
                continue;
            const targetOldValue = targetCounter.current_value;
            let targetNewValue = targetOldValue;
            // Parse and execute action
            const action = link.action;
            if (typeof action === 'object' && action !== null) {
                const { type, value } = action;
                switch (type) {
                    case 'increment':
                        targetNewValue = targetOldValue + (value || 1);
                        break;
                    case 'decrement':
                        targetNewValue = targetOldValue - (value || 1);
                        break;
                    case 'reset':
                        targetNewValue = value || 0;
                        break;
                    case 'set':
                        targetNewValue = value;
                        break;
                }
            }
            // Apply min/max constraints
            if (targetCounter.min_value !== null && targetNewValue < targetCounter.min_value) {
                targetNewValue = targetCounter.min_value;
            }
            if (targetCounter.max_value !== null && targetNewValue > targetCounter.max_value) {
                targetNewValue = targetCounter.max_value;
            }
            // Update target counter
            await (0, database_1.default)('counters')
                .where({ id: link.target_counter_id })
                .update({
                current_value: targetNewValue,
                updated_at: new Date(),
            });
            // Create history entry for target counter
            await (0, database_1.default)('counter_history').insert({
                counter_id: link.target_counter_id,
                old_value: targetOldValue,
                new_value: targetNewValue,
                action: 'linked_update',
                user_note: `Auto-updated by linked counter: ${counterId}`,
                created_at: new Date(),
            });
            // Audit log
            await (0, auditLog_1.createAuditLog)(req, {
                userId,
                action: 'counter_linked_update',
                entityType: 'counter',
                entityId: link.target_counter_id,
                oldValues: { current_value: targetOldValue },
                newValues: { current_value: targetNewValue },
            });
        }
    }
}
