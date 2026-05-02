/**
 * Wave 6 — join_layouts + blank_pages HTTP layer.
 */

import { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import {
  createBlankPage,
  createJoinLayout,
  listBlankPages,
  listJoinLayouts,
  softDeleteBlankPage,
  softDeleteJoinLayout,
  updateBlankPage,
  updateJoinLayout,
  type BlankPageAspect,
  type Craft,
  type JoinRegion,
} from '../services/joinLayoutService';

const VALID_ASPECTS: BlankPageAspect[] = ['letter', 'a4', 'square', 'custom'];
const VALID_CRAFTS: Craft[] = ['knit', 'crochet'];

// ============================================
// Join layouts
// ============================================

export async function createJoinLayoutHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name : '';
  const regions = (body.regions ?? []) as JoinRegion[];
  const layout = await createJoinLayout({ projectId, userId, name, regions });
  if (!layout) throw new NotFoundError('Project not found');
  res.status(201).json({ success: true, data: { layout } });
}

export async function listJoinLayoutsHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const layouts = await listJoinLayouts(projectId, userId);
  res.json({ success: true, data: { layouts } });
}

export async function updateJoinLayoutHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { layoutId } = req.params;
  const body = req.body as Record<string, unknown>;
  const layout = await updateJoinLayout({
    layoutId,
    userId,
    name: typeof body.name === 'string' ? body.name : undefined,
    regions: Array.isArray(body.regions)
      ? (body.regions as JoinRegion[])
      : undefined,
  });
  if (!layout) throw new NotFoundError('Layout not found');
  res.json({ success: true, data: { layout } });
}

export async function deleteJoinLayoutHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { layoutId } = req.params;
  const ok = await softDeleteJoinLayout(layoutId, userId);
  if (!ok) throw new NotFoundError('Layout not found');
  res.json({ success: true, message: 'Layout deleted' });
}

// ============================================
// Blank pages
// ============================================

export async function createBlankPageHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const body = req.body as Record<string, unknown>;
  const craft =
    typeof body.craft === 'string' && (VALID_CRAFTS as string[]).includes(body.craft)
      ? (body.craft as Craft)
      : 'knit';
  const aspectKind =
    typeof body.aspectKind === 'string' &&
    (VALID_ASPECTS as string[]).includes(body.aspectKind)
      ? (body.aspectKind as BlankPageAspect)
      : 'letter';
  const width = Number(body.width);
  const height = Number(body.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new ValidationError('width and height must be numbers');
  }
  const page = await createBlankPage({
    projectId,
    userId,
    name: typeof body.name === 'string' ? body.name : null,
    craft,
    width,
    height,
    aspectKind,
  });
  if (!page) throw new NotFoundError('Project not found');
  res.status(201).json({ success: true, data: { page } });
}

export async function listBlankPagesHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const pages = await listBlankPages(projectId, userId);
  res.json({ success: true, data: { pages } });
}

export async function updateBlankPageHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { pageId } = req.params;
  const body = req.body as Record<string, unknown>;
  const page = await updateBlankPage({
    pageId,
    userId,
    name:
      'name' in body
        ? typeof body.name === 'string'
          ? body.name
          : null
        : undefined,
    strokes: Array.isArray(body.strokes)
      ? (body.strokes as unknown[])
      : undefined,
  });
  if (!page) throw new NotFoundError('Blank page not found');
  res.json({ success: true, data: { page } });
}

export async function deleteBlankPageHandler(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { pageId } = req.params;
  const ok = await softDeleteBlankPage(pageId, userId);
  if (!ok) throw new NotFoundError('Blank page not found');
  res.json({ success: true, message: 'Blank page deleted' });
}
