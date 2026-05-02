/**
 * API client for Wave 4 marker state + history.
 *
 * Mirrors `backend/src/types/markerState.ts`. The history surface lives
 * under `/api/projects/:id/marker-history` and supports listing recent
 * entries + rewinding a marker back to a previous position.
 */

import axios from 'axios';

export type MarkerSurface = 'counter' | 'panel' | 'chart';
export type MarkerPosition = Record<string, unknown>;

export interface MarkerStateHistoryEntry {
  id: string;
  markerStateId: string;
  projectId: string;
  userId: string;
  previousPosition: MarkerPosition | null;
  newPosition: MarkerPosition;
  createdAt: string;
  surface: MarkerSurface;
  surfaceRef: string | null;
}

export async function listMarkerHistory(
  projectId: string,
  limit?: number,
): Promise<MarkerStateHistoryEntry[]> {
  const res = await axios.get(`/api/projects/${projectId}/marker-history`, {
    params: limit ? { limit } : undefined,
  });
  return (res.data?.data?.history ?? []) as MarkerStateHistoryEntry[];
}

export async function rewindMarkerHistory(
  projectId: string,
  entryId: string,
): Promise<MarkerStateHistoryEntry> {
  const res = await axios.post(
    `/api/projects/${projectId}/marker-history/${entryId}/rewind`,
  );
  return res.data.data.entry as MarkerStateHistoryEntry;
}
