"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatterns = getPatterns;
exports.getPattern = getPattern;
exports.getPatternCharts = getPatternCharts;
exports.createPattern = createPattern;
exports.updatePattern = updatePattern;
exports.deletePattern = deletePattern;
exports.getPatternStats = getPatternStats;
exports.collatePatterns = collatePatterns;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = require("../utils/errorHandler");
const auditLog_1 = require("../middleware/auditLog");
const logger_1 = __importDefault(require("../config/logger"));
const pdf_lib_1 = require("pdf-lib");
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const inputSanitizer_1 = require("../utils/inputSanitizer");
/**
 * Serialize pattern fields for frontend.
 * After migration 37, needle_sizes/gauge/sizes_available/yarn_requirements are TEXT.
 * Only tags is still JSONB.
 */
function serializePattern(pattern) {
    return {
        ...pattern,
        tags: pattern.tags ? (typeof pattern.tags === 'string' ? pattern.tags : JSON.stringify(pattern.tags)) : null,
    };
}
/**
 * Coerce structured Ravelry data into a clean display string.
 * - Strings pass through.
 * - Arrays get joined intelligently.
 * - Objects get a sensible string form.
 */
function toDisplayString(val) {
    if (val === null || val === undefined || val === '')
        return null;
    if (typeof val === 'string')
        return val.trim() || null;
    if (typeof val === 'number')
        return String(val);
    if (Array.isArray(val)) {
        if (val.length === 0)
            return null;
        const parts = val.map((x) => {
            if (x == null)
                return null;
            if (typeof x === 'string')
                return x;
            if (x.name)
                return x.name;
            if (x.yarnName)
                return [x.yarnName, x.yarnCompany, x.quantity].filter(Boolean).join(' — ');
            return null;
        }).filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : null;
    }
    if (typeof val === 'object') {
        if (val.name)
            return val.name;
        return null;
    }
    return null;
}
/**
 * Get all patterns for current user
 */
