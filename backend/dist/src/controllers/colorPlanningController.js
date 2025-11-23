"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSavedPalettes = exports.getProjectColors = exports.addProjectColor = exports.getColorRequirements = exports.generatePalette = exports.extractColors = exports.getColorTransitions = exports.saveColorTransition = exports.designGradient = void 0;
const database_1 = __importDefault(require("../config/database"));
const colorPlanningService_1 = require("../services/colorPlanningService");
const uuid_1 = require("uuid");
/**
 * Generate gradient sequence
 * POST /api/projects/:projectId/gradient-designer
 */
const designGradient = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { total_rows, colors, transition_style, stripe_width } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Verify project ownership
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (!colors || colors.length === 0) {
            return res.status(400).json({ error: 'At least one color is required' });
        }
        if (colors.length > 10) {
            return res.status(400).json({ error: 'Maximum 10 colors allowed' });
        }
        // Ensure colors have IDs
        const colorsWithIds = colors.map((c, idx) => ({
            id: c.id || (0, uuid_1.v4)(),
            name: c.name || `Color ${idx + 1}`,
            hex: c.hex || '#000000',
        }));
        const config = {
            total_rows: total_rows || 100,
            colors: colorsWithIds,
            transition_style: transition_style || 'linear',
            stripe_width: stripe_width || 4,
        };
        const sequence = (0, colorPlanningService_1.generateGradientSequence)(config);
        return res.json({
            color_sequence: sequence,
            total_rows: config.total_rows,
            transition_style: config.transition_style,
        });
    }
    catch (error) {
        console.error('Error designing gradient:', error);
        return res.status(500).json({ error: 'Failed to design gradient' });
    }
};
exports.designGradient = designGradient;
/**
 * Save color transition plan
 * POST /api/projects/:projectId/color-transitions
 */
const saveColorTransition = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { name, transition_type, color_sequence, transition_settings, total_rows } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const [transition] = await (0, database_1.default)('color_transitions')
            .insert({
            project_id: projectId,
            name: name || 'Color Plan',
            transition_type: transition_type || 'gradient',
            color_sequence: JSON.stringify(color_sequence || []),
            transition_settings: JSON.stringify(transition_settings || {}),
            total_rows: total_rows || null,
        })
            .returning('*');
        return res.status(201).json(transition);
    }
    catch (error) {
        console.error('Error saving color transition:', error);
        return res.status(500).json({ error: 'Failed to save color transition' });
    }
};
exports.saveColorTransition = saveColorTransition;
/**
 * Get color transitions for project
 * GET /api/projects/:projectId/color-transitions
 */
const getColorTransitions = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const transitions = await (0, database_1.default)('color_transitions')
            .where({ project_id: projectId })
            .orderBy('created_at', 'desc');
        return res.json({ transitions });
    }
    catch (error) {
        console.error('Error getting color transitions:', error);
        return res.status(500).json({ error: 'Failed to get color transitions' });
    }
};
exports.getColorTransitions = getColorTransitions;
/**
 * Extract colors from uploaded image
 * POST /api/projects/:projectId/extract-colors-from-image
 */
const extractColors = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { num_colors = 6 } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        // Verify project if provided
        if (projectId && projectId !== 'none') {
            const project = await (0, database_1.default)('projects')
                .where({ id: projectId, user_id: userId })
                .first();
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
        }
        const colors = await (0, colorPlanningService_1.extractColorsFromImage)(req.file.buffer, Math.min(10, Math.max(2, num_colors)));
        // Optionally save the palette
        if (req.body.save_palette) {
            await (0, database_1.default)('color_palettes').insert({
                user_id: userId,
                project_id: projectId !== 'none' ? projectId : null,
                name: req.body.palette_name || 'Extracted Palette',
                colors: JSON.stringify(colors),
                palette_type: 'extracted',
            });
        }
        return res.json({ colors });
    }
    catch (error) {
        console.error('Error extracting colors:', error);
        return res.status(500).json({ error: 'Failed to extract colors' });
    }
};
exports.extractColors = extractColors;
/**
 * Generate color palette
 * POST /api/color-palette/generate
 */
