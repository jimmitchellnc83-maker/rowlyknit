"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getYarn = getYarn;
exports.getYarnById = getYarnById;
exports.createYarn = createYarn;
exports.updateYarn = updateYarn;
exports.deleteYarn = deleteYarn;
exports.getYarnStats = getYarnStats;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
async function getYarn(req, res) {
    const userId = req.user.userId;
    const { weight, brand, search, page = 1, limit = 20 } = req.query;
    let query = (0, database_1.default)('yarn')
        .where({ user_id: userId })
        .whereNull('deleted_at');
    if (weight) {
        query = query.where({ weight });
    }
    if (brand) {
        query = query.where({ brand });
    }
    if (search) {
        query = query.where((builder) => {
            builder
                .where('name', 'ilike', `%${search}%`)
                .orWhere('brand', 'ilike', `%${search}%`)
                .orWhere('color', 'ilike', `%${search}%`);
        });
    }
    const offset = (Number(page) - 1) * Number(limit);
    const [{ count }] = await query.clone().count('* as count');
    const yarn = await query
        .orderBy('created_at', 'desc')
        .limit(Number(limit))
        .offset(offset);
    res.json({
        success: true,
        data: {
            yarn,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: Number(count),
                totalPages: Math.ceil(Number(count) / Number(limit)),
            },
        },
    });
}
async function getYarnById(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const yarn = await (0, database_1.default)('yarn')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!yarn) {
        throw new errorHandler_1.NotFoundError('Yarn not found');
    }
    res.json({
        success: true,
        data: { yarn },
    });
}
async function createYarn(req, res) {
    const userId = req.user.userId;
    const { brand, line, name, color, colorCode, weight, fiberContent, yardsTotal, gramsTotal, skeinsTotal, pricePerSkein, purchaseDate, purchaseLocation, dyeLot, notes, tags, } = req.body;
    if (!name) {
        throw new errorHandler_1.ValidationError('Yarn name is required');
    }
    const [yarn] = await (0, database_1.default)('yarn')
        .insert({
        user_id: userId,
        brand,
        line,
        name,
        color,
        color_code: colorCode,
        weight,
        fiber_content: fiberContent,
        yards_total: yardsTotal,
        yards_remaining: yardsTotal,
        grams_total: gramsTotal,
        grams_remaining: gramsTotal,
        skeins_total: skeinsTotal || 1,
        skeins_remaining: skeinsTotal || 1,
        price_per_skein: pricePerSkein,
        purchase_date: purchaseDate,
        purchase_location: purchaseLocation,
        dye_lot: dyeLot,
        notes,
        tags: tags ? JSON.stringify(tags) : '[]',
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'yarn_created',
        entityType: 'yarn',
        entityId: yarn.id,
        newValues: yarn,
    });
    res.status(201).json({
        success: true,
        message: 'Yarn created successfully',
        data: { yarn },
    });
}
async function updateYarn(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const updates = req.body;
    const yarn = await (0, database_1.default)('yarn')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!yarn) {
        throw new errorHandler_1.NotFoundError('Yarn not found');
    }
    const [updatedYarn] = await (0, database_1.default)('yarn')
        .where({ id })
        .update({
        ...updates,
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'yarn_updated',
        entityType: 'yarn',
        entityId: id,
        oldValues: yarn,
        newValues: updatedYarn,
    });
    res.json({
        success: true,
        message: 'Yarn updated successfully',
        data: { yarn: updatedYarn },
    });
}
async function deleteYarn(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const yarn = await (0, database_1.default)('yarn')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!yarn) {
        throw new errorHandler_1.NotFoundError('Yarn not found');
    }
    await (0, database_1.default)('yarn')
        .where({ id })
        .update({
        deleted_at: new Date(),
        updated_at: new Date(),
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'yarn_deleted',
        entityType: 'yarn',
        entityId: id,
        oldValues: yarn,
    });
    res.json({
        success: true,
        message: 'Yarn deleted successfully',
    });
}
async function getYarnStats(req, res) {
    const userId = req.user.userId;
    const stats = await (0, database_1.default)('yarn')
        .where({ user_id: userId })
        .whereNull('deleted_at')
        .select(database_1.default.raw('COUNT(*) as total_count'), database_1.default.raw('SUM(skeins_remaining) as total_skeins'), database_1.default.raw('SUM(yards_remaining) as total_yards'))
        .first();
    res.json({
        success: true,
        data: { stats },
    });
}
