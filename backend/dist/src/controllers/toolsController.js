"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTools = getTools;
exports.getTool = getTool;
exports.createTool = createTool;
exports.updateTool = updateTool;
exports.deleteTool = deleteTool;
exports.getToolStats = getToolStats;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
async function getTools(req, res) {
    const userId = req.user.userId;
    const { type, search, page = 1, limit = 20 } = req.query;
    let query = (0, database_1.default)('tools')
        .where({ user_id: userId })
        .whereNull('deleted_at');
    if (type) {
        query = query.where({ type });
    }
    if (search) {
        query = query.where((builder) => {
            builder
                .where('name', 'ilike', `%${search}%`)
                .orWhere('brand', 'ilike', `%${search}%`);
        });
    }
    const offset = (Number(page) - 1) * Number(limit);
    const [{ count }] = await query.clone().count('* as count');
    const tools = await query
        .orderBy('created_at', 'desc')
        .limit(Number(limit))
        .offset(offset);
    res.json({
        success: true,
        data: {
            tools,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: Number(count),
                totalPages: Math.ceil(Number(count) / Number(limit)),
            },
        },
    });
}
async function getTool(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const tool = await (0, database_1.default)('tools')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!tool) {
        throw new errorHandler_1.NotFoundError('Tool not found');
    }
    res.json({
        success: true,
        data: { tool },
    });
}
async function createTool(req, res) {
    const userId = req.user.userId;
    const { type, name, size, sizeMm, material, length, brand, quantity, notes, purchaseDate, purchasePrice, } = req.body;
    if (!name || !type) {
        throw new errorHandler_1.ValidationError('Tool name and type are required');
    }
    const [tool] = await (0, database_1.default)('tools')
        .insert({
        user_id: userId,
        type,
        name,
        size,
        size_mm: sizeMm,
        material,
        length,
        brand,
        quantity: quantity || 1,
        notes,
        purchase_date: purchaseDate,
        purchase_price: purchasePrice,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'tool_created',
        entityType: 'tool',
        entityId: tool.id,
        newValues: tool,
    });
    res.status(201).json({
        success: true,
        message: 'Tool created successfully',
        data: { tool },
    });
}
async function updateTool(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const updates = req.body;
    const tool = await (0, database_1.default)('tools')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!tool) {
        throw new errorHandler_1.NotFoundError('Tool not found');
    }
    const [updatedTool] = await (0, database_1.default)('tools')
        .where({ id })
        .update({
        ...updates,
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'tool_updated',
        entityType: 'tool',
        entityId: id,
        oldValues: tool,
        newValues: updatedTool,
    });
    res.json({
        success: true,
        message: 'Tool updated successfully',
        data: { tool: updatedTool },
    });
}
async function deleteTool(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const tool = await (0, database_1.default)('tools')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!tool) {
        throw new errorHandler_1.NotFoundError('Tool not found');
    }
    await (0, database_1.default)('tools')
        .where({ id })
        .update({
        deleted_at: new Date(),
        updated_at: new Date(),
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'tool_deleted',
        entityType: 'tool',
        entityId: id,
        oldValues: tool,
    });
    res.json({
        success: true,
        message: 'Tool deleted successfully',
    });
}
async function getToolStats(req, res) {
    const userId = req.user.userId;
    const stats = await (0, database_1.default)('tools')
        .where({ user_id: userId })
        .whereNull('deleted_at')
        .select(database_1.default.raw('COUNT(*) as total_count'), database_1.default.raw("COUNT(*) FILTER (WHERE type = 'needle') as needle_count"), database_1.default.raw("COUNT(*) FILTER (WHERE type = 'hook') as hook_count"))
        .first();
    res.json({
        success: true,
        data: { stats },
    });
}
