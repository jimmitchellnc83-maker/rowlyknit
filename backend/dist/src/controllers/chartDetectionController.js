"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDetection = exports.getDetectionHistory = exports.getSymbols = exports.saveDetectedChart = exports.applyDetectionCorrections = exports.getDetectionResult = exports.detectFromImage = void 0;
const database_1 = __importDefault(require("../config/database"));
const chartDetectionService_1 = require("../services/chartDetectionService");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const uuid_1 = require("uuid");
// Upload directory for chart images
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/charts';
/**
 * Detect chart from uploaded image
 * POST /api/charts/detect-from-image
 */
const detectFromImage = async (req, res) => {
    try {
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Check for file upload
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        const imageBuffer = req.file.buffer;
        const originalFilename = req.file.originalname;
        const { project_id } = req.body;
        // Create detection record
        const detectionId = (0, uuid_1.v4)();
        // Ensure upload directory exists
        await promises_1.default.mkdir(UPLOAD_DIR, { recursive: true });
        // Save original image
        const imageExt = path_1.default.extname(originalFilename) || '.png';
        const imagePath = path_1.default.join(UPLOAD_DIR, `${detectionId}${imageExt}`);
        await promises_1.default.writeFile(imagePath, imageBuffer);
        const imageUrl = `/uploads/charts/${detectionId}${imageExt}`;
        // Create pending detection record
        await (0, database_1.default)('detected_charts').insert({
            id: detectionId,
            user_id: userId,
            project_id: project_id || null,
            original_image_url: imageUrl,
            status: 'processing',
        });
        try {
            // Run detection
            const detectionResult = await (0, chartDetectionService_1.detectChartFromImage)(imageBuffer);
            // Update record with results
            await (0, database_1.default)('detected_charts')
                .where({ id: detectionId })
                .update({
                grid: JSON.stringify(detectionResult.grid),
                grid_rows: detectionResult.grid_dimensions.rows,
                grid_cols: detectionResult.grid_dimensions.cols,
                confidence: detectionResult.confidence,
                unrecognized_cells: JSON.stringify(detectionResult.unrecognized_symbols),
                status: 'completed',
                updated_at: database_1.default.fn.now(),
            });
            return res.status(200).json({
                detection_id: detectionId,
                detected_chart: detectionResult,
                original_image_url: imageUrl,
                status: 'completed',
            });
        }
        catch (detectionError) {
            // Update record with error
            await (0, database_1.default)('detected_charts')
                .where({ id: detectionId })
                .update({
                status: 'failed',
                error_message: detectionError instanceof Error ? detectionError.message : 'Detection failed',
                updated_at: database_1.default.fn.now(),
            });
            return res.status(422).json({
                detection_id: detectionId,
                error: detectionError instanceof Error ? detectionError.message : 'Detection failed',
                original_image_url: imageUrl,
                status: 'failed',
            });
        }
    }
    catch (error) {
        console.error('Error in chart detection:', error);
        return res.status(500).json({ error: 'Failed to process image' });
    }
};
exports.detectFromImage = detectFromImage;
/**
 * Get detection result
 * GET /api/charts/detection/:detectionId
 */
const getDetectionResult = async (req, res) => {
    try {
        const { detectionId } = req.params;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const detection = await (0, database_1.default)('detected_charts')
            .where({ id: detectionId, user_id: userId })
            .first();
        if (!detection) {
            return res.status(404).json({ error: 'Detection not found' });
        }
        return res.json({
            id: detection.id,
            project_id: detection.project_id,
            name: detection.name,
            original_image_url: detection.original_image_url,
            grid: detection.grid,
            grid_dimensions: {
                rows: detection.grid_rows,
                cols: detection.grid_cols,
            },
            confidence: detection.confidence,
            unrecognized_cells: detection.unrecognized_cells,
            corrections: detection.corrections,
            status: detection.status,
            error_message: detection.error_message,
            created_at: detection.created_at,
        });
    }
    catch (error) {
        console.error('Error getting detection:', error);
        return res.status(500).json({ error: 'Failed to get detection' });
    }
};
exports.getDetectionResult = getDetectionResult;
/**
 * Apply corrections to detected chart
 * POST /api/charts/detection/:detectionId/correct
 */
const applyDetectionCorrections = async (req, res) => {
    try {
        const { detectionId } = req.params;
        const { corrections } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const detection = await (0, database_1.default)('detected_charts')
            .where({ id: detectionId, user_id: userId })
            .first();
        if (!detection) {
            return res.status(404).json({ error: 'Detection not found' });
        }
        if (!Array.isArray(corrections)) {
            return res.status(400).json({ error: 'Corrections must be an array' });
        }
        // Apply corrections to grid
        const currentGrid = typeof detection.grid === 'string'
            ? JSON.parse(detection.grid)
            : detection.grid;
        const correctedGrid = (0, chartDetectionService_1.applyCorrections)(currentGrid, corrections);
        // Merge with existing corrections
        const existingCorrections = typeof detection.corrections === 'string'
            ? JSON.parse(detection.corrections)
            : detection.corrections || [];
        const allCorrections = [...existingCorrections, ...corrections];
        // Update database
        await (0, database_1.default)('detected_charts')
            .where({ id: detectionId })
            .update({
            grid: JSON.stringify(correctedGrid),
            corrections: JSON.stringify(allCorrections),
            updated_at: database_1.default.fn.now(),
        });
        // Recalculate unrecognized cells
        const unrecognized = detection.unrecognized_cells
            ? (typeof detection.unrecognized_cells === 'string'
                ? JSON.parse(detection.unrecognized_cells)
                : detection.unrecognized_cells)
            : [];
        // Remove corrected cells from unrecognized list
        const remainingUnrecognized = unrecognized.filter((cell) => !corrections.some((c) => c.row === cell.row && c.col === cell.col));
        await (0, database_1.default)('detected_charts')
            .where({ id: detectionId })
            .update({
            unrecognized_cells: JSON.stringify(remainingUnrecognized),
        });
        return res.json({
            id: detectionId,
            grid: correctedGrid,
            corrections_applied: corrections.length,
            remaining_unrecognized: remainingUnrecognized.length,
        });
    }
    catch (error) {
        console.error('Error applying corrections:', error);
        return res.status(500).json({ error: 'Failed to apply corrections' });
    }
};
exports.applyDetectionCorrections = applyDetectionCorrections;
/**
 * Save detected chart to project
 * POST /api/charts/save-detected
 */
