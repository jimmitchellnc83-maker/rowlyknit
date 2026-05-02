/**
 * Wave 4 — marker state HTTP layer.
 *
 * GET /api/projects/:id/marker-history?limit=50
 * POST /api/projects/:id/marker-history/:entryId/rewind
 *
 * Both routes are auth-required + project-ownership-gated through the
 * service layer (getHistory / rewindTo both refuse foreign projects).
 */

import { Request, Response } from 'express';
import { NotFoundError } from '../utils/errorHandler';
import {
  getHistory,
  rewindTo,
} from '../services/markerStateService';

export async function listMarkerHistoryHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const limitRaw = req.query.limit;
  const limit =
    typeof limitRaw === 'string' ? parseInt(limitRaw, 10) : undefined;
  const history = await getHistory({ projectId, userId, limit });
  res.json({ success: true, data: { history } });
}

export async function rewindMarkerHistoryHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { entryId } = req.params;
  const result = await rewindTo({ historyId: entryId, userId });
  if (!result) {
    throw new NotFoundError('History entry not found or has no previous position');
  }
  res.json({ success: true, data: { entry: result } });
}
