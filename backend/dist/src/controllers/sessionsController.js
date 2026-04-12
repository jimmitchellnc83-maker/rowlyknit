"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessions = getSessions;
exports.getSession = getSession;
exports.startSession = startSession;
exports.endSession = endSession;
exports.updateSession = updateSession;
exports.deleteSession = deleteSession;
exports.getSessionStats = getSessionStats;
exports.getActiveSession = getActiveSession;
exports.getMilestones = getMilestones;
exports.createMilestone = createMilestone;
exports.updateMilestone = updateMilestone;
exports.deleteMilestone = deleteMilestone;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
/**
 * Get all sessions for a project
 */
async function getSessions(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { page = 1, limit = 20, sortBy = 'start_time', sortOrder = 'desc' } = req.query;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const offset = (Number(page) - 1) * Number(limit);
    const [{ count }] = await (0, database_1.default)('knitting_sessions')
        .where({ project_id: projectId })
        .count('* as count');
    const sessions = await (0, database_1.default)('knitting_sessions')
        .where({ project_id: projectId })
        .orderBy(sortBy, sortOrder)
        .limit(Number(limit))
        .offset(offset);
    res.json({
        success: true,
        data: {
            sessions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: Number(count),
                totalPages: Math.ceil(Number(count) / Number(limit)),
            },
        },
    });
}
/**
 * Get single session by ID
 */
