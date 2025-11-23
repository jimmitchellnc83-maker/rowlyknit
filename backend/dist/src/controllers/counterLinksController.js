"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCounterLinks = getCounterLinks;
exports.getProjectLinks = getProjectLinks;
exports.createCounterLink = createCounterLink;
exports.updateCounterLink = updateCounterLink;
exports.deleteCounterLink = deleteCounterLink;
exports.toggleCounterLink = toggleCounterLink;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
/**
 * Get all links for a counter
 */
async function getCounterLinks(req, res) {
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
    // Get all links where this counter is source or target
    const links = await (0, database_1.default)('counter_links')
        .where('source_counter_id', counterId)
        .orWhere('target_counter_id', counterId)
        .orderBy('created_at', 'desc');
    // Enhance with counter details
    const enhancedLinks = await Promise.all(links.map(async (link) => {
        const [sourceCounter, targetCounter] = await Promise.all([
            (0, database_1.default)('counters').where({ id: link.source_counter_id }).first(),
            (0, database_1.default)('counters').where({ id: link.target_counter_id }).first(),
        ]);
        return {
            ...link,
            source_counter: sourceCounter,
            target_counter: targetCounter,
        };
    }));
    res.json({
        success: true,
        data: { links: enhancedLinks },
    });
}
/**
 * Get all links for a project
 */
async function getProjectLinks(req, res) {
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
    // Get all counters for this project
    const counters = await (0, database_1.default)('counters')
        .where({ project_id: projectId })
        .select('id');
    const counterIds = counters.map((c) => c.id);
    if (counterIds.length === 0) {
        return res.json({
            success: true,
            data: { links: [] },
        });
    }
    // Get all links for these counters
    const links = await (0, database_1.default)('counter_links')
        .whereIn('source_counter_id', counterIds)
        .orderBy('created_at', 'desc');
    // Enhance with counter details
    const enhancedLinks = await Promise.all(links.map(async (link) => {
        const [sourceCounter, targetCounter] = await Promise.all([
            (0, database_1.default)('counters').where({ id: link.source_counter_id }).first(),
            (0, database_1.default)('counters').where({ id: link.target_counter_id }).first(),
        ]);
        return {
            ...link,
            source_counter: sourceCounter,
            target_counter: targetCounter,
        };
    }));
    res.json({
        success: true,
        data: { links: enhancedLinks },
    });
}
/**
 * Create a counter link
 */
async function createCounterLink(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { sourceCounterId, targetCounterId, linkType, triggerCondition, action, isActive = true, } = req.body;
    if (!sourceCounterId || !targetCounterId) {
        throw new errorHandler_1.ValidationError('Source and target counter IDs are required');
    }
    if (sourceCounterId === targetCounterId) {
        throw new errorHandler_1.ValidationError('Source and target counters cannot be the same');
    }
    if (!triggerCondition || !action) {
        throw new errorHandler_1.ValidationError('Trigger condition and action are required');
    }
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Verify both counters belong to this project
    const [sourceCounter, targetCounter] = await Promise.all([
        (0, database_1.default)('counters').where({ id: sourceCounterId, project_id: projectId }).first(),
        (0, database_1.default)('counters').where({ id: targetCounterId, project_id: projectId }).first(),
    ]);
    if (!sourceCounter) {
        throw new errorHandler_1.NotFoundError('Source counter not found');
    }
    if (!targetCounter) {
        throw new errorHandler_1.NotFoundError('Target counter not found');
    }
    // Create the link
    const [link] = await (0, database_1.default)('counter_links')
        .insert({
        source_counter_id: sourceCounterId,
        target_counter_id: targetCounterId,
        link_type: linkType || 'conditional',
        trigger_condition: JSON.stringify(triggerCondition),
        action: JSON.stringify(action),
        is_active: isActive,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'counter_link_created',
        entityType: 'counter_link',
        entityId: link.id,
        newValues: link,
    });
    res.status(201).json({
        success: true,
        message: 'Counter link created successfully',
        data: { link },
    });
}
/**
 * Update a counter link
 */
async function updateCounterLink(req, res) {
    const userId = req.user.userId;
    const { id: projectId, linkId } = req.params;
    const updates = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Get the link and verify it belongs to this project
    const link = await (0, database_1.default)('counter_links')
        .where({ id: linkId })
        .first();
    if (!link) {
        throw new errorHandler_1.NotFoundError('Counter link not found');
    }
    // Verify source counter belongs to project
    const sourceCounter = await (0, database_1.default)('counters')
        .where({ id: link.source_counter_id, project_id: projectId })
        .first();
    if (!sourceCounter) {
        throw new errorHandler_1.ForbiddenError('Link does not belong to this project');
    }
    // Prepare update data
    const updateData = {
        updated_at: new Date(),
    };
    if (updates.linkType !== undefined)
        updateData.link_type = updates.linkType;
    if (updates.triggerCondition !== undefined) {
        updateData.trigger_condition = JSON.stringify(updates.triggerCondition);
    }
    if (updates.action !== undefined)
        updateData.action = JSON.stringify(updates.action);
    if (updates.isActive !== undefined)
        updateData.is_active = updates.isActive;
    const [updatedLink] = await (0, database_1.default)('counter_links')
        .where({ id: linkId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'counter_link_updated',
        entityType: 'counter_link',
        entityId: linkId,
        oldValues: link,
        newValues: updatedLink,
    });
    res.json({
        success: true,
        message: 'Counter link updated successfully',
        data: { link: updatedLink },
    });
}
/**
 * Delete a counter link
 */
async function deleteCounterLink(req, res) {
    const userId = req.user.userId;
    const { id: projectId, linkId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Get the link and verify it belongs to this project
    const link = await (0, database_1.default)('counter_links')
        .where({ id: linkId })
        .first();
    if (!link) {
        throw new errorHandler_1.NotFoundError('Counter link not found');
    }
    // Verify source counter belongs to project
    const sourceCounter = await (0, database_1.default)('counters')
        .where({ id: link.source_counter_id, project_id: projectId })
        .first();
    if (!sourceCounter) {
        throw new errorHandler_1.ForbiddenError('Link does not belong to this project');
    }
    // Delete the link
    await (0, database_1.default)('counter_links').where({ id: linkId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'counter_link_deleted',
        entityType: 'counter_link',
        entityId: linkId,
        oldValues: link,
    });
    res.json({
        success: true,
        message: 'Counter link deleted successfully',
    });
}
/**
 * Toggle link active status
 */
async function toggleCounterLink(req, res) {
    const userId = req.user.userId;
    const { id: projectId, linkId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Get the link
    const link = await (0, database_1.default)('counter_links')
        .where({ id: linkId })
        .first();
    if (!link) {
        throw new errorHandler_1.NotFoundError('Counter link not found');
    }
    // Verify source counter belongs to project
    const sourceCounter = await (0, database_1.default)('counters')
        .where({ id: link.source_counter_id, project_id: projectId })
        .first();
    if (!sourceCounter) {
        throw new errorHandler_1.ForbiddenError('Link does not belong to this project');
    }
    // Toggle active status
    const [updatedLink] = await (0, database_1.default)('counter_links')
        .where({ id: linkId })
        .update({
        is_active: !link.is_active,
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'counter_link_toggled',
        entityType: 'counter_link',
        entityId: linkId,
        oldValues: link,
        newValues: updatedLink,
    });
    res.json({
        success: true,
        message: `Counter link ${updatedLink.is_active ? 'activated' : 'deactivated'} successfully`,
        data: { link: updatedLink },
    });
}
