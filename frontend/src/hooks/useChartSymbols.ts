import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type {
  ChartSymbolTemplate,
  CreateSymbolInput,
  Craft,
  SymbolPalette,
  UpdateSymbolInput,
} from '../types/chartSymbol';

/**
 * Fetch the symbol palette (system + user-custom), optionally filtered by craft.
 *
 * "Recent" and "Used" groups are computed in the StitchPalette component from
 * localStorage and the active chart respectively, so they are not part of
 * the server response.
 */
export function useChartSymbols(craft?: Craft) {
  return useQuery({
    queryKey: ['chart-symbols', craft ?? 'all'],
    queryFn: async (): Promise<SymbolPalette> => {
      const params: Record<string, string> = {};
      if (craft) params.craft = craft;
      const { data } = await axios.get('/api/charts/symbols', { params });
      return data.data as SymbolPalette;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCustomSymbol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSymbolInput): Promise<ChartSymbolTemplate> => {
      const { data } = await axios.post('/api/charts/symbols', input);
      return data.data as ChartSymbolTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chart-symbols'] });
    },
  });
}

export function useUpdateCustomSymbol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateSymbolInput }): Promise<ChartSymbolTemplate> => {
      const { data } = await axios.put(`/api/charts/symbols/${args.id}`, args.input);
      return data.data as ChartSymbolTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chart-symbols'] });
    },
  });
}

export function useDeleteCustomSymbol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await axios.delete(`/api/charts/symbols/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chart-symbols'] });
    },
  });
}
