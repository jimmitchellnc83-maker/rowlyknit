/**
 * API client for Wave 5 — chart grid alignment + Magic Marker.
 *
 * Mirrors the endpoints under `/api/source-files/:id/crops/:cropId/`
 * exposed by `backend/src/routes/source-files.ts`. Same shape conventions
 * as `lib/sourceFiles.ts` — JSON-stringify swap with the backend types.
 */

import axios from 'axios';
import type { SymbolPalette } from '../types/chartSymbol';

export interface ChartAlignment {
  id: string;
  patternCropId: string;
  userId: string;
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  cellsAcross: number;
  cellsDown: number;
  createdAt: string;
  updatedAt: string;
}

export interface MagicMarkerSample {
  id: string;
  chartAlignmentId: string;
  userId: string;
  symbol: string;
  gridRow: number;
  gridCol: number;
  imageHash: string | null;
  matchMetadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface MatchCandidate {
  sampleId: string;
  symbol: string;
  gridRow: number;
  gridCol: number;
  distance: number;
}

export interface SetAlignmentInput {
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  cellsAcross: number;
  cellsDown: number;
}

export async function getChartAlignment(
  sourceFileId: string,
  cropId: string,
): Promise<ChartAlignment | null> {
  try {
    const res = await axios.get(
      `/api/source-files/${sourceFileId}/crops/${cropId}/alignment`,
    );
    return (res.data?.data?.alignment as ChartAlignment) ?? null;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export async function setChartAlignment(
  sourceFileId: string,
  cropId: string,
  input: SetAlignmentInput,
): Promise<ChartAlignment> {
  const res = await axios.put(
    `/api/source-files/${sourceFileId}/crops/${cropId}/alignment`,
    input,
  );
  return res.data.data.alignment as ChartAlignment;
}

export async function recordMagicMarkerSample(
  sourceFileId: string,
  cropId: string,
  input: {
    chartAlignmentId: string;
    symbol: string;
    gridRow: number;
    gridCol: number;
    imageHash: string | null;
    matchMetadata?: Record<string, unknown>;
  },
): Promise<MagicMarkerSample> {
  const res = await axios.post(
    `/api/source-files/${sourceFileId}/crops/${cropId}/magic-marker/sample`,
    input,
  );
  return res.data.data.sample as MagicMarkerSample;
}

export async function findMagicMarkerMatches(
  sourceFileId: string,
  cropId: string,
  input: {
    chartAlignmentId: string;
    targetHash: string;
    maxDistance?: number;
  },
): Promise<MatchCandidate[]> {
  const res = await axios.post(
    `/api/source-files/${sourceFileId}/crops/${cropId}/magic-marker/match`,
    input,
  );
  return (res.data.data.candidates ?? res.data.data.matches ?? []) as MatchCandidate[];
}

export async function confirmMagicMarkerMatches(
  sourceFileId: string,
  cropId: string,
  input: {
    chartId: string;
    symbol: string;
    cells: Array<{ row: number; col: number }>;
  },
): Promise<{ updatedCells: number }> {
  const res = await axios.post(
    `/api/source-files/${sourceFileId}/crops/${cropId}/magic-marker/confirm`,
    input,
  );
  return res.data.data as { updatedCells: number };
}

/**
 * Fetches the chart symbol palette (system + custom) so the chart-
 * assistance modal can offer real symbols instead of a free-form prompt.
 */
export async function listChartSymbolPalette(
  filters?: { craft?: 'knit' | 'crochet'; technique?: string },
): Promise<SymbolPalette> {
  const res = await axios.get('/api/charts/symbols/palette', { params: filters });
  return res.data.data as SymbolPalette;
}
