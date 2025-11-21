import { Request, Response } from 'express';
import db from '../config/database';
import {
  detectChartFromImage,
  applyCorrections,
  getSymbolLibrary,
} from '../services/chartDetectionService';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// Upload directory for chart images
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/charts';

/**
 * Detect chart from uploaded image
 * POST /api/charts/detect-from-image
 */
export const detectFromImage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

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
    const detectionId = uuidv4();

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Save original image
    const imageExt = path.extname(originalFilename) || '.png';
    const imagePath = path.join(UPLOAD_DIR, `${detectionId}${imageExt}`);
    await fs.writeFile(imagePath, imageBuffer);

    const imageUrl = `/uploads/charts/${detectionId}${imageExt}`;

    // Create pending detection record
    await db('detected_charts').insert({
      id: detectionId,
      user_id: userId,
      project_id: project_id || null,
      original_image_url: imageUrl,
      status: 'processing',
    });

    try {
      // Run detection
      const detectionResult = await detectChartFromImage(imageBuffer);

      // Update record with results
      await db('detected_charts')
        .where({ id: detectionId })
        .update({
          grid: JSON.stringify(detectionResult.grid),
          grid_rows: detectionResult.grid_dimensions.rows,
          grid_cols: detectionResult.grid_dimensions.cols,
          confidence: detectionResult.confidence,
          unrecognized_cells: JSON.stringify(detectionResult.unrecognized_symbols),
          status: 'completed',
          updated_at: db.fn.now(),
        });

      return res.status(200).json({
        detection_id: detectionId,
        detected_chart: detectionResult,
        original_image_url: imageUrl,
        status: 'completed',
      });
    } catch (detectionError) {
      // Update record with error
      await db('detected_charts')
        .where({ id: detectionId })
        .update({
          status: 'failed',
          error_message: detectionError instanceof Error ? detectionError.message : 'Detection failed',
          updated_at: db.fn.now(),
        });

      return res.status(422).json({
        detection_id: detectionId,
        error: detectionError instanceof Error ? detectionError.message : 'Detection failed',
        original_image_url: imageUrl,
        status: 'failed',
      });
    }
  } catch (error) {
    console.error('Error in chart detection:', error);
    return res.status(500).json({ error: 'Failed to process image' });
  }
};

/**
 * Get detection result
 * GET /api/charts/detection/:detectionId
 */
export const getDetectionResult = async (req: Request, res: Response) => {
  try {
    const { detectionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const detection = await db('detected_charts')
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
  } catch (error) {
    console.error('Error getting detection:', error);
    return res.status(500).json({ error: 'Failed to get detection' });
  }
};

/**
 * Apply corrections to detected chart
 * POST /api/charts/detection/:detectionId/correct
 */
export const applyDetectionCorrections = async (req: Request, res: Response) => {
  try {
    const { detectionId } = req.params;
    const { corrections } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const detection = await db('detected_charts')
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

    const correctedGrid = applyCorrections(currentGrid, corrections);

    // Merge with existing corrections
    const existingCorrections = typeof detection.corrections === 'string'
      ? JSON.parse(detection.corrections)
      : detection.corrections || [];

    const allCorrections = [...existingCorrections, ...corrections];

    // Update database
    await db('detected_charts')
      .where({ id: detectionId })
      .update({
        grid: JSON.stringify(correctedGrid),
        corrections: JSON.stringify(allCorrections),
        updated_at: db.fn.now(),
      });

    // Recalculate unrecognized cells
    const unrecognized = detection.unrecognized_cells
      ? (typeof detection.unrecognized_cells === 'string'
          ? JSON.parse(detection.unrecognized_cells)
          : detection.unrecognized_cells)
      : [];

    // Remove corrected cells from unrecognized list
    const remainingUnrecognized = unrecognized.filter(
      (cell: { row: number; col: number }) =>
        !corrections.some(
          (c: { row: number; col: number }) => c.row === cell.row && c.col === cell.col
        )
    );

    await db('detected_charts')
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
  } catch (error) {
    console.error('Error applying corrections:', error);
    return res.status(500).json({ error: 'Failed to apply corrections' });
  }
};

/**
 * Save detected chart to project
 * POST /api/charts/save-detected
 */
export const saveDetectedChart = async (req: Request, res: Response) => {
  try {
    const { detection_id, project_id, chart_name } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get detection
    const detection = await db('detected_charts')
      .where({ id: detection_id, user_id: userId })
      .first();

    if (!detection) {
      return res.status(404).json({ error: 'Detection not found' });
    }

    // Verify project ownership if provided
    if (project_id) {
      const project = await db('projects')
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
    const [chart] = await db('charts')
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
    await db('detected_charts')
      .where({ id: detection_id })
      .update({
        project_id: project_id || detection.project_id,
        name: chart_name || detection.name,
        updated_at: db.fn.now(),
      });

    return res.status(201).json({
      chart,
      detection_id,
      message: 'Chart saved successfully',
    });
  } catch (error) {
    console.error('Error saving chart:', error);
    return res.status(500).json({ error: 'Failed to save chart' });
  }
};

/**
 * Get symbol library
 * GET /api/charts/symbols
 */
export const getSymbols = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const symbols = await getSymbolLibrary(userId);

    return res.json({ symbols });
  } catch (error) {
    console.error('Error getting symbols:', error);
    return res.status(500).json({ error: 'Failed to get symbols' });
  }
};

/**
 * Get user's detected charts history
 * GET /api/charts/detections
 */
export const getDetectionHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status, project_id, limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let query = db('detected_charts')
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

    const total = await db('detected_charts')
      .where({ user_id: userId })
      .count('* as count')
      .first();

    return res.json({
      detections,
      total: total?.count || 0,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error('Error getting detection history:', error);
    return res.status(500).json({ error: 'Failed to get history' });
  }
};

/**
 * Delete a detection
 * DELETE /api/charts/detection/:detectionId
 */
export const deleteDetection = async (req: Request, res: Response) => {
  try {
    const { detectionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const detection = await db('detected_charts')
      .where({ id: detectionId, user_id: userId })
      .first();

    if (!detection) {
      return res.status(404).json({ error: 'Detection not found' });
    }

    // Delete image file if exists
    if (detection.original_image_url) {
      const imagePath = path.join(
        process.cwd(),
        detection.original_image_url.replace(/^\//, '')
      );
      try {
        await fs.unlink(imagePath);
      } catch (e) {
        // Ignore file not found errors
      }
    }

    await db('detected_charts').where({ id: detectionId }).delete();

    return res.json({ message: 'Detection deleted successfully' });
  } catch (error) {
    console.error('Error deleting detection:', error);
    return res.status(500).json({ error: 'Failed to delete detection' });
  }
};

export default {
  detectFromImage,
  getDetectionResult,
  applyDetectionCorrections,
  saveDetectedChart,
  getSymbols,
  getDetectionHistory,
  deleteDetection,
};
