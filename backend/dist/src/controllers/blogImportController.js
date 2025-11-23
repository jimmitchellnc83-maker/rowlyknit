"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFromUrl = extractFromUrl;
exports.saveImportedPattern = saveImportedPattern;
exports.getImportHistory = getImportHistory;
exports.getImport = getImport;
const blogExtractorService_1 = __importDefault(require("../services/blogExtractorService"));
const logger_1 = __importDefault(require("../config/logger"));
/**
 * Extract pattern content from a blog URL
 * POST /api/patterns/import-from-url
 */
async function extractFromUrl(req, res) {
    const userId = req.user.userId;
    const { url } = req.body;
    try {
        // Extract content from URL
        const result = await blogExtractorService_1.default.extractFromUrl(userId, url);
        if (!result.success) {
            res.status(400).json({
                error: 'Failed to extract content',
                message: result.error,
                importId: result.importId,
            });
            return;
        }
        // Parse the extracted content to identify pattern sections
        const parsedData = blogExtractorService_1.default.parsePatternContent(result.extracted.textContent);
        res.status(200).json({
            success: true,
            importId: result.importId,
            sourceUrl: result.sourceUrl,
            extracted: {
                title: result.extracted.title,
                excerpt: result.extracted.excerpt,
                byline: result.extracted.byline,
                siteName: result.extracted.siteName,
                content: result.extracted.content,
                textContent: result.extracted.textContent,
            },
            parsed: parsedData,
            metadata: result.metadata,
        });
    }
    catch (error) {
        logger_1.default.error('Error in extractFromUrl controller', {
            userId,
            url,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process the URL',
        });
    }
}
/**
 * Save an imported pattern from extracted content
 * POST /api/patterns/save-imported
 */
async function saveImportedPattern(req, res) {
    const userId = req.user.userId;
    const { importId, patternData, sourceUrl } = req.body;
    try {
        // Verify the import belongs to this user
        const importRecord = await blogExtractorService_1.default.getImport(importId, userId);
        if (!importRecord) {
            res.status(404).json({
                error: 'Import not found',
                message: 'The specified import record was not found or does not belong to you',
            });
            return;
        }
        // Check if already saved
        if (importRecord.status === 'saved' && importRecord.pattern_id) {
            res.status(400).json({
                error: 'Already saved',
                message: 'This import has already been saved as a pattern',
                patternId: importRecord.pattern_id,
            });
            return;
        }
        // Save the pattern
        const patternId = await blogExtractorService_1.default.savePattern(userId, importId, patternData, sourceUrl || importRecord.source_url);
        res.status(201).json({
            success: true,
            patternId,
            message: 'Pattern imported successfully',
        });
    }
    catch (error) {
        logger_1.default.error('Error in saveImportedPattern controller', {
            userId,
            importId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to save the imported pattern',
        });
    }
}
/**
 * Get import history for the user
 * GET /api/patterns/imports
 */
async function getImportHistory(req, res) {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit, 10) || 20;
    try {
        const imports = await blogExtractorService_1.default.getImportHistory(userId, limit);
        res.status(200).json({
            success: true,
            imports,
            count: imports.length,
        });
    }
    catch (error) {
        logger_1.default.error('Error in getImportHistory controller', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch import history',
        });
    }
}
/**
 * Get a specific import record
 * GET /api/patterns/imports/:importId
 */
async function getImport(req, res) {
    const userId = req.user.userId;
    const { importId } = req.params;
    try {
        const importRecord = await blogExtractorService_1.default.getImport(importId, userId);
        if (!importRecord) {
            res.status(404).json({
                error: 'Import not found',
                message: 'The specified import record was not found',
            });
            return;
        }
        res.status(200).json({
            success: true,
            import: importRecord,
        });
    }
    catch (error) {
        logger_1.default.error('Error in getImport controller', {
            userId,
            importId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch import record',
        });
    }
}
