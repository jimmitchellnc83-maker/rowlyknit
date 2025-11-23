"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const multer_1 = __importDefault(require("multer"));
const chartDetectionController = __importStar(require("../controllers/chartDetectionController"));
const chartSharingController = __importStar(require("../controllers/chartSharingController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// Configure multer for image uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF'));
        }
    },
});
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * Chart Detection Routes
 */
/**
 * @route   POST /api/charts/detect-from-image
 * @desc    Detect chart from uploaded image
 * @access  Private
 */
router.post('/detect-from-image', upload.single('image'), [(0, express_validator_1.body)('project_id').optional().isUUID()], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartDetectionController.detectFromImage));
/**
 * @route   GET /api/charts/detection/:detectionId
 * @desc    Get detection result
 * @access  Private
 */
router.get('/detection/:detectionId', (0, validator_1.validateUUID)('detectionId'), (0, errorHandler_1.asyncHandler)(chartDetectionController.getDetectionResult));
/**
 * @route   POST /api/charts/detection/:detectionId/correct
 * @desc    Apply corrections to detected chart
 * @access  Private
 */
router.post('/detection/:detectionId/correct', [
    (0, validator_1.validateUUID)('detectionId'),
    (0, express_validator_1.body)('corrections').isArray().withMessage('Corrections must be an array'),
    (0, express_validator_1.body)('corrections.*.row').isInt({ min: 0 }).withMessage('Row must be non-negative integer'),
    (0, express_validator_1.body)('corrections.*.col').isInt({ min: 0 }).withMessage('Column must be non-negative integer'),
    (0, express_validator_1.body)('corrections.*.corrected').isString().withMessage('Corrected symbol is required'),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartDetectionController.applyDetectionCorrections));
/**
 * @route   POST /api/charts/save-detected
 * @desc    Save detected chart to project
 * @access  Private
 */
router.post('/save-detected', [
    (0, express_validator_1.body)('detection_id').isUUID().withMessage('Detection ID is required'),
    (0, express_validator_1.body)('project_id').optional().isUUID(),
    (0, express_validator_1.body)('chart_name').optional().isString().isLength({ max: 255 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartDetectionController.saveDetectedChart));
/**
 * @route   GET /api/charts/symbols
 * @desc    Get symbol library
 * @access  Private
 */
router.get('/symbols', (0, errorHandler_1.asyncHandler)(chartDetectionController.getSymbols));
/**
 * @route   GET /api/charts/detections
 * @desc    Get user's detection history
 * @access  Private
 */
router.get('/detections', [
    (0, express_validator_1.query)('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    (0, express_validator_1.query)('project_id').optional().isUUID(),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('offset').optional().isInt({ min: 0 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartDetectionController.getDetectionHistory));
/**
 * @route   DELETE /api/charts/detection/:detectionId
 * @desc    Delete a detection
 * @access  Private
 */
router.delete('/detection/:detectionId', (0, validator_1.validateUUID)('detectionId'), (0, errorHandler_1.asyncHandler)(chartDetectionController.deleteDetection));
/**
 * Chart Sharing & Export Routes
 */
/**
 * @route   POST /api/charts/:chartId/share
 * @desc    Create shareable link for chart
 * @access  Private
 */
router.post('/:chartId/share', [
    (0, validator_1.validateUUID)('chartId'),
    (0, express_validator_1.body)('visibility').optional().isIn(['public', 'private']),
    (0, express_validator_1.body)('allow_copy').optional().isBoolean(),
    (0, express_validator_1.body)('allow_download').optional().isBoolean(),
    (0, express_validator_1.body)('expires_in_days').optional().isInt({ min: 1, max: 365 }),
    (0, express_validator_1.body)('password').optional().isString().isLength({ min: 4, max: 50 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartSharingController.shareChart));
/**
 * @route   POST /api/charts/:chartId/export
 * @desc    Export chart to specified format
 * @access  Private
 */
router.post('/:chartId/export', [
    (0, validator_1.validateUUID)('chartId'),
    (0, express_validator_1.body)('format').isIn(['pdf', 'png', 'csv', 'ravelry', 'markdown']),
    (0, express_validator_1.body)('options').optional().isObject(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartSharingController.exportChartHandler));
/**
 * @route   GET /api/shares
 * @desc    Get user's shared items
 * @access  Private
 */
router.get('/shares', (0, errorHandler_1.asyncHandler)(chartSharingController.getMySharedItems));
/**
 * @route   GET /api/shares/stats
 * @desc    Get share statistics
 * @access  Private
 */
router.get('/shares/stats', (0, errorHandler_1.asyncHandler)(chartSharingController.getShareStatistics));
/**
 * @route   DELETE /api/shares/:type/:token
 * @desc    Revoke a share link
 * @access  Private
 */
router.delete('/shares/:type/:token', (0, errorHandler_1.asyncHandler)(chartSharingController.revokeShare));
/**
 * @route   GET /api/exports/history
 * @desc    Get export history
 * @access  Private
 */
router.get('/exports/history', (0, errorHandler_1.asyncHandler)(chartSharingController.getExportHistory));
exports.default = router;
