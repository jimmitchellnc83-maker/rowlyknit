/**
 * Wave 6 — join_layouts + blank_pages service layer.
 *
 * One file, two surfaces: both are project-scoped, both share the
 * ownership-gated CRUD pattern. join_layouts hold an array of region
 * pointers (pattern_crop_id + canvas-normalized placement); blank_pages
 * are first-class drawing surfaces with the same stroke shape Wave 3
 * uses.
 *
 * Cross-craft: blank_pages.craft is first-class. Join regions are
 * dimension-agnostic (just floats), so they hold knit charts, crochet
 * diagrams, or scanned reference images all the same.
 */

import db from '../config/database';
import { ValidationError } from '../utils/errorHandler';

// ============================================
// Join layouts
// ============================================

export interface JoinRegion {
  patternCropId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
}

export interface JoinLayout {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  regions: JoinRegion[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface JoinLayoutRow {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  regions: JoinRegion[] | string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

function toIso(v: Date | string | null): string | null {
  if (v === null) return null;
  return v instanceof Date ? v.toISOString() : v;
}
function toIsoNonNull(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : v;
}

function parseJson<T>(v: T | string | null): T | null {
  if (v === null) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v;
}

function mapJoinLayoutRow(r: JoinLayoutRow): JoinLayout {
  return {
    id: r.id,
    projectId: r.project_id,
    userId: r.user_id,
    name: r.name,
    regions: (parseJson<JoinRegion[]>(r.regions) as JoinRegion[] | null) ?? [],
    createdAt: toIsoNonNull(r.created_at),
    updatedAt: toIsoNonNull(r.updated_at),
    deletedAt: toIso(r.deleted_at),
  };
}

export function assertValidRegions(regions: unknown): asserts regions is JoinRegion[] {
  if (!Array.isArray(regions)) {
    throw new ValidationError('regions must be an array');
  }
  for (const r of regions as Array<Record<string, unknown>>) {
    if (typeof r.patternCropId !== 'string') {
      throw new ValidationError('region.patternCropId must be a string');
    }
    for (const key of ['x', 'y', 'width', 'height']) {
      const v = r[key];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
        throw new ValidationError(`region.${key} must be in [0, 1]`);
      }
    }
  }
}

export async function createJoinLayout(input: {
  projectId: string;
  userId: string;
  name: string;
  regions: JoinRegion[];
}): Promise<JoinLayout | null> {
  if (!input.name || input.name.length > 120) {
    throw new ValidationError('name must be 1..120 chars');
  }
  assertValidRegions(input.regions);
  const project = await db('projects')
    .where({ id: input.projectId, user_id: input.userId })
    .whereNull('deleted_at')
    .first('id');
  if (!project) return null;

  const [row] = await db('join_layouts')
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      name: input.name,
      regions: JSON.stringify(input.regions),
    })
    .returning('*');
  return mapJoinLayoutRow(row as JoinLayoutRow);
}