const saveDetectedChart = async (req, res) => {
    try {
        const { detection_id, project_id, chart_name } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get detection
        const detection = await (0, database_1.default)('detected_charts')
            .where({ id: detection_id, user_id: userId })
            .first();
        if (!detection) {
            return res.status(404).json({ error: 'Detection not found' });
        }
        // Verify project ownership if provided
        if (project_id) {
            const project = await (0, database_1.default)('projects')
                .where({ id: project_id, user_id: userId })
                .first();
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
        }
        // Create chart from detection
        const grid = typeof detection.grid === 'string'
            ? JSON.parse(detection.grid)
            : detection.grid;
        // Insert into charts table
        const [chart] = await (0, database_1.default)('charts')
            .insert({
            project_id: project_id || null,
            user_id: userId,
            name: chart_name || detection.name || 'Imported Chart',
            grid: JSON.stringify(grid),
            rows: detection.grid_rows,
            columns: detection.grid_cols,
            source: 'image_import',
            source_image_url: detection.original_image_url,
        })
            .returning('*');
        // Update detection record
        await (0, database_1.default)('detected_charts')
            .where({ id: detection_id })
            .update({
            project_id: project_id || detection.project_id,
            name: chart_name || detection.name,
            updated_at: database_1.default.fn.now(),
        });
        return res.status(201).json({
            chart,
            detection_id,
            message: 'Chart saved successfully',
        });
    }
    catch (error) {
        console.error('Error saving chart:', error);
        return res.status(500).json({ error: 'Failed to save chart' });
    }
};
exports.saveDetectedChart = saveDetectedChart;
/**
 * Get symbol library
 * GET /api/charts/symbols
 */
const getSymbols = async (req, res) => {
    try {
        const userId = req.user.userId;
        const symbols = await (0, chartDetectionService_1.getSymbolLibrary)(userId);
        return res.json({ symbols });
    }
    catch (error) {
        console.error('Error getting symbols:', error);
        return res.status(500).json({ error: 'Failed to get symbols' });
    }
};
exports.getSymbols = getSymbols;
/**
 * Get user's detected charts history
 * GET /api/charts/detections
 */
const getDetectionHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status, project_id, limit = 20, offset = 0 } = req.query;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        let query = (0, database_1.default)('detected_charts')
            .where({ user_id: userId })
            .orderBy('created_at', 'desc')
            .limit(Number(limit))
            .offset(Number(offset));
        if (status) {
            query = query.where({ status });
        }
        if (project_id) {
            query = query.where({ project_id });
        }
        const detections = await query;
        const total = await (0, database_1.default)('detected_charts')
            .where({ user_id: userId })
            .count('* as count')
            .first();
        return res.json({
            detections,
            total: total?.count || 0,
            limit: Number(limit),
            offset: Number(offset),
        });
    }
    catch (error) {
        console.error('Error getting detection history:', error);
        return res.status(500).json({ error: 'Failed to get history' });
    }
};
exports.getDetectionHistory = getDetectionHistory;
/**
 * Delete a detection
 * DELETE /api/charts/detection/:detectionId
 */
const deleteDetection = async (req, res) => {
    try {
        const { detectionId } = req.params;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const detection = await (0, database_1.default)('detected_charts')
            .where({ id: detectionId, user_id: userId })
            .first();
        if (!detection) {
            return res.status(404).json({ error: 'Detection not found' });
        }
        // Delete image file if exists
        if (detection.original_image_url) {
            const imagePath = path_1.default.join(process.cwd(), detection.original_image_url.replace(/^\//, ''));
            try {
                await promises_1.default.unlink(imagePath);
            }
            catch (e) {
                // Ignore file not found errors
            }
        }
        await (0, database_1.default)('detected_charts').where({ id: detectionId }).delete();
        return res.json({ message: 'Detection deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting detection:', error);
        return res.status(500).json({ error: 'Failed to delete detection' });
    }
};
exports.deleteDetection = deleteDetection;
exports.default = {
    detectFromImage: exports.detectFromImage,
    getDetectionResult: exports.getDetectionResult,
    applyDetectionCorrections: exports.applyDetectionCorrections,
    saveDetectedChart: exports.saveDetectedChart,
    getSymbols: exports.getSymbols,
    getDetectionHistory: exports.getDetectionHistory,
    deleteDetection: exports.deleteDetection,
};
