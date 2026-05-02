/**
 * Wave 5 — chart alignment + Magic Marker HTTP layer.
 *
 * All routes auth-required + project/crop ownership-gated.
 */

import { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import {
  getAlignmentForCrop,
  setAlignment,
} from '../services/chartAlignmentService';
import {
  buildChartGridPatch,
  confirmMatches,
  findMatches,
  recordSample,
} from '../services/magicMarkerService';

// PUT /api/source-files/:fileId/crops/:cropId/alignment
export async function setAlignmentHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { cropId } = req.params;
  const body = req.body as Record<string, unknown>;
  const result = await setAlignment({
    cropId,
    userId,
    gridX: Number(body.gridX),
    gridY: Number(body.gridY),
    gridWidth: Number(body.gridWidth),
    gridHeight: Number(body.gridHeight),
    cellsAcross: Number(body.cellsAcross),
    cellsDown: Number(body.cellsDown),
  });
  if (!result) throw new NotFoundError('Crop not found');
  res.json({ success: true, data: { alignment: result } });
}

// GET /api/source-files/:fileId/crops/:cropId/alignment
export async function getAlignmentHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { cropId } = req.params;
  const alignment = await getAlignmentForCrop(cropId, userId);
  res.json({ success: true, data: { alignment: alignment ?? null } });
}

// POST /api/source-files/:fileId/crops/:cropId/magic-marker/sample
export async function recordSampleHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const body = req.body as Record<string, unknown>;
  const chartAlignmentId =
    typeof body.chartAlignmentId === 'string' ? body.chartAlignmentId : null;
  const symbol = typeof body.symbol === 'string' ? body.symbol : null;
  if (!chartAlignmentId) {
    throw new ValidationError('chartAlignmentId is required');
  }
  if (!symbol) {
    throw new ValidationError('symbol is required');
  }
  const sample = await recordSample({
    chartAlignmentId,
    userId,
    symbol,
    gridRow: Number(body.gridRow),
    gridCol: Number(body.gridCol),
    imageHash:
      typeof body.imageHash === 'string' ? body.imageHash : null,
    matchMetadata:
      typeof body.matchMetadata === 'object' && body.matchMetadata !== null
        ? (body.matchMetadata as Record<string, unknown>)
        : undefined,
  });
  if (!sample) throw new NotFoundError('Chart alignment not found');
  res.status(201).json({ success: true, data: { sample } });
}

// POST /api/source-files/:fileId/crops/:cropId/magic-marker/match
export async function findMatchesHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const body = req.body as Record<string, unknown>;
  const chartAlignmentId =
    typeof body.chartAlignmentId === 'string' ? body.chartAlignmentId : null;
  const targetHash =
    typeof body.targetHash === 'string' ? body.targetHash : null;
  if (!chartAlignmentId) {
    throw new ValidationError('chartAlignmentId is required');
  }
  if (!targetHash) {
    throw new ValidationError('targetHash is required');
  }
  const max =
    typeof body.maxDistance === 'number' ? body.maxDistance : undefined;
  const candidates = await findMatches({
    chartAlignmentId,
    userId,
    targetHash,
    maxDistance: max,
  });
  res.json({ success: true, data: { candidates } });
}

// POST /api/source-files/:fileId/crops/:cropId/magic-marker/confirm
export async function confirmMatchesHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const body = req.body as Record<string, unknown>;
  const chartId = typeof body.chartId === 'string' ? body.chartId : null;
  const symbol = typeof body.symbol === 'string' ? body.symbol : null;
  const cells = Array.isArray(body.cells)
    ? (body.cells as Array<{ row: number; col: number }>).filter(
        (c) =>
          c &&
          typeof c.row === 'number' &&
          typeof c.col === 'number' &&
          c.row >= 0 &&
          c.col >= 0
      )
    : [];
  if (!chartId) throw new ValidationError('chartId is required');
  if (!symbol) throw new ValidationError('symbol is required');
  const result = await confirmMatches({ chartId, userId, symbol, cells });
  if (!result) throw new NotFoundError('Chart not found');
  res.json({ success: true, data: result });
}

// Keep buildChartGridPatch exported for potential preview-mode use later.
void buildChartGridPatch;