const generatePalette = async (req, res) => {
    try {
        const { base_color, scheme, save, name } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!base_color || !scheme) {
            return res.status(400).json({ error: 'Base color and scheme are required' });
        }
        const validSchemes = ['analogous', 'complementary', 'triadic', 'monochromatic', 'split_complementary'];
        if (!validSchemes.includes(scheme)) {
            return res.status(400).json({ error: `Invalid scheme. Must be one of: ${validSchemes.join(', ')}` });
        }
        const colors = (0, colorPlanningService_1.generateColorPalette)(base_color, scheme);
        const palette = colors.map((hex, idx) => ({
            hex,
            percentage: Math.round(100 / colors.length),
            name: `Color ${idx + 1}`,
        }));
        // Save palette if requested
        if (save) {
            await (0, database_1.default)('color_palettes').insert({
                user_id: userId,
                name: name || `${scheme} palette`,
                colors: JSON.stringify(palette),
                palette_type: 'generated',
                base_scheme: scheme,
            });
        }
        return res.json({
            base_color,
            scheme,
            colors: palette,
        });
    }
    catch (error) {
        console.error('Error generating palette:', error);
        return res.status(500).json({ error: 'Failed to generate palette' });
    }
};
exports.generatePalette = generatePalette;
/**
 * Calculate yarn requirements per color
 * GET /api/projects/:projectId/color-requirements
 */
const getColorRequirements = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        // Get active color transition
        const transition = await (0, database_1.default)('color_transitions')
            .where({ project_id: projectId, is_active: true })
            .first();
        if (!transition) {
            return res.json({
                colors: [],
                message: 'No color plan found for this project',
            });
        }
        // Get total yardage estimate from project
        const totalYardage = project.estimated_yardage || 1000; // Default
        const colorSequence = typeof transition.color_sequence === 'string'
            ? JSON.parse(transition.color_sequence)
            : transition.color_sequence;
        const yardageMap = (0, colorPlanningService_1.calculateColorYardage)(totalYardage, colorSequence);
        const colors = Array.from(yardageMap.entries()).map(([id, data]) => ({
            color_id: id,
            color_name: data.color_name,
            hex_code: data.hex_code,
            estimated_yardage: Math.round(data.yardage),
            percentage: Math.round(data.percentage),
        }));
        return res.json({
            total_yardage: totalYardage,
            colors,
        });
    }
    catch (error) {
        console.error('Error getting color requirements:', error);
        return res.status(500).json({ error: 'Failed to get color requirements' });
    }
};
exports.getColorRequirements = getColorRequirements;
/**
 * Add color to project
 * POST /api/projects/:projectId/colors
 */
const addProjectColor = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { color_name, hex_code, yarn_id, estimated_yardage } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        // Get max sort order
        const maxOrder = await (0, database_1.default)('project_colors')
            .where({ project_id: projectId })
            .max('sort_order as max')
            .first();
        const [color] = await (0, database_1.default)('project_colors')
            .insert({
            project_id: projectId,
            color_name: color_name || 'New Color',
            hex_code: hex_code || '#000000',
            yarn_id: yarn_id || null,
            estimated_yardage: estimated_yardage || null,
            sort_order: (maxOrder?.max || 0) + 1,
        })
            .returning('*');
        return res.status(201).json(color);
    }
    catch (error) {
        console.error('Error adding project color:', error);
        return res.status(500).json({ error: 'Failed to add color' });
    }
};
exports.addProjectColor = addProjectColor;
/**
 * Get project colors
 * GET /api/projects/:projectId/colors
 */
const getProjectColors = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const colors = await (0, database_1.default)('project_colors')
            .where({ project_id: projectId })
            .leftJoin('yarn_stash', 'project_colors.yarn_id', 'yarn_stash.id')
            .select('project_colors.*', 'yarn_stash.name as yarn_name', 'yarn_stash.brand as yarn_brand', 'yarn_stash.color_name as yarn_color')
            .orderBy('sort_order', 'asc');
        return res.json({ colors });
    }
    catch (error) {
        console.error('Error getting project colors:', error);
        return res.status(500).json({ error: 'Failed to get colors' });
    }
};
exports.getProjectColors = getProjectColors;
/**
 * Get user's saved palettes
 * GET /api/color-palettes
 */
const getSavedPalettes = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { project_id } = req.query;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        let query = (0, database_1.default)('color_palettes').where({ user_id: userId });
        if (project_id) {
            query = query.where({ project_id });
        }
        const palettes = await query.orderBy('created_at', 'desc');
        return res.json({ palettes });
    }
    catch (error) {
        console.error('Error getting palettes:', error);
        return res.status(500).json({ error: 'Failed to get palettes' });
    }
};
exports.getSavedPalettes = getSavedPalettes;
exports.default = {
    designGradient: exports.designGradient,
    saveColorTransition: exports.saveColorTransition,
    getColorTransitions: exports.getColorTransitions,
    extractColors: exports.extractColors,
    generatePalette: exports.generatePalette,
    getColorRequirements: exports.getColorRequirements,
    addProjectColor: exports.addProjectColor,
    getProjectColors: exports.getProjectColors,
    getSavedPalettes: exports.getSavedPalettes,
};
