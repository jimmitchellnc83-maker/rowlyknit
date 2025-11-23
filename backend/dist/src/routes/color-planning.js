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
const colorPlanningController = __importStar(require("../controllers/colorPlanningController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// Configure multer for image uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP'));
        }
    },
});
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * Color Planning Routes
 */
/**
 * @route   POST /api/projects/:projectId/gradient-designer
 * @desc    Generate gradient color sequence
 * @access  Private
 */
router.post('/projects/:projectId/gradient-designer', [
    (0, validator_1.validateUUID)('projectId'),
    (0, express_validator_1.body)('total_rows').isInt({ min: 1, max: 10000 }),
    (0, express_validator_1.body)('colors').isArray({ min: 1, max: 10 }),
    (0, express_validator_1.body)('colors.*.name').optional().isString(),
    (0, express_validator_1.body)('colors.*.hex').isString().matches(/^#[0-9A-Fa-f]{6}$/),
    (0, express_validator_1.body)('transition_style').isIn(['linear', 'smooth', 'striped']),
    (0, express_validator_1.body)('stripe_width').optional().isInt({ min: 1, max: 100 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(colorPlanningController.designGradient));
/**
 * @route   POST /api/projects/:projectId/color-transitions
 * @desc    Save color transition plan
 * @access  Private
 */
router.post('/projects/:projectId/color-transitions', [
    (0, validator_1.validateUUID)('projectId'),
    (0, express_validator_1.body)('name').optional().isString().isLength({ max: 100 }),
    (0, express_validator_1.body)('transition_type').optional().isIn(['gradient', 'stripe', 'fair_isle', 'intarsia']),
    (0, express_validator_1.body)('color_sequence').isArray(),
    (0, express_validator_1.body)('total_rows').optional().isInt({ min: 1 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(colorPlanningController.saveColorTransition));
/**
 * @route   GET /api/projects/:projectId/color-transitions
 * @desc    Get color transitions for project
 * @access  Private
 */
router.get('/projects/:projectId/color-transitions', (0, validator_1.validateUUID)('projectId'), (0, errorHandler_1.asyncHandler)(colorPlanningController.getColorTransitions));
/**
 * @route   POST /api/projects/:projectId/extract-colors-from-image
 * @desc    Extract color palette from uploaded image
 * @access  Private
 */
router.post('/projects/:projectId/extract-colors-from-image', upload.single('image'), [
    (0, express_validator_1.body)('num_colors').optional().isInt({ min: 2, max: 10 }),
    (0, express_validator_1.body)('save_palette').optional().isBoolean(),
    (0, express_validator_1.body)('palette_name').optional().isString().isLength({ max: 100 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(colorPlanningController.extractColors));
/**
 * @route   GET /api/projects/:projectId/color-requirements
 * @desc    Calculate yarn requirements per color
 * @access  Private
 */
router.get('/projects/:projectId/color-requirements', (0, validator_1.validateUUID)('projectId'), (0, errorHandler_1.asyncHandler)(colorPlanningController.getColorRequirements));
/**
 * @route   POST /api/projects/:projectId/colors
 * @desc    Add color to project
 * @access  Private
 */
router.post('/projects/:projectId/colors', [
    (0, validator_1.validateUUID)('projectId'),
    (0, express_validator_1.body)('color_name').isString().isLength({ min: 1, max: 100 }),
    (0, express_validator_1.body)('hex_code').isString().matches(/^#[0-9A-Fa-f]{6}$/),
    (0, express_validator_1.body)('yarn_id').optional().isUUID(),
    (0, express_validator_1.body)('estimated_yardage').optional().isNumeric(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(colorPlanningController.addProjectColor));
/**
 * @route   GET /api/projects/:projectId/colors
 * @desc    Get project colors
 * @access  Private
 */
router.get('/projects/:projectId/colors', (0, validator_1.validateUUID)('projectId'), (0, errorHandler_1.asyncHandler)(colorPlanningController.getProjectColors));
/**
 * @route   POST /api/color-palette/generate
 * @desc    Generate harmonious color palette
 * @access  Private
 */
router.post('/color-palette/generate', [
    (0, express_validator_1.body)('base_color').isString().matches(/^#[0-9A-Fa-f]{6}$/),
    (0, express_validator_1.body)('scheme').isIn(['analogous', 'complementary', 'triadic', 'monochromatic', 'split_complementary']),
    (0, express_validator_1.body)('save').optional().isBoolean(),
    (0, express_validator_1.body)('name').optional().isString().isLength({ max: 100 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(colorPlanningController.generatePalette));
/**
 * @route   GET /api/color-palettes
 * @desc    Get user's saved palettes
 * @access  Private
 */
router.get('/color-palettes', [(0, express_validator_1.query)('project_id').optional().isUUID()], validator_1.validate, (0, errorHandler_1.asyncHandler)(colorPlanningController.getSavedPalettes));
exports.default = router;
