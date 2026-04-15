"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecipients = getRecipients;
exports.getRecipient = getRecipient;
exports.createRecipient = createRecipient;
exports.updateRecipient = updateRecipient;
exports.deleteRecipient = deleteRecipient;
exports.getRecipientStats = getRecipientStats;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
const inputSanitizer_1 = require("../utils/inputSanitizer");
async function getRecipients(req, res) {
    const userId = req.user.userId;
    const { search, page = 1, limit = 20 } = req.query;
    let query = (0, database_1.default)('recipients')
        .where({ user_id: userId })
        .whereNull('deleted_at');
    if (search) {
        const sanitizedSearch = (0, inputSanitizer_1.sanitizeSearchQuery)(search);
        query = query.where((builder) => {
            builder
                .where('first_name', 'ilike', `%${sanitizedSearch}%`)
                .orWhere('last_name', 'ilike', `%${sanitizedSearch}%`)
                .orWhere('relationship', 'ilike', `%${sanitizedSearch}%`);
        });
    }
    const offset = (Number(page) - 1) * Number(limit);
    const [{ count }] = await query.clone().count('* as count');
    const recipients = await query
        .orderBy('first_name', 'asc')
        .limit(Number(limit))
        .offset(offset);
    res.json({
        success: true,
        data: {
            recipients,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: Number(count),
                totalPages: Math.ceil(Number(count) / Number(limit)),
            },
        },
    });
}
async function getRecipient(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const recipient = await (0, database_1.default)('recipients')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!recipient) {
        throw new errorHandler_1.NotFoundError('Recipient not found');
    }
    const gifts = await (0, database_1.default)('gifts')
        .where({ recipient_id: id })
        .orderBy('date_given', 'desc');
    res.json({
        success: true,
        data: {
            recipient: {
                ...recipient,
                gifts,
            },
        },
    });
}
async function createRecipient(req, res) {
    const userId = req.user.userId;
    const { firstName, lastName, relationship, birthday, measurements, preferences, clothingSize, shoeSize, notes, } = req.body;
    if (!firstName) {
        throw new errorHandler_1.ValidationError('First name is required');
    }
    const [recipient] = await (0, database_1.default)('recipients')
        .insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        relationship,
        birthday,
        measurements: measurements ? JSON.stringify(measurements) : '{}',
        preferences: preferences ? JSON.stringify(preferences) : '{}',
        clothing_size: clothingSize,
        shoe_size: shoeSize,
        notes,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'recipient_created',
        entityType: 'recipient',
        entityId: recipient.id,
        newValues: recipient,
    });
    res.status(201).json({
        success: true,
        message: 'Recipient created successfully',
        data: { recipient },
    });
}
async function updateRecipient(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const recipient = await (0, database_1.default)('recipients')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!recipient) {
        throw new errorHandler_1.NotFoundError('Recipient not found');
    }
    // Whitelist allowed fields -- use same camelCase names as createRecipient
    const { firstName, lastName, relationship, birthday, measurements, preferences, clothingSize, shoeSize, notes, } = req.body;
    const updateData = {
        updated_at: new Date(),
    };
    if (firstName !== undefined)
        updateData.first_name = firstName;
    if (lastName !== undefined)
        updateData.last_name = lastName;
    if (relationship !== undefined)
        updateData.relationship = relationship;
    if (birthday !== undefined)
        updateData.birthday = birthday;
    if (measurements !== undefined)
        updateData.measurements = JSON.stringify(measurements);
    if (preferences !== undefined)
        updateData.preferences = JSON.stringify(preferences);
    if (clothingSize !== undefined)
        updateData.clothing_size = clothingSize;
    if (shoeSize !== undefined)
        updateData.shoe_size = shoeSize;
    if (notes !== undefined)
        updateData.notes = notes;
    const [updatedRecipient] = await (0, database_1.default)('recipients')
        .where({ id })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'recipient_updated',
        entityType: 'recipient',
        entityId: id,
        oldValues: recipient,
        newValues: updatedRecipient,
    });
    res.json({
        success: true,
        message: 'Recipient updated successfully',
        data: { recipient: updatedRecipient },
    });
}
async function deleteRecipient(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const recipient = await (0, database_1.default)('recipients')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!recipient) {
        throw new errorHandler_1.NotFoundError('Recipient not found');
    }
    await (0, database_1.default)('recipients')
        .where({ id })
        .update({
        deleted_at: new Date(),
        updated_at: new Date(),
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'recipient_deleted',
        entityType: 'recipient',
        entityId: id,
        oldValues: recipient,
    });
    res.json({
        success: true,
        message: 'Recipient deleted successfully',
    });
}
async function getRecipientStats(req, res) {
    const userId = req.user.userId;
    const stats = await (0, database_1.default)('recipients')
        .where({ user_id: userId })
        .whereNull('deleted_at')
        .select(database_1.default.raw('COUNT(*) as total_count'))
        .first();
    res.json({
        success: true,
        data: { stats },
    });
}