export async function listJoinLayouts(
  projectId: string,
  userId: string
): Promise<JoinLayout[]> {
  const rows = await db('join_layouts')
    .where({ project_id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .orderBy('updated_at', 'desc');
  return rows.map((r) => mapJoinLayoutRow(r as JoinLayoutRow));
}

export async function updateJoinLayout(input: {
  layoutId: string;
  userId: string;
  name?: string;
  regions?: JoinRegion[];
}): Promise<JoinLayout | null> {
  const update: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) {
    if (!input.name || input.name.length > 120) {
      throw new ValidationError('name must be 1..120 chars');
    }
    update.name = input.name;
  }
  if (input.regions !== undefined) {
    assertValidRegions(input.regions);
    update.regions = JSON.stringify(input.regions);
  }
  const updated = await db('join_layouts')
    .where({ id: input.layoutId, user_id: input.userId })
    .whereNull('deleted_at')
    .update(update);
  if (updated === 0) return null;
  const row = await db('join_layouts').where({ id: input.layoutId }).first();
  return row ? mapJoinLayoutRow(row as JoinLayoutRow) : null;
}

export async function softDeleteJoinLayout(
  layoutId: string,
  userId: string
): Promise<boolean> {
  const updated = await db('join_layouts')
    .where({ id: layoutId, user_id: userId })
    .whereNull('deleted_at')
    .update({ deleted_at: new Date() });
  return updated > 0;
}

// ============================================
// Blank pages
// ============================================

export type BlankPageAspect = 'letter' | 'a4' | 'square' | 'custom';
export type Craft = 'knit' | 'crochet';

export interface BlankPage {
  id: string;
  projectId: string;
  userId: string;
  name: string | null;
  craft: Craft;
  width: number;
  height: number;
  aspectKind: BlankPageAspect;
  strokes: unknown[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface BlankPageRow {
  id: string;
  project_id: string;
  user_id: string;
  name: string | null;
  craft: Craft;
  width: number;
  height: number;
  aspect_kind: BlankPageAspect;
  strokes: unknown[] | string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

function mapBlankPageRow(r: BlankPageRow): BlankPage {
  return {
    id: r.id,
    projectId: r.project_id,
    userId: r.user_id,
    name: r.name,
    craft: r.craft,
    width: Number(r.width),
    height: Number(r.height),
    aspectKind: r.aspect_kind,
    strokes: (parseJson<unknown[]>(r.strokes) as unknown[] | null) ?? [],
    createdAt: toIsoNonNull(r.created_at),
    updatedAt: toIsoNonNull(r.updated_at),
    deletedAt: toIso(r.deleted_at),
  };
}

export async function createBlankPage(input: {
  projectId: string;
  userId: string;
  name?: string | null;
  craft: Craft;
  width: number;
  height: number;
  aspectKind: BlankPageAspect;
}): Promise<BlankPage | null> {
  if (input.width <= 0 || input.height <= 0) {
    throw new ValidationError('width and height must be > 0');
  }
  const project = await db('projects')
    .where({ id: input.projectId, user_id: input.userId })
    .whereNull('deleted_at')
    .first('id');
  if (!project) return null;

  const [row] = await db('blank_pages')
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      name: input.name ?? null,
      craft: input.craft,
      width: input.width,
      height: input.height,
      aspect_kind: input.aspectKind,
      strokes: '[]',
    })
    .returning('*');
  return mapBlankPageRow(row as BlankPageRow);
}

export async function listBlankPages(
  projectId: string,
  userId: string
): Promise<BlankPage[]> {
  const rows = await db('blank_pages')
    .where({ project_id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .orderBy('updated_at', 'desc');
  return rows.map((r) => mapBlankPageRow(r as BlankPageRow));
}

export async function updateBlankPage(input: {
  pageId: string;
  userId: string;
  name?: string | null;
  strokes?: unknown[];
}): Promise<BlankPage | null> {
  const update: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) update.name = input.name;
  if (input.strokes !== undefined) {
    if (!Array.isArray(input.strokes)) {
      throw new ValidationError('strokes must be an array');
    }
    const json = JSON.stringify(input.strokes);
    if (Buffer.byteLength(json, 'utf8') > 5 * 1024 * 1024) {
      throw new ValidationError('strokes payload exceeds 5 MB cap');
    }
    update.strokes = json;
  }
  const updated = await db('blank_pages')
    .where({ id: input.pageId, user_id: input.userId })
    .whereNull('deleted_at')
    .update(update);
  if (updated === 0) return null;
  const row = await db('blank_pages').where({ id: input.pageId }).first();
  return row ? mapBlankPageRow(row as BlankPageRow) : null;
}

export async function softDeleteBlankPage(
  pageId: string,
  userId: string
): Promise<boolean> {
  const updated = await db('blank_pages')
    .where({ id: pageId, user_id: userId })
    .whereNull('deleted_at')
    .update({ deleted_at: new Date() });
  return updated > 0;
}
