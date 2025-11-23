"use strict";
/**
 * Input sanitization utilities to prevent mass assignment vulnerabilities
 * and other security issues
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_FIELDS = void 0;
exports.pickFields = pickFields;
exports.sanitizeSearchQuery = sanitizeSearchQuery;
exports.sanitizeFilename = sanitizeFilename;
exports.sanitizeHeaderValue = sanitizeHeaderValue;
/**
 * Pick only allowed fields from an object
 */
function pickFields(data, allowedFields) {
    const result = {};
    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            result[field] = data[field];
        }
    }
    return result;
}
/**
 * Sanitize search query to prevent SQL injection
 * (Knex already handles this, but this provides explicit sanitization)
 */
function sanitizeSearchQuery(query) {
    if (typeof query !== 'string') {
        return '';
    }
    // Remove potentially dangerous characters
    // Keep alphanumeric, spaces, hyphens, underscores
    return query.replace(/[^\w\s\-]/g, '').trim().slice(0, 200);
}
/**
 * Sanitize filename to prevent path traversal attacks
 */
function sanitizeFilename(filename) {
    if (typeof filename !== 'string') {
        return '';
    }
    // Remove path separators and null bytes
    return filename
        .replace(/[\/\\:*?"<>|\x00]/g, '')
        .replace(/\.\.+/g, '.')
        .trim()
        .slice(0, 255);
}
/**
 * Sanitize Content-Disposition header value
 */
function sanitizeHeaderValue(value) {
    if (typeof value !== 'string') {
        return '';
    }
    // Remove newlines and other control characters that could enable header injection
    return value.replace(/[\r\n\x00]/g, '').trim();
}
/**
 * Allowed fields for each entity type
 */
exports.ALLOWED_FIELDS = {
    pattern: [
        'name',
        'description',
        'designer',
        'source',
        'sourceUrl',
        'difficulty',
        'category',
        'yarnRequirements',
        'needleSizes',
        'gauge',
        'sizesAvailable',
        'estimatedYardage',
        'notes',
        'tags',
        'isFavorite',
    ],
    project: [
        'name',
        'description',
        'projectType',
        'startDate',
        'targetCompletionDate',
        'completedDate',
        'status',
        'notes',
        'metadata',
        'tags',
    ],
    yarn: [
        'brand',
        'name',
        'weight',
        'fiber',
        'colorName',
        'colorCode',
        'yardage',
        'gramsPerSkein',
        'purchaseDate',
        'purchaseLocation',
        'purchasePrice',
        'quantity',
        'notes',
    ],
    tool: [
        'name',
        'type',
        'size',
        'material',
        'brand',
        'purchaseDate',
        'purchaseLocation',
        'purchasePrice',
        'notes',
    ],
    note: [
        'title',
        'content',
        'noteType',
        'tags',
    ],
    counter: [
        'name',
        'currentValue',
        'targetValue',
        'step',
        'notes',
    ],
    recipient: [
        'name',
        'relationship',
        'measurements',
        'preferences',
        'notes',
    ],
    session: [
        'duration',
        'rowsCompleted',
        'notes',
    ],
};
