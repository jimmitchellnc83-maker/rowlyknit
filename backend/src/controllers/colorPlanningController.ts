import { Request, Response } from 'express';
import db from '../config/database';
import {
  generateGradientSequence,
  calculateColorYardage,
  extractColorsFromImage,
  generateColorPalette,
  GradientConfig,
} from '../services/colorPlanningService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate gradient sequence
 * POST /api/projects/:projectId/gradient-designer
 */
export const designGradient = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { total_rows, colors, transition_style, stripe_width } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify project ownership
    const project = await db('projects')
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
    const colorsWithIds = colors.map((c: any, idx: number) => ({
      id: c.id || uuidv4(),
      name: c.name || `Color ${idx + 1}`,
      hex: c.hex || '#000000',
    }));

    const config: GradientConfig = {
      total_rows: total_rows || 100,
      colors: colorsWithIds,
      transition_style: transition_style || 'linear',
      stripe_width: stripe_width || 4,
    };

    const sequence = generateGradientSequence(config);

    return res.json({
      color_sequence: sequence,
      total_rows: config.total_rows,
      transition_style: config.transition_style,
    });
  } catch (error) {
    console.error('Error designing gradient:', error);
    return res.status(500).json({ error: 'Failed to design gradient' });
  }
};

/**
 * Save color transition plan
 * POST /api/projects/:projectId/color-transitions
 */
export const saveColorTransition = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, transition_type, color_sequence, transition_settings, total_rows } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [transition] = await db('color_transitions')
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
  } catch (error) {
    console.error('Error saving color transition:', error);
    return res.status(500).json({ error: 'Failed to save color transition' });
  }
};

/**
 * Get color transitions for project
 * GET /api/projects/:projectId/color-transitions
 */
export const getColorTransitions = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const transitions = await db('color_transitions')
      .where({ project_id: projectId })
      .orderBy('created_at', 'desc');

    return res.json({ transitions });
  } catch (error) {
    console.error('Error getting color transitions:', error);
    return res.status(500).json({ error: 'Failed to get color transitions' });
  }
};

/**
 * Extract colors from uploaded image
 * POST /api/projects/:projectId/extract-colors-from-image
 */
export const extractColors = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { num_colors = 6 } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Verify project if provided
    if (projectId && projectId !== 'none') {
      const project = await db('projects')
        .where({ id: projectId, user_id: userId })
        .first();

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const colors = await extractColorsFromImage(
      req.file.buffer,
      Math.min(10, Math.max(2, num_colors))
    );

    // Optionally save the palette
    if (req.body.save_palette) {
      await db('color_palettes').insert({
        user_id: userId,
        project_id: projectId !== 'none' ? projectId : null,
        name: req.body.palette_name || 'Extracted Palette',
        colors: JSON.stringify(colors),
        palette_type: 'extracted',
      });
    }

    return res.json({ colors });
  } catch (error) {
    console.error('Error extracting colors:', error);
    return res.status(500).json({ error: 'Failed to extract colors' });
  }
};

/**
 * Generate color palette
 * POST /api/color-palette/generate
 */
export const generatePalette = async (req: Request, res: Response) => {
  try {
    const { base_color, scheme, save, name } = req.body;
    const userId = req.user?.userId;

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

    const colors = generateColorPalette(base_color, scheme);

    const palette = colors.map((hex, idx) => ({
      hex,
      percentage: Math.round(100 / colors.length),
      name: `Color ${idx + 1}`,
    }));

    // Save palette if requested
    if (save) {
      await db('color_palettes').insert({
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
  } catch (error) {
    console.error('Error generating palette:', error);
    return res.status(500).json({ error: 'Failed to generate palette' });
  }
};

/**
 * Calculate yarn requirements per color
 * GET /api/projects/:projectId/color-requirements
 */
export const getColorRequirements = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get active color transition
    const transition = await db('color_transitions')
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

    const yardageMap = calculateColorYardage(totalYardage, colorSequence);

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
  } catch (error) {
    console.error('Error getting color requirements:', error);
    return res.status(500).json({ error: 'Failed to get color requirements' });
  }
};

/**
 * Add color to project
 * POST /api/projects/:projectId/colors
 */
export const addProjectColor = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { color_name, hex_code, yarn_id, estimated_yardage } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get max sort order
    const maxOrder = await db('project_colors')
      .where({ project_id: projectId })
      .max('sort_order as max')
      .first();

    const [color] = await db('project_colors')
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
  } catch (error) {
    console.error('Error adding project color:', error);
    return res.status(500).json({ error: 'Failed to add color' });
  }
};

/**
 * Get project colors
 * GET /api/projects/:projectId/colors
 */
export const getProjectColors = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const colors = await db('project_colors')
      .where({ project_id: projectId })
      .leftJoin('yarn', 'project_colors.yarn_id', 'yarn.id')
      .select(
        'project_colors.*',
        'yarn.name as yarn_name',
        'yarn.brand as yarn_brand',
        'yarn.color_name as yarn_color'
      )
      .orderBy('sort_order', 'asc');

    return res.json({ colors });
  } catch (error) {
    console.error('Error getting project colors:', error);
    return res.status(500).json({ error: 'Failed to get colors' });
  }
};

/**
 * Get user's saved palettes
 * GET /api/color-palettes
 */
export const getSavedPalettes = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { project_id } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let query = db('color_palettes').where({ user_id: userId });

    if (project_id) {
      query = query.where({ project_id });
    }

    const palettes = await query.orderBy('created_at', 'desc');

    return res.json({ palettes });
  } catch (error) {
    console.error('Error getting palettes:', error);
    return res.status(500).json({ error: 'Failed to get palettes' });
  }
};

export default {
  designGradient,
  saveColorTransition,
  getColorTransitions,
  extractColors,
  generatePalette,
  getColorRequirements,
  addProjectColor,
  getProjectColors,
  getSavedPalettes,
};