async function getPatterns(req, res) {
    const userId = req.user.userId;
    const { category, difficulty, search, page = 1, limit = 20 } = req.query;
    let query = (0, database_1.default)('patterns')
        .where({ user_id: userId })
        .whereNull('deleted_at');
    if (category) {
        query = query.where({ category });
    }
    if (difficulty) {
        query = query.where({ difficulty });
    }
    if (search) {
        const sanitizedSearch = (0, inputSanitizer_1.sanitizeSearchQuery)(search);
        query = query.where((builder) => {
            builder
                .where('name', 'ilike', `%${sanitizedSearch}%`)
                .orWhere('description', 'ilike', `%${sanitizedSearch}%`)
                .orWhere('designer', 'ilike', `%${sanitizedSearch}%`);
        });
    }
    const offset = (Number(page) - 1) * Number(limit);
    const [{ count }] = await query.clone().count('* as count');
    const patterns = await query
        .orderBy('created_at', 'desc')
        .limit(Number(limit))
        .offset(offset);
    // Serialize JSONB fields to strings for frontend
    const serializedPatterns = patterns.map(serializePattern);
    res.json({
        success: true,
        data: {
            patterns: serializedPatterns,
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
 * Get single pattern by ID
 */
async function getPattern(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const pattern = await (0, database_1.default)('patterns')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    // Get projects using this pattern
    const projects = await (0, database_1.default)('project_patterns as pp')
        .join('projects as p', 'pp.project_id', 'p.id')
        .where({ 'pp.pattern_id': id, 'p.user_id': userId })
        .whereNull('p.deleted_at')
        .select('p.*', 'pp.modifications');
    // Serialize JSONB fields to strings for frontend
    const serializedPattern = serializePattern(pattern);
    res.json({
        success: true,
        data: {
            pattern: {
                ...serializedPattern,
                projects,
            },
        },
    });
}
/**
 * Get charts associated with a pattern (direct link or via related projects)
 */
async function getPatternCharts(req, res) {
    const userId = req.user.userId;
    const { id: patternId } = req.params;
    const pattern = await (0, database_1.default)('patterns')
        .where({ id: patternId, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    const relatedProjects = await (0, database_1.default)('project_patterns')
        .where({ pattern_id: patternId })
        .pluck('project_id');
    const charts = await (0, database_1.default)('charts as c')
        .leftJoin('projects as p', 'c.project_id', 'p.id')
        .where('c.user_id', userId)
        .andWhere((builder) => {
        builder.where('c.pattern_id', patternId);
        if (relatedProjects.length > 0) {
            builder.orWhereIn('c.project_id', relatedProjects);
        }
    })
        .select('c.*', database_1.default.raw('p.name as project_name'))
        .orderBy('c.updated_at', 'desc');
    res.json({
        success: true,
        data: { charts },
    });
}
/**
 * Create new pattern
 */
async function createPattern(req, res) {
    const userId = req.user.userId;
    const { name, description, designer, source, sourceUrl, difficulty, category, yarnRequirements, needleSizes, gauge, sizesAvailable, estimatedYardage, notes, tags, } = req.body;
    if (!name) {
        throw new errorHandler_1.ValidationError('Pattern name is required');
    }
    const [pattern] = await (0, database_1.default)('patterns')
        .insert({
        user_id: userId,
        name,
        description,
        designer,
        source,
        source_url: sourceUrl,
        difficulty,
        category,
        yarn_requirements: toDisplayString(yarnRequirements),
        needle_sizes: toDisplayString(needleSizes),
        gauge: toDisplayString(gauge),
        sizes_available: toDisplayString(sizesAvailable),
        estimated_yardage: estimatedYardage,
        notes,
        tags: tags ? JSON.stringify(tags) : '[]',
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_created',
        entityType: 'pattern',
        entityId: pattern.id,
        newValues: pattern,
    });
    res.status(201).json({
        success: true,
        message: 'Pattern created successfully',
        data: { pattern },
    });
}
/**
 * Update pattern
 */
async function updatePattern(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const pattern = await (0, database_1.default)('patterns')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    // Whitelist allowed fields to prevent mass assignment
    const { name, description, designer, source, sourceUrl, difficulty, category, yarnRequirements, needleSizes, gauge, sizesAvailable, estimatedYardage, notes, tags, isFavorite, } = req.body;
    const updateData = {
        updated_at: new Date(),
    };
    if (name !== undefined)
        updateData.name = name;
    if (description !== undefined)
        updateData.description = description;
    if (designer !== undefined)
        updateData.designer = designer;
    if (source !== undefined)
        updateData.source = source;
    if (sourceUrl !== undefined)
        updateData.source_url = sourceUrl;
    if (difficulty !== undefined)
        updateData.difficulty = difficulty;
    if (category !== undefined)
        updateData.category = category;
    if (yarnRequirements !== undefined)
        updateData.yarn_requirements = toDisplayString(yarnRequirements);
    if (needleSizes !== undefined)
        updateData.needle_sizes = toDisplayString(needleSizes);
    if (gauge !== undefined)
        updateData.gauge = toDisplayString(gauge);
    if (sizesAvailable !== undefined)
        updateData.sizes_available = toDisplayString(sizesAvailable);
    if (estimatedYardage !== undefined)
        updateData.estimated_yardage = estimatedYardage;
    if (notes !== undefined)
        updateData.notes = notes;
    if (tags !== undefined)
        updateData.tags = JSON.stringify(tags);
    if (isFavorite !== undefined)
        updateData.is_favorite = isFavorite;
    const [updatedPattern] = await (0, database_1.default)('patterns')
        .where({ id })
        .update(updateData)
        .returning('*');
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_updated',
        entityType: 'pattern',
        entityId: id,
        oldValues: pattern,
        newValues: updatedPattern,
    });
    res.json({
        success: true,
        message: 'Pattern updated successfully',
        data: { pattern: updatedPattern },
    });
}
/**
 * Delete pattern (soft delete)
 */
async function deletePattern(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    const pattern = await (0, database_1.default)('patterns')
        .where({ id, user_id: userId })
        .whereNull('deleted_at')
        .first();
    if (!pattern) {
        throw new errorHandler_1.NotFoundError('Pattern not found');
    }
    await (0, database_1.default)('patterns')
        .where({ id })
        .update({
        deleted_at: new Date(),
        updated_at: new Date(),
    });
    await (0, auditLog_1.createAuditLog)(req, {
        userId,
        action: 'pattern_deleted',
        entityType: 'pattern',
        entityId: id,
        oldValues: pattern,
    });
    res.json({
        success: true,
        message: 'Pattern deleted successfully',
    });
}
/**
 * Get pattern statistics
 */
async function getPatternStats(req, res) {
    const userId = req.user.userId;
    const stats = await (0, database_1.default)('patterns')
        .where({ user_id: userId })
        .whereNull('deleted_at')
        .select(database_1.default.raw('COUNT(*) as total_count'), database_1.default.raw("COUNT(*) FILTER (WHERE is_favorite = true) as favorite_count"), database_1.default.raw("COUNT(*) FILTER (WHERE difficulty = 'beginner') as beginner_count"), database_1.default.raw("COUNT(*) FILTER (WHERE difficulty = 'intermediate') as intermediate_count"), database_1.default.raw("COUNT(*) FILTER (WHERE difficulty = 'advanced') as advanced_count"))
        .first();
    res.json({
        success: true,
        data: { stats },
    });
}
/**
 * Collate multiple patterns into a single PDF
 */
async function collatePatterns(req, res) {
    const userId = req.user.userId;
    const { patternIds, addDividers = false, dividerText = 'Pattern' } = req.body;
    if (!patternIds || !Array.isArray(patternIds) || patternIds.length === 0) {
        throw new errorHandler_1.ValidationError('Pattern IDs are required');
    }
    // Verify all patterns belong to user and have PDF files
    const patterns = await (0, database_1.default)('patterns')
        .whereIn('id', patternIds)
        .where({ user_id: userId })
        .whereNull('deleted_at');
    if (patterns.length !== patternIds.length) {
        throw new errorHandler_1.NotFoundError('One or more patterns not found');
    }
    // Get PDF files for patterns
    const pdfFiles = await (0, database_1.default)('pattern_files')
        .whereIn('pattern_id', patternIds)
        .where({ file_type: 'pdf' });
    if (pdfFiles.length === 0) {
        throw new errorHandler_1.ValidationError('No PDF files found for the selected patterns');
    }
    try {
        // Create a new PDF document
        const mergedPdf = await pdf_lib_1.PDFDocument.create();
        // Process each pattern in the order specified
        for (let i = 0; i < patternIds.length; i++) {
            const patternId = patternIds[i];
            const pdfFile = pdfFiles.find((f) => f.pattern_id === patternId);
            if (!pdfFile) {
                logger_1.default.warn('No PDF file found for pattern, skipping', { patternId });
                continue;
            }
            // Load the PDF file
            let pdfBytes;
            if (pdfFile.file_path.startsWith('http')) {
                // Remote file
                const response = await axios_1.default.get(pdfFile.file_path, {
                    responseType: 'arraybuffer',
                });
                pdfBytes = new Uint8Array(response.data);
            }
            else {
                // Local file
                const uploadDir = process.env.UPLOAD_DIR || path_1.default.join(__dirname, '../../uploads');
                const filePath = path_1.default.join(uploadDir, pdfFile.file_path);
                pdfBytes = new Uint8Array(fs_1.default.readFileSync(filePath));
            }
            const pdf = await pdf_lib_1.PDFDocument.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
            // Add divider page if requested (except after the last pattern)
            if (addDividers && i < patternIds.length - 1) {
                const dividerPage = mergedPdf.addPage([612, 792]); // Standard letter size
                const pattern = patterns.find((p) => p.id === patternId);
                const text = `${dividerText}: ${pattern?.name || 'Unknown'}`;
                dividerPage.drawText(text, {
                    x: 50,
                    y: 400,
                    size: 24,
                    color: (0, pdf_lib_1.rgb)(0, 0, 0),
                });
            }
        }
        // Save the merged PDF
        const pdfBytes = await mergedPdf.save();
        const uploadDir = process.env.UPLOAD_DIR || path_1.default.join(__dirname, '../../uploads');
        const collatedDir = path_1.default.join(uploadDir, 'collated');
        // Create collated directory if it doesn't exist
        if (!fs_1.default.existsSync(collatedDir)) {
            fs_1.default.mkdirSync(collatedDir, { recursive: true });
        }
        const timestamp = Date.now();
        const filename = `collated-${timestamp}.pdf`;
        const filePath = path_1.default.join(collatedDir, filename);
        fs_1.default.writeFileSync(filePath, pdfBytes);
        // Store collation record in database
        const [collation] = await (0, database_1.default)('pattern_collations')
            .insert({
            user_id: userId,
            pattern_ids: JSON.stringify(patternIds),
            file_path: `collated/${filename}`,
            file_size: pdfBytes.byteLength,
            page_count: mergedPdf.getPageCount(),
            created_at: new Date(),
        })
            .returning('*');
        await (0, auditLog_1.createAuditLog)(req, {
            userId,
            action: 'patterns_collated',
            entityType: 'pattern_collation',
            entityId: collation.id,
            newValues: collation,
        });
        res.status(201).json({
            success: true,
            message: 'Patterns collated successfully',
            data: {
                collation: {
                    id: collation.id,
                    fileUrl: `/uploads/collated/${filename}`,
                    pageCount: mergedPdf.getPageCount(),
                    fileSize: pdfBytes.byteLength,
                    patternCount: patternIds.length,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error('Error collating PDFs', { error: error.message, stack: error.stack });
        throw new Error('Failed to collate PDF files');
    }
}
