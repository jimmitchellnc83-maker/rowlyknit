"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCounters = getCounters;
exports.getCounterHierarchy = getCounterHierarchy;
exports.getCounter = getCounter;
exports.createCounter = createCounter;
exports.updateCounter = updateCounter;
exports.deleteCounter = deleteCounter;
exports.reorderCounters = reorderCounters;
exports.getCounterHistory = getCounterHistory;
exports.undoCounterToPoint = undoCounterToPoint;
exports.incrementWithChildren = incrementWithChildren;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
const socket_1 = require("../config/socket");
const logger_1 = __importDefault(require("../config/logger"));
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
 * Get counters in hierarchical structure
 */
async function getCounterHierarchy(req, res) {
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
    // Get all counters for the project
    const counters = await (0, database_1.default)('counters')
        .where({ project_id: projectId })
        .orderBy('sort_order', 'asc')
        .orderBy('created_at', 'asc');
    // Build hierarchy
    const counterMap = new Map();
    const rootCounters = [];
    // First pass: create map of all counters with empty children array
    counters.forEach((counter) => {
        counterMap.set(counter.id, { ...counter, children: [] });
    });
    // Second pass: build hierarchy
    counters.forEach((counter) => {
        const counterWithChildren = counterMap.get(counter.id);
        if (counter.parent_counter_id && counterMap.has(counter.parent_counter_id)) {
            counterMap.get(counter.parent_counter_id).children.push(counterWithChildren);
        }
        else {
            rootCounters.push(counterWithChildren);
        }
    });
    res.json({
        success: true,
        data: { counters: rootCounters },
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
    const { name, type, currentValue = 0, targetValue, incrementBy = 1, minValue, maxValue, displayColor, isVisible = true, incrementPattern, sortOrder, notes, parentCounterId, autoReset = false, } = req.body;
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
        parent_counter_id: parentCounterId || null,
        auto_reset: autoReset,
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
    // Accept both camelCase (from frontend) and snake_case field names
    const resolve = (camel, snake) => updates[camel] !== undefined ? updates[camel] : updates[snake];
    const currentValueInput = resolve('currentValue', 'current_value');
    const oldValue = counter.current_value;
    const newValue = currentValueInput !== undefined ? currentValueInput : oldValue;
    // Prepare update data
    const updateData = {
        updated_at: new Date(),
    };
    // Update allowed fields -- accept camelCase or snake_case
    const nameVal = updates.name;
    const typeVal = updates.type;
    const targetValue = resolve('targetValue', 'target_value');
    const incrementBy = resolve('incrementBy', 'increment_by');
    const minValue = resolve('minValue', 'min_value');
    const maxValue = resolve('maxValue', 'max_value');
    const displayColor = resolve('displayColor', 'display_color');
    const isVisible = resolve('isVisible', 'is_visible');
    const incrementPattern = resolve('incrementPattern', 'increment_pattern');
    const sortOrder = resolve('sortOrder', 'sort_order');
    const notesVal = updates.notes;
    if (nameVal !== undefined)
        updateData.name = nameVal;
    if (typeVal !== undefined)
        updateData.type = typeVal;
    if (currentValueInput !== undefined)
        updateData.current_value = currentValueInput;
    if (targetValue !== undefined)
        updateData.target_value = targetValue;
    if (incrementBy !== undefined)
        updateData.increment_by = incrementBy;
    if (minValue !== undefined)
        updateData.min_value = minValue;
    if (maxValue !== undefined)
        updateData.max_value = maxValue;
    if (displayColor !== undefined)
        updateData.display_color = displayColor;
    if (isVisible !== undefined)
        updateData.is_visible = isVisible;
    if (incrementPattern !== undefined) {
        updateData.increment_pattern = incrementPattern ? JSON.stringify(incrementPattern) : null;
    }
    if (sortOrder !== undefined)
        updateData.sort_order = sortOrder;
    if (notesVal !== undefined)
        updateData.notes = notesVal;
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
    logger_1.default.debug(`[Counter Links] Checking ${links.length} link(s) for counter ${counterId} (value: ${newValue})`);
    for (const link of links) {
        let shouldTrigger = false;
        try {
            // Parse trigger condition (stored as JSON string in database)
            let condition = link.trigger_condition;
            if (typeof condition === 'string') {
                try {
                    condition = JSON.parse(condition);
                }
                catch (e) {
                    logger_1.default.error(`[Counter Links] Failed to parse trigger_condition for link ${link.id}:`, e);
                    continue;
                }
            }
            if (typeof condition === 'object' && condition !== null) {
                const { type, value } = condition;
                logger_1.default.debug(`[Counter Links] Link ${link.id}: Checking condition ${type} ${value} against ${newValue}`);
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
                    case 'modulo':
                        shouldTrigger = value > 0 && newValue % value === 0;
                        break;
                    case 'every_n':
                        shouldTrigger = value > 0 && newValue % value === 0 && newValue > 0;
                        break;
                }
                logger_1.default.debug(`[Counter Links] Link ${link.id}: Trigger = ${shouldTrigger}`);
            }
            if (shouldTrigger) {
                // Get target counter
                const targetCounter = await (0, database_1.default)('counters')
                    .where({ id: link.target_counter_id })
                    .first();
                if (!targetCounter) {
                    logger_1.default.warn(`[Counter Links] Target counter ${link.target_counter_id} not found for link ${link.id}`);
                    continue;
                }
                const targetOldValue = targetCounter.current_value;
                let targetNewValue = targetOldValue;
                // Parse and execute action (stored as JSON string in database)
                let action = link.action;
                if (typeof action === 'string') {
                    try {
                        action = JSON.parse(action);
                    }
                    catch (e) {
                        logger_1.default.error(`[Counter Links] Failed to parse action for link ${link.id}:`, e);
                        continue;
                    }
                }
                if (typeof action === 'object' && action !== null) {
                    const { type, value } = action;
                    logger_1.default.debug(`[Counter Links] Executing action ${type} ${value !== undefined ? value : ''} on counter ${link.target_counter_id}`);
                    switch (type) {
                        case 'increment':
                            targetNewValue = targetOldValue + (value || 1);
                            break;
                        case 'decrement':
                            targetNewValue = targetOldValue - (value || 1);
                            break;
                        case 'reset':
                            targetNewValue = value !== undefined ? value : 0;
                            break;
                        case 'set':
                            targetNewValue = value;
                            break;
                    }
                }
                // Apply min/max constraints
                if (targetCounter.min_value !== null && targetNewValue < targetCounter.min_value) {
                    logger_1.default.debug(`[Counter Links] Clamping to min_value: ${targetCounter.min_value}`);
                    targetNewValue = targetCounter.min_value;
                }
                if (targetCounter.max_value !== null && targetNewValue > targetCounter.max_value) {
                    logger_1.default.debug(`[Counter Links] Clamping to max_value: ${targetCounter.max_value}`);
                    targetNewValue = targetCounter.max_value;
                }
                logger_1.default.debug(`[Counter Links] Updating counter ${link.target_counter_id}: ${targetOldValue} -> ${targetNewValue}`);
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
                // Emit WebSocket event for real-time updates
                try {
                    const io = (0, socket_1.getIO)();
                    io.to(`project:${targetCounter.project_id}`).emit('counter:updated', {
                        counterId: link.target_counter_id,
                        projectId: targetCounter.project_id,
                        currentValue: targetNewValue,
                        linkedFrom: counterId,
                    });
                    logger_1.default.debug(`[Counter Links] WebSocket event emitted for counter ${link.target_counter_id}`);
                }
                catch (socketError) {
                    // Don't fail the whole operation if WebSocket fails
                    logger_1.default.error(`[Counter Links] Failed to emit WebSocket event:`, socketError);
                }
                logger_1.default.debug(`[Counter Links] Successfully updated linked counter ${link.target_counter_id}`);
            }
        }
        catch (error) {
            logger_1.default.error(`[Counter Links] Error processing link ${link.id}:`, error);
            // Continue processing other links even if one fails
        }
    }
}
/**
 * Increment counter with all children (for linked mode)
 */
async function incrementWithChildren(req, res) {
    const userId = req.user.userId;
    const { id: projectId, counterId } = req.params;
    const { amount = 1, mode = 'linked' } = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Get the counter
    const counter = await (0, database_1.default)('counters')
        .where({ id: counterId, project_id: projectId })
        .first();
    if (!counter) {
        throw new errorHandler_1.NotFoundError('Counter not found');
    }
    const updates = [];
    // Update primary counter
    const oldValue = counter.current_value;
    let newValue = oldValue + amount;
    // Apply min/max constraints
    if (counter.min_value !== null && newValue < counter.min_value) {
        newValue = counter.min_value;
    }
    if (counter.max_value !== null && newValue > counter.max_value) {
        newValue = counter.max_value;
    }
    await (0, database_1.default)('counters')
        .where({ id: counterId })
        .update({
        current_value: newValue,
        updated_at: new Date(),
    });
    // Create history entry
    await (0, database_1.default)('counter_history').insert({
        counter_id: counterId,
        old_value: oldValue,
        new_value: newValue,
        action: amount > 0 ? 'increment' : 'decrement',
        created_at: new Date(),
    });
    updates.push({
        id: counterId,
        new_value: newValue,
        reset: false,
    });
    // If linked mode, update all child counters
    if (mode === 'linked') {
        const children = await (0, database_1.default)('counters')
            .where({ parent_counter_id: counterId, project_id: projectId })
            .orderBy('sort_order', 'asc');
        for (const child of children) {
            const childOldValue = child.current_value;
            let childNewValue = childOldValue + amount;
            let didReset = false;
            let completionMessage;
            // Check if child should auto-reset
            if (child.auto_reset && child.target_value && amount > 0) {
                if (childNewValue >= child.target_value) {
                    // Calculate reset value (handle cases where increment > remaining)
                    const completedRepeats = Math.floor(childNewValue / child.target_value);
                    childNewValue = childNewValue % child.target_value;
                    if (childNewValue === 0) {
                        childNewValue = child.target_value; // Show full before reset animation
                    }
                    // Actually reset to 1 (or min_value) for the next repeat
                    if (childOldValue + amount >= child.target_value) {
                        childNewValue = child.min_value || 1;
                        didReset = true;
                        completionMessage = `${child.name} complete! Starting repeat ${completedRepeats + 1}.`;
                    }
                }
            }
            // Apply min/max constraints
            if (child.min_value !== null && childNewValue < child.min_value) {
                childNewValue = child.min_value;
            }
            if (child.max_value !== null && childNewValue > child.max_value) {
                childNewValue = child.max_value;
            }
            await (0, database_1.default)('counters')
                .where({ id: child.id })
                .update({
                current_value: childNewValue,
                updated_at: new Date(),
            });
            // Create history entry for child
            await (0, database_1.default)('counter_history').insert({
                counter_id: child.id,
                old_value: childOldValue,
                new_value: childNewValue,
                action: didReset ? 'reset' : (amount > 0 ? 'increment' : 'decrement'),
                user_note: didReset ? completionMessage : `Linked update from parent counter`,
                created_at: new Date(),
            });
            updates.push({
                id: child.id,
                new_value: childNewValue,
                reset: didReset,
                completion_message: completionMessage,
            });
        }
    }
    // Emit WebSocket events for real-time updates
    try {
        const io = (0, socket_1.getIO)();
        updates.forEach((update) => {
            io.to(`project:${projectId}`).emit('counter:updated', {
                counterId: update.id,
                projectId,
                currentValue: update.new_value,
                reset: update.reset,
            });
        });
    }
    catch (socketError) {
        console.error('[Counter Hierarchy] Failed to emit WebSocket events:', socketError);
    }
    // Audit log
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'counter_increment_with_children',
        entityType: 'counter',
        entityId: counterId,
        oldValues: { current_value: oldValue },
        newValues: { current_value: newValue, updates },
    });
    res.json({
        success: true,
        message: 'Counters updated successfully',
        data: { updated_counters: updates },
    });
}
