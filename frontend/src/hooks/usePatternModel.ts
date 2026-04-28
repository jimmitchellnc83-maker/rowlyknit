/**
 * Hooks for the canonical Pattern model — PR 5 of the Designer rebuild.
 *
 * Wraps the `/api/pattern-models/*` endpoints introduced in PR 5's
 * backend layer with React Query. Used by the Author-mode route
 * (`/patterns/:id/author`) and any future canonical-model surface.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { CanonicalPattern } from '../types/pattern';

interface ListResponse {
  success: boolean;
  data: CanonicalPattern[];
}

interface SingleResponse {
  success: boolean;
  data: CanonicalPattern;
}

export function usePatternModels() {
  return useQuery({
    queryKey: ['pattern-models'],
    queryFn: async (): Promise<CanonicalPattern[]> => {
      const { data } = await axios.get<ListResponse>('/api/pattern-models');
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function usePatternModel(id: string | undefined) {
  return useQuery({
    queryKey: ['pattern-models', id],
    queryFn: async (): Promise<CanonicalPattern> => {
      if (!id) throw new Error('id is required');
      const { data } = await axios.get<SingleResponse>(`/api/pattern-models/${id}`);
      return data.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export interface CreatePatternModelPayload {
  name: string;
  craft: 'knit' | 'crochet';
  technique?: string;
  gaugeProfile?: unknown;
  sizeSet?: unknown;
  sections?: unknown[];
  legend?: unknown;
  materials?: unknown[];
  progressState?: unknown;
  notes?: string | null;
  sourcePatternId?: string | null;
  sourceProjectId?: string | null;
}

export function useCreatePatternModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePatternModelPayload): Promise<CanonicalPattern> => {
      const { data } = await axios.post<SingleResponse>('/api/pattern-models', input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pattern-models'] });
    },
  });
}

export interface UpdatePatternModelPayload {
  name?: string;
  craft?: 'knit' | 'crochet';
  technique?: string;
  gaugeProfile?: unknown;
  sizeSet?: unknown;
  sections?: unknown[];
  legend?: unknown;
  materials?: unknown[];
  progressState?: unknown;
  notes?: string | null;
}

export function useUpdatePatternModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: UpdatePatternModelPayload }): Promise<CanonicalPattern> => {
      const { data } = await axios.put<SingleResponse>(
        `/api/pattern-models/${args.id}`,
        args.patch,
      );
      return data.data;
    },
    onSuccess: (pattern) => {
      qc.invalidateQueries({ queryKey: ['pattern-models'] });
      qc.invalidateQueries({ queryKey: ['pattern-models', pattern.id] });
    },
  });
}

export function useDeletePatternModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await axios.delete(`/api/pattern-models/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pattern-models'] });
    },
  });
}
