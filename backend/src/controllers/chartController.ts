import { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errorHandler';
import {
  archiveChart,
  createChart,
  deleteChart,
  duplicateChart,
  getChart,
  listCharts,
  restoreChart,
  updateChart,
} from '../services/chartService';

const requireUserId = (req: Request): string => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
};

const parseInt0 = (value: unknown, fallback: number): number => {
  if (typeof value !== 'string') return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * GET /api/charts?archived=true&projectId=...&q=...&limit=&offset=
 */
export const list = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { archived, projectId, patternId, q, limit, offset } = req.query;

  const data = await listCharts(userId, {
    includeArchived: archived === 'true',
    projectId: typeof projectId === 'string' ? projectId : undefined,
    patternId: typeof patternId === 'string' ? patternId : undefined,
    query: typeof q === 'string' ? q : undefined,
    limit: parseInt0(limit, 50),
    offset: parseInt0(offset, 0),
  });

  res.json({ success: true, data });
};

/**
 * GET /api/charts/:chartId
 */
export const getOne = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const chart = await getChart(req.params.chartId, userId);
  res.json({ success: true, data: chart });
};

/**
 * POST /api/charts
 */
export const create = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const chart = await createChart(userId, req.body);
  res.status(201).json({ success: true, data: chart });
};

/**
 * PUT /api/charts/:chartId
 */
export const update = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const chart = await updateChart(req.params.chartId, userId, req.body);
  res.json({ success: true, data: chart });
};

/**
 * POST /api/charts/:chartId/archive — soft-archive (idempotent)
 */
export const archive = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const chart = await archiveChart(req.params.chartId, userId);
  res.json({ success: true, data: chart });
};

/**
 * POST /api/charts/:chartId/restore — un-archive (idempotent)
 */
export const restore = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const chart = await restoreChart(req.params.chartId, userId);
  res.json({ success: true, data: chart });
};

/**
 * POST /api/charts/:chartId/duplicate — copy chart, unattach project/pattern
 */
export const duplicate = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const chart = await duplicateChart(req.params.chartId, userId);
  res.status(201).json({ success: true, data: chart });
};

/**
 * DELETE /api/charts/:chartId — hard delete
 */
export const remove = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  await deleteChart(req.params.chartId, userId);
  res.json({ success: true });
};
