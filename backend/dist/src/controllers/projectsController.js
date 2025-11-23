"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjects = getProjects;
exports.getProject = getProject;
exports.createProject = createProject;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
exports.getProjectStats = getProjectStats;
exports.addYarnToProject = addYarnToProject;
exports.updateProjectYarn = updateProjectYarn;
exports.removeYarnFromProject = removeYarnFromProject;
exports.addPatternToProject = addPatternToProject;
exports.removePatternFromProject = removePatternFromProject;
exports.addToolToProject = addToolToProject;
exports.removeToolFromProject = removeToolFromProject;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
/**
 * Get all projects for current user
 */
async function getProjects(req, res) {
    const userId = req.user.userId;
    const { status, search, page = 1, limit = 20 } = req.query;
    let query = (0, database_1.default)('projects')
        .where({ user_id: userId })
        .whereNull('deleted_at');
    if (status) {
        query = query.where({ status });
    }
    if (search) {
        query = query.where((builder) => {
            builder
                .where('name', 'ilike', `%${search}%`)
                .orWhere('description', 'ilike', `%${search}%`);
        });
    }
    const offset = (Number(page) - 1) * Number(limit);
    const [{ count }] = await query.clone().count('* as count');
    const projects = await query
        .orderBy('created_at', 'desc')
        .limit(Number(limit))
        .offset(offset);
    res.json({
        success: true,
        data: {
            projects,
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
 * Get single project by ID
 */
async function getProject(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const project = await (0, database_1.default)('projects')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Get related data
    const [photos, counters, patterns, yarn, tools] = await Promise.all([
        (0, database_1.default)('project_photos').where({ project_id: id }).orderBy('sort_order'),
        (0, database_1.default)('counters').where({ project_id: id }).orderBy('sort_order'),
        (0, database_1.default)('project_patterns as pp')
            .join('patterns as p', 'pp.pattern_id', 'p.id')
            .where({ 'pp.project_id': id })
            .select('p.*', 'pp.modifications'),
        (0, database_1.default)('project_yarn as py')
            .join('yarn as y', 'py.yarn_id', 'y.id')
            .where({ 'py.project_id': id })
            .select('y.*', 'py.yards_used', 'py.skeins_used'),
        (0, database_1.default)('project_tools as pt')
            .join('tools as t', 'pt.tool_id', 't.id')
            .where({ 'pt.project_id': id })
            .select('t.*'),
    ]);
    res.json({
        success: true,
        data: {
            project: {
                ...project,
                photos,
                counters,
                patterns,
                yarn,
                tools,
            },
        },
    });
}
/**
 * Create new project
 */
async function createProject(req, res) {
    const userId = req.user.userId;
    const { name, description, projectType, startDate, targetCompletionDate, notes, metadata, tags, } = req.body;
    if (!name) {
        throw new errorHandler_1.ValidationError('Project name is required');
    }
    const [project] = await (0, database_1.default)('projects')
        .insert({
        user_id: userId,
        name,
        description,
        project_type: projectType,
        start_date: startDate,
        target_completion_date: targetCompletionDate,
        notes,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
        tags: tags ? JSON.stringify(tags) : '[]',
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'project_created',
        entityType: 'project',
        entityId: project.id,
        newValues: project,
    });
    res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: { project },
    });
}
/**
 * Update project
 */
async function updateProject(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const updates = req.body;
    const project = await (0, database_1.default)('projects')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const [updatedProject] = await (0, database_1.default)('projects')
        .where({ id })
        .update({
        ...updates,
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'project_updated',
        entityType: 'project',
        entityId: id,
        oldValues: project,
        newValues: updatedProject,
    });
    res.json({
        success: true,
        message: 'Project updated successfully',
        data: { project: updatedProject },
    });
}
/**
 * Delete project (soft delete)
 */
async function deleteProject(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const project = await (0, database_1.default)('projects')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    await (0, database_1.default)('projects')
        .where({ id })
        .update({
        deleted_at: new Date(),
        updated_at: new Date(),
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'project_deleted',
        entityType: 'project',
        entityId: id,
        oldValues: project,
    });
    res.json({
        success: true,
        message: 'Project deleted successfully',
    });
}
/**
 * Get project statistics
 */
async function getProjectStats(req, res) {
    const userId = req.user.userId;
    const stats = await (0, database_1.default)('projects')
        .where({ user_id: userId })
        .whereNull('deleted_at')
        .select(database_1.default.raw("COUNT(*) FILTER (WHERE status = 'active') as active_count"), database_1.default.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed_count"), database_1.default.raw("COUNT(*) FILTER (WHERE status = 'paused') as paused_count"), database_1.default.raw('COUNT(*) as total_count'))
        .first();
    res.json({
        success: true,
        data: { stats },
    });
}
/**
 * Add yarn to project with automatic stash deduction
 */
async function addYarnToProject(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { yarnId, yardsUsed = 0, skeinsUsed = 0 } = req.body;
    // Verify project exists and belongs to user
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Verify yarn exists and belongs to user
    const yarn = await (0, database_1.default)('yarn')
        .where({ id: yarnId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!yarn) {
        throw new errorHandler_1.NotFoundError('Yarn not found');
    }
    // Check if yarn is already added to project
    const existing = await (0, database_1.default)('project_yarn')
        .where({ project_id: projectId, yarn_id: yarnId })
        .first();
    if (existing) {
        throw new errorHandler_1.ValidationError('This yarn is already added to the project');
    }
    // Check if sufficient yarn available
    if (yardsUsed > 0 && yarn.yards_remaining < yardsUsed) {
        throw new errorHandler_1.ValidationError(`Insufficient yarn. Only ${yarn.yards_remaining} yards remaining.`);
    }
    if (skeinsUsed > 0 && yarn.skeins_remaining < skeinsUsed) {
        throw new errorHandler_1.ValidationError(`Insufficient yarn. Only ${yarn.skeins_remaining} skeins remaining.`);
    }
    // Begin transaction
    await database_1.default.transaction(async (trx) => {
        // Add yarn to project
        await trx('project_yarn').insert({
            project_id: projectId,
            yarn_id: yarnId,
            yards_used: yardsUsed,
            skeins_used: skeinsUsed,
        });
        // Deduct from stash
        await trx('yarn')
            .where({ id: yarnId })
            .update({
            yards_remaining: trx.raw('yards_remaining - ?', [yardsUsed]),
            skeins_remaining: trx.raw('skeins_remaining - ?', [skeinsUsed]),
            updated_at: new Date(),
        });
        // Check if yarn is now low on stock
        const updatedYarn = await trx('yarn')
            .where({ id: yarnId })
            .first();
        if (updatedYarn.low_stock_alert && updatedYarn.yards_remaining <= (updatedYarn.low_stock_threshold || 100)) {
            // Log low stock alert
            await (0, auditLog_1.createAuditLog)(req, {
                userId,
                action: 'yarn_low_stock',
                entityType: 'yarn',
                entityId: yarnId,
                newValues: { yards_remaining: updatedYarn.yards_remaining },
            });
        }
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'yarn_added_to_project',
        entityType: 'project',
        entityId: projectId,
        newValues: { yarnId, yardsUsed, skeinsUsed },
    });
    res.status(201).json({
        success: true,
        message: 'Yarn added to project successfully',
    });
}
/**
 * Update yarn usage in project with automatic stash adjustment
 */
async function updateProjectYarn(req, res) {
    const userId = req.user.userId;
    const { id: projectId, yarnId } = req.params;
    const { yardsUsed, skeinsUsed } = req.body;
    // Verify project exists and belongs to user
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Get current project yarn relationship
    const projectYarn = await (0, database_1.default)('project_yarn')
        .where({ project_id: projectId, yarn_id: yarnId })
        .first();
    if (!projectYarn) {
        throw new errorHandler_1.NotFoundError('Yarn not found in this project');
    }
    // Get yarn details
    const yarn = await (0, database_1.default)('yarn')
        .where({ id: yarnId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!yarn) {
        throw new errorHandler_1.NotFoundError('Yarn not found');
    }
    // Calculate the difference
    const yardsDiff = (yardsUsed || 0) - (projectYarn.yards_used || 0);
    const skeinsDiff = (skeinsUsed || 0) - (projectYarn.skeins_used || 0);
    // Check if sufficient yarn available for increase
    if (yardsDiff > 0 && yarn.yards_remaining < yardsDiff) {
        throw new errorHandler_1.ValidationError(`Insufficient yarn. Only ${yarn.yards_remaining} yards remaining.`);
    }
    if (skeinsDiff > 0 && yarn.skeins_remaining < skeinsDiff) {
        throw new errorHandler_1.ValidationError(`Insufficient yarn. Only ${yarn.skeins_remaining} skeins remaining.`);
    }
    // Begin transaction
    await database_1.default.transaction(async (trx) => {
        // Update project yarn usage
        await trx('project_yarn')
            .where({ project_id: projectId, yarn_id: yarnId })
            .update({
            yards_used: yardsUsed,
            skeins_used: skeinsUsed,
        });
        // Adjust stash (subtract the difference)
        await trx('yarn')
            .where({ id: yarnId })
            .update({
            yards_remaining: trx.raw('yards_remaining - ?', [yardsDiff]),
            skeins_remaining: trx.raw('skeins_remaining - ?', [skeinsDiff]),
            updated_at: new Date(),
        });
        // Check if yarn is now low on stock
        const updatedYarn = await trx('yarn')
            .where({ id: yarnId })
            .first();
        if (updatedYarn.low_stock_alert && updatedYarn.yards_remaining <= (updatedYarn.low_stock_threshold || 100)) {
            await (0, auditLog_1.createAuditLog)(req, {
                userId,
                action: 'yarn_low_stock',
                entityType: 'yarn',
                entityId: yarnId,
                newValues: { yards_remaining: updatedYarn.yards_remaining },
            });
        }
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'project_yarn_updated',
        entityType: 'project',
        entityId: projectId,
        oldValues: { yardsUsed: projectYarn.yards_used, skeinsUsed: projectYarn.skeins_used },
        newValues: { yardsUsed, skeinsUsed },
    });
    res.json({
        success: true,
        message: 'Yarn usage updated successfully',
    });
}
/**
 * Remove yarn from project with stash restoration
 */
async function removeYarnFromProject(req, res) {
    const userId = req.user.userId;
    const { id: projectId, yarnId } = req.params;
    // Verify project exists and belongs to user
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Get current project yarn relationship
    const projectYarn = await (0, database_1.default)('project_yarn')
        .where({ project_id: projectId, yarn_id: yarnId })
        .first();
    if (!projectYarn) {
        throw new errorHandler_1.NotFoundError('Yarn not found in this project');
    }
    // Begin transaction
    await database_1.default.transaction(async (trx) => {
        // Remove yarn from project
        await trx('project_yarn')
            .where({ project_id: projectId, yarn_id: yarnId })
            .delete();
        // Restore to stash
        await trx('yarn')
            .where({ id: yarnId })
            .update({
            yards_remaining: trx.raw('yards_remaining + ?', [projectYarn.yards_used || 0]),
            skeins_remaining: trx.raw('skeins_remaining + ?', [projectYarn.skeins_used || 0]),
            updated_at: new Date(),
        });
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'yarn_removed_from_project',
        entityType: 'project',
        entityId: projectId,
        oldValues: { yarnId, yardsUsed: projectYarn.yards_used, skeinsUsed: projectYarn.skeins_used },
    });
    res.json({
        success: true,
        message: 'Yarn removed from project successfully',
    });
}
/**
 * Add pattern to project
 */
async function addPatternToProject(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { patternId, modifications } = req.body;
    // Verify project exists and belongs to user
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Verify pattern exists and belongs to user
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    // Check if pattern is already added
    const existing = await (0, database_1.default)('project_patterns')
        .where({ project_id: projectId, pattern_id: patternId })
        .first();
    if (existing) {
        throw new errorHandler_1.ValidationError('This pattern is already added to the project');
    }
    await (0, database_1.default)('project_patterns').insert({
        project_id: projectId,
        pattern_id: patternId,
        modifications: modifications || null,
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_added_to_project',
        entityType: 'project',
        entityId: projectId,
        newValues: { patternId, modifications },
    });
    res.status(201).json({
        success: true,
        message: 'Pattern added to project successfully',
    });
}
/**
 * Remove pattern from project
 */
async function removePatternFromProject(req, res) {
    const userId = req.user.userId;
    const { id: projectId, patternId } = req.params;
    // Verify project exists and belongs to user
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const deleted = await (0, database_1.default)('project_patterns')
        .where({ project_id: projectId, pattern_id: patternId })
        .delete();
    if (!deleted) {
        throw new errorHandler_1.NotFoundError('Pattern not found in this project');
    }
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_removed_from_project',
        entityType: 'project',
        entityId: projectId,
        oldValues: { patternId },
    });
    res.json({
        success: true,
        message: 'Pattern removed from project successfully',
    });
}
/**
 * Add tool to project
 */
async function addToolToProject(req, res) {
    const userId = req.user.userId;
    const { id: projectId } = req.params;
    const { toolId } = req.body;
    // Verify project exists and belongs to user
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    // Verify tool exists and belongs to user
    const tool = await (0, database_1.default)('tools')
        .where({ id: toolId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!tool) {
        throw new errorHandler_1.NotFoundError('Tool not found');
    }
    // Check if tool is already added
    const existing = await (0, database_1.default)('project_tools')
        .where({ project_id: projectId, tool_id: toolId })
        .first();
    if (existing) {
        throw new errorHandler_1.ValidationError('This tool is already added to the project');
    }
    await (0, database_1.default)('project_tools').insert({
        project_id: projectId,
        tool_id: toolId,
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'tool_added_to_project',
        entityType: 'project',
        entityId: projectId,
        newValues: { toolId },
    });
    res.status(201).json({
        success: true,
        message: 'Tool added to project successfully',
    });
}
/**
 * Remove tool from project
 */
async function removeToolFromProject(req, res) {
    const userId = req.user.userId;
    const { id: projectId, toolId } = req.params;
    // Verify project exists and belongs to user
    const project = await (0, database_1.default)('projects')
        .where({ id: projectId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!project) {
        throw new errorHandler_1.NotFoundError('Project not found');
    }
    const deleted = await (0, database_1.default)('project_tools')
        .where({ project_id: projectId, tool_id: toolId })
        .delete();
    if (!deleted) {
        throw new errorHandler_1.NotFoundError('Tool not found in this project');
    }
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'tool_removed_from_project',
        entityType: 'project',
        entityId: projectId,
        oldValues: { toolId },
    });
    res.json({
        success: true,
        message: 'Tool removed from project successfully',
    });
}
