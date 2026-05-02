/**
 * API client for Wave 6 — join layouts + blank pages.
 *
 * Endpoints under `/api/projects/:id/join-layouts` and
 * `/api/projects/:id/blank-pages` (see backend/src/routes/projects.ts).
 */

import axios from 'axios';

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

export type BlankPageAspect = 'letter' | 'a4' | 'square' | 'custom';

export interface BlankPage {
  id: string;
  projectId: string;
  userId: string;
  name: string | null;
  craft: 'knit' | 'crochet';
  width: number;
  height: number;
  aspectKind: BlankPageAspect;
  strokes: unknown[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// =============== Join Layouts ===============

export async function listJoinLayouts(projectId: string): Promise<JoinLayout[]> {
  const res = await axios.get(`/api/projects/${projectId}/join-layouts`);
  return (res.data?.data?.layouts ?? []) as JoinLayout[];
}

export async function createJoinLayout(
  projectId: string,
  input: { name: string; regions?: JoinRegion[] },
): Promise<JoinLayout> {
  const res = await axios.post(`/api/projects/${projectId}/join-layouts`, {
    name: input.name,
    regions: input.regions ?? [],
  });
  return res.data.data.layout as JoinLayout;
}

export async function updateJoinLayout(
  projectId: string,
  layoutId: string,
  input: { name?: string; regions?: JoinRegion[] },
): Promise<JoinLayout> {
  const res = await axios.patch(
    `/api/projects/${projectId}/join-layouts/${layoutId}`,
    input,
  );
  return res.data.data.layout as JoinLayout;
}

export async function deleteJoinLayout(
  projectId: string,
  layoutId: string,
): Promise<void> {
  await axios.delete(`/api/projects/${projectId}/join-layouts/${layoutId}`);
}

// =============== Blank Pages ===============

export const ASPECT_PRESETS: Record<
  BlankPageAspect,
  { width: number; height: number }
> = {
  letter: { width: 8.5, height: 11 },
  a4: { width: 8.27, height: 11.69 },
  square: { width: 10, height: 10 },
  custom: { width: 10, height: 10 },
};

export async function listBlankPages(projectId: string): Promise<BlankPage[]> {
  const res = await axios.get(`/api/projects/${projectId}/blank-pages`);
  return (res.data?.data?.pages ?? []) as BlankPage[];
}

export async function createBlankPage(
  projectId: string,
  input: {
    name?: string | null;
    craft?: 'knit' | 'crochet';
    width: number;
    height: number;
    aspectKind: BlankPageAspect;
  },
): Promise<BlankPage> {
  const res = await axios.post(`/api/projects/${projectId}/blank-pages`, {
    name: input.name ?? null,
    craft: input.craft ?? 'knit',
    width: input.width,
    height: input.height,
    aspectKind: input.aspectKind,
  });
  return res.data.data.page as BlankPage;
}

export async function updateBlankPage(
  projectId: string,
  pageId: string,
  input: { name?: string | null; strokes?: unknown[] },
): Promise<BlankPage> {
  const res = await axios.patch(
    `/api/projects/${projectId}/blank-pages/${pageId}`,
    input,
  );
  return res.data.data.page as BlankPage;
}

export async function deleteBlankPage(
  projectId: string,
  pageId: string,
): Promise<void> {
  await axios.delete(`/api/projects/${projectId}/blank-pages/${pageId}`);
}