async function getSession(req, res) {
    const userId = req.user.userId;
    const { id: projectId, sessionId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const session = await (0, database_1.default)('knitting_sessions')
        .where({ id: sessionId, project_id: projectId })
        .first();
    if (!session) {
        throw new errorHandler_1.NotFoundError('Session not found');
    }
    res.json({
        success: true,
        data: { session },
    });
}
/**
 * Start a new session
 */
async function startSession(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { mood, location, notes } = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Check if there's already an active session
    const activeSession = await (0, database_1.default)('knitting_sessions')
        .where({ project_id: projectId, user_id: userId })
        .whereNull('end_time')
        .first();
    if (activeSession) {
        throw new errorHandler_1.ValidationError('There is already an active session for this project');
    }
    // Get current counter values
    const counters = await (0, database_1.default)('counters')
        .where({ project_id: projectId })
        .select('id', 'name', 'current_value');
    const counterValues = {};
    counters.forEach((c) => {
        counterValues[c.id] = {
            name: c.name,
            start_value: c.current_value,
            end_value: c.current_value,
        };
    });
    const [session] = await (0, database_1.default)('knitting_sessions')
        .insert({
        project_id: projectId,
        user_id: userId,
        start_time: new Date(),
        mood,
        location,
        notes,
        starting_counter_values: counterValues,
        created_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'session_started',
        entityType: 'session',
        entityId: session.id,
        newValues: session,
    });
    res.status(201).json({
        success: true,
        message: 'Session started successfully',
        data: { session },
    });
}
/**
 * End a session
 */
async function endSession(req, res) {
    const userId = req.user.userId;
    const { id: projectId, sessionId } = req.params;
    const { notes, mood } = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const session = await (0, database_1.default)('knitting_sessions')
        .where({ id: sessionId, project_id: projectId, user_id: userId })
        .first();
    if (!session) {
        throw new errorHandler_1.NotFoundError('Session not found');
    }
    if (session.end_time) {
        throw new errorHandler_1.ValidationError('Session has already ended');
    }
    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    // Get current counter values to calculate progress
    const counters = await (0, database_1.default)('counters')
        .where({ project_id: projectId })
        .select('id', 'name', 'current_value');
    const counterValues = session.starting_counter_values || {};
    let rowsCompleted = 0;
    counters.forEach((c) => {
        if (counterValues[c.id]) {
            counterValues[c.id].end_value = c.current_value;
            const progress = c.current_value - counterValues[c.id].start_value;
            if (c.name.toLowerCase().includes('row')) {
                rowsCompleted += progress;
            }
        }
    });
    const [updatedSession] = await (0, database_1.default)('knitting_sessions')
        .where({ id: sessionId })
        .update({
        end_time: endTime,
        duration_seconds: durationSeconds,
        rows_completed: rowsCompleted,
        ending_counter_values: counterValues,
        notes: notes || session.notes,
        mood: mood || session.mood,
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'session_ended',
        entityType: 'session',
        entityId: sessionId,
        oldValues: session,
        newValues: updatedSession,
    });
    res.json({
        success: true,
        message: 'Session ended successfully',
        data: { session: updatedSession },
    });
}
/**
 * Update a session
 */
async function updateSession(req, res) {
    const userId = req.user.userId;
    const { id: projectId, sessionId } = req.params;
    const updates = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const session = await (0, database_1.default)('knitting_sessions')
        .where({ id: sessionId, project_id: projectId, user_id: userId })
        .first();
    if (!session) {
        throw new errorHandler_1.NotFoundError('Session not found');
    }
    const updateData = {};
    if (updates.mood !== undefined)
        updateData.mood = updates.mood;
    if (updates.location !== undefined)
        updateData.location = updates.location;
    if (updates.notes !== undefined)
        updateData.notes = updates.notes;
    const [updatedSession] = await (0, database_1.default)('knitting_sessions')
        .where({ id: sessionId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'session_updated',
        entityType: 'session',
        entityId: sessionId,
        oldValues: session,
        newValues: updatedSession,
    });
    res.json({
        success: true,
        message: 'Session updated successfully',
        data: { session: updatedSession },
    });
}
/**
 * Delete a session
 */
async function deleteSession(req, res) {
    const userId = req.user.userId;
    const { id: projectId, sessionId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const session = await (0, database_1.default)('knitting_sessions')
        .where({ id: sessionId, project_id: projectId, user_id: userId })
        .first();
    if (!session) {
        throw new errorHandler_1.NotFoundError('Session not found');
    }
    await (0, database_1.default)('knitting_sessions').where({ id: sessionId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'session_deleted',
        entityType: 'session',
        entityId: sessionId,
        oldValues: session,
    });
    res.json({
        success: true,
        message: 'Session deleted successfully',
    });
}
/**
 * Get session statistics for a project
 */
async function getSessionStats(req, res) {
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
    const stats = await (0, database_1.default)('knitting_sessions')
        .where({ project_id: projectId })
        .select(database_1.default.raw('COUNT(*) as total_sessions'), database_1.default.raw('SUM(duration_seconds) as total_time_seconds'), database_1.default.raw('AVG(duration_seconds) as avg_session_duration'), database_1.default.raw('SUM(rows_completed) as total_rows_completed'), database_1.default.raw('MAX(duration_seconds) as longest_session_seconds'))
        .first();
    res.json({
        success: true,
        data: { stats },
    });
}
/**
 * Get active session for a project
 */
async function getActiveSession(req, res) {
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
    const activeSession = await (0, database_1.default)('knitting_sessions')
        .where({ project_id: projectId, user_id: userId })
        .whereNull('end_time')
        .first();
    if (!activeSession) {
        return res.json({
            success: true,
            data: null,
        });
    }
    res.json({
        success: true,
        data: activeSession,
    });
}
/**
 * Milestone Routes
 */
/**
 * Get all milestones for a project
 */
async function getMilestones(req, res) {
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
    const milestones = await (0, database_1.default)('project_milestones')
        .where({ project_id: projectId })
        .orderBy('created_at', 'desc');
    res.json({
        success: true,
        data: { milestones },
    });
}
/**
 * Create a milestone
 */
async function createMilestone(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { name, targetRows, notes } = req.body;
    if (!name) {
        throw new errorHandler_1.ValidationError('Milestone name is required');
    }
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const [milestone] = await (0, database_1.default)('project_milestones')
        .insert({
        project_id: projectId,
        name,
        target_rows: targetRows,
        notes,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'milestone_created',
        entityType: 'milestone',
        entityId: milestone.id,
        newValues: milestone,
    });
    res.status(201).json({
        success: true,
        message: 'Milestone created successfully',
        data: { milestone },
    });
}
/**
 * Update a milestone
 */
async function updateMilestone(req, res) {
    const userId = req.user.userId;
    const { id: projectId, milestoneId } = req.params;
    const updates = req.body;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const milestone = await (0, database_1.default)('project_milestones')
        .where({ id: milestoneId, project_id: projectId })
        .first();
    if (!milestone) {
        throw new errorHandler_1.NotFoundError('Milestone not found');
    }
    const updateData = { updated_at: new Date() };
    if (updates.name !== undefined)
        updateData.name = updates.name;
    if (updates.targetRows !== undefined)
        updateData.target_rows = updates.targetRows;
    if (updates.actualRows !== undefined)
        updateData.actual_rows = updates.actualRows;
    if (updates.timeSpentSeconds !== undefined)
        updateData.time_spent_seconds = updates.timeSpentSeconds;
    if (updates.completedAt !== undefined)
        updateData.completed_at = updates.completedAt;
    if (updates.notes !== undefined)
        updateData.notes = updates.notes;
    const [updatedMilestone] = await (0, database_1.default)('project_milestones')
        .where({ id: milestoneId })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'milestone_updated',
        entityType: 'milestone',
        entityId: milestoneId,
        oldValues: milestone,
        newValues: updatedMilestone,
    });
    res.json({
        success: true,
        message: 'Milestone updated successfully',
        data: { milestone: updatedMilestone },
    });
}
/**
 * Delete a milestone
 */
async function deleteMilestone(req, res) {
    const userId = req.user.userId;
    const { id: projectId, milestoneId } = req.params;
    // Verify project ownership
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const milestone = await (0, database_1.default)('project_milestones')
        .where({ id: milestoneId, project_id: projectId })
        .first();
    if (!milestone) {
        throw new errorHandler_1.NotFoundError('Milestone not found');
    }
    await (0, database_1.default)('project_milestones').where({ id: milestoneId }).del();
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'milestone_deleted',
        entityType: 'milestone',
        entityId: milestoneId,
        oldValues: milestone,
    });
    res.json({
        success: true,
        message: 'Milestone deleted successfully',
    });
}
