/**
 * React Query hooks for the personal chart library (Session 4 PR 1).
 * Backs `/charts` (the library page) + Designer "Save chart as asset"
 * + "Load saved chart" (Session 4 PR 2).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { ChartData } from '../components/designer/ChartGrid';

export interface SavedChart {
  id: string;
  user_id: string;
  project_id: string | null;
  pattern_id: string | null;
  name: string;
  grid: ChartData;
  rows: number;
  columns: number;
  symbol_legend: Record<string, unknown>;
  description: string | null;
  source: string;
  source_image_url: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListChartsResult {
  charts: SavedChart[];
  total: number;
}

export interface ListChartsParams {
  archived?: boolean;
  projectId?: string;
  patternId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

const QK = {
  list: (params: ListChartsParams) => ['charts', 'list', params] as const,
  one: (id: string) => ['charts', 'one', id] as const,
};

export function useChartList(params: ListChartsParams = {}) {
  return useQuery({
    queryKey: QK.list(params),
    queryFn: async (): Promise<ListChartsResult> => {
      const { data } = await axios.get('/api/charts', { params });
      return data.data as ListChartsResult;
    },
    staleTime: 30 * 1000,
  });
}

export function useChart(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? QK.one(id) : ['charts', 'one', 'none'],
    enabled: !!id,
    queryFn: async (): Promise<SavedChart> => {
      const { data } = await axios.get(`/api/charts/${id}`);
      return data.data as SavedChart;
    },
  });
}

export interface CreateChartInput {
  name: string;
  grid: ChartData;
  description?: string | null;
  project_id?: string | null;
  pattern_id?: string | null;
  source?: 'manual' | 'image_import' | 'duplicate';
  symbol_legend?: Record<string, unknown>;
}

export function useCreateChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateChartInput): Promise<SavedChart> => {
      const { data } = await axios.post('/api/charts', input);
      return data.data as SavedChart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charts'] }),
  });
}

export interface UpdateChartInput {
  name?: string;
  grid?: ChartData;
  description?: string | null;
  project_id?: string | null;
  pattern_id?: string | null;
  symbol_legend?: Record<string, unknown>;
}

export function useUpdateChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateChartInput }): Promise<SavedChart> => {
      const { data } = await axios.put(`/api/charts/${args.id}`, args.input);
      return data.data as SavedChart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charts'] }),
  });
}

export function useArchiveChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<SavedChart> => {
      const { data } = await axios.post(`/api/charts/${id}/archive`);
      return data.data as SavedChart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charts'] }),
  });
}

export function useRestoreChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<SavedChart> => {
      const { data } = await axios.post(`/api/charts/${id}/restore`);
      return data.data as SavedChart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charts'] }),
  });
}

export function useDuplicateChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<SavedChart> => {
      const { data } = await axios.post(`/api/charts/${id}/duplicate`);
      return data.data as SavedChart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charts'] }),
  });
}

export function useDeleteChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await axios.delete(`/api/charts/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['charts'] }),
  });
}
