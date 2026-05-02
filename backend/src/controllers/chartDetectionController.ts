import { Request, Response } from 'express';
import db from '../config/database';
import logger from '../config/logger';
import {
  detectChartFromImage,
  applyCorrections,
} from '../services/chartDetectionService';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { generateStorageFilename, streamSafeUpload } from '../utils/uploadStorage';

// Upload directory for chart images
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/charts';

/**
 * Detect chart from uploaded image
 * POST /api/charts/detect-from-image
 */
export const detectFromImage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check for file upload
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const imageBuffer = req.file.buffer;
    const originalFilename = req.file.originalname;
    const contentType = req.file.mimetype;
    const { project_id, target_cols, target_rows, inner_ratio } = req.body;

    // Coerce + validate the new detection knobs. multipart/form-data
    // delivers everything as strings, so parse defensively.
    const targetCols = target_cols !== undefined ? parseInt(String(target_cols), 10) : undefined;
    const targetRows = target_rows !== undefined ? parseInt(String(target_rows), 10) : undefined;
    const innerRatio = inner_ratio !== undefined ? parseFloat(String(inner_ratio)) : undefined;
    const detectOptions = {
      targetCols: Number.isFinite(targetCols) && (targetCols as number) > 0 ? targetCols : undefined,
      targetRows: Number.isFinite(targetRows) && (targetRows as number) > 0 ? targetRows : undefined,
      innerRatio: Number.isFinite(innerRatio) ? innerRatio : undefined,
    };

    // Create detection record
    const detectionId = uuidv4();

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Random on-disk filename so URL guessing can't enumerate; the
    // public URL routes through /api/charts/detection/:id/image which
    // re-checks ownership before streaming.
    const imageExt = path.extname(originalFilename) || '.png';
    const storageFilename = generateStorageFilename(imageExt);
    const imagePath = path.join(UPLOAD_DIR, storageFilename);
    await fs.writeFile(imagePath, imageBuffer);

    const imageUrl = `/api/charts/detection/${detectionId}/image`;

    // Create pending detection record
    await db('detected_charts').insert({
      id: detectionId,
      user_id: userId,
      project_id: project_id || null,
      original_image_url: imageUrl,
      storage_filename: storageFilename,
      status: 'processing',
    });

    try {
      // Run detection
      const detectionResult = await detectChartFromImage(imageBuffer, contentType, detectOptions);

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
    logger.error('Error in chart detection:', error);
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
    const userId = req.user?.userId;

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
    logger.error('Error getting detection:', error);
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
    const userId = req.user?.userId;

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
    logger.error('Error applying corrections:', error);
    return res.status(500).json({ error: 'Failed to apply corrections' });
  }
};

/**
 * Save detected chart to project
 * POST /api/charts/save-detected
 */
export const saveDetectedChart = async (req: Request, res: Response) => {
  try {
    const { detection_id, project_id, pattern_id, chart_name } = req.body;
    const userId = req.user?.userId;

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

    // Verify pattern ownership if provided
    if (pattern_id) {
      const pattern = await db('patterns')
        .where({ id: pattern_id, user_id: userId })
        .whereNull('deleted_at')
        .first();

      if (!pattern) {
        return res.status(404).json({ error: 'Pattern not found' });
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
        pattern_id: pattern_id || null,
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

    // Materialize a canonical Pattern stub so the chart shows up in
    // Author / Make / future public-share surfaces. Best-effort —
    // chart save is the primary success path. Skip when the user
    // already attached the chart to a pattern (pattern_id provided);
    // that pattern is the canonical target instead.
    let canonicalPatternId: string | null = null;
    if (!pattern_id) {
      try {
        const { importChartUploadToCanonical } = await import('../services/patternService');
        const canonical = await importChartUploadToCanonical({
          userId,
          payload: {
            chartId: chart.id,
            chartName: chart_name || detection.name || null,
          },
        });
        canonicalPatternId = canonical.id;
      } catch (canonicalErr) {
        logger.warn('Canonical twin materialization failed for chart upload', {
          userId,
          chartId: chart.id,
          error: canonicalErr instanceof Error ? canonicalErr.message : 'Unknown error',
        });
      }
    }

    return res.status(201).json({
      chart,
      detection_id,
      canonical_pattern_id: canonicalPatternId,
      message: 'Chart saved successfully',
    });
  } catch (error) {
    logger.error('Error saving chart:', error);
    return res.status(500).json({ error: 'Failed to save chart' });
  }
};

/**
 * Get user's detected charts history
 * GET /api/charts/detections
 */
export const getDetectionHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
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
    logger.error('Error getting detection history:', error);
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
    const userId = req.user?.userId;

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
    if (detection.storage_filename) {
      const imagePath = path.join(UPLOAD_DIR, detection.storage_filename);
      try {
        await fs.unlink(imagePath);
      } catch (e) {
        // Ignore file not found errors
      }
    }

    await db('detected_charts').where({ id: detectionId }).delete();

    return res.json({ message: 'Detection deleted successfully' });
  } catch (error) {
    logger.error('Error deleting detection:', error);
    return res.status(500).json({ error: 'Failed to delete detection' });
  }
};

/**
 * Stream the original detection image. Replaces the old
 * `/uploads/charts/<detectionId>.<ext>` path served by the static mount.
 * GET /api/charts/detection/:detectionId/image
 */
export const streamDetectionImage = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { detectionId } = req.params;
  const detection = await db('detected_charts')
    .where({ id: detectionId, user_id: userId })
    .first('storage_filename');

  if (!detection || !detection.storage_filename) {
    return res.status(404).json({ error: 'Detection not found' });
  }

  await streamSafeUpload(res, {
    subdir: 'charts',
    filename: detection.storage_filename,
    mimeType: 'image/png',
  });
};

export default {
  detectFromImage,
  getDetectionResult,
  applyDetectionCorrections,
  saveDetectedChart,
  getDetectionHistory,
  deleteDetection,
};
