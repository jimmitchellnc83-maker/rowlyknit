import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type {
  ChartSymbolTemplate,
  CreateSymbolInput,
  Craft,
  SymbolPalette,
  UpdateSymbolInput,
} from '../types/chartSymbol';
import type { Technique } from '../types/pattern';

/**
 * Fetch the symbol palette (system + user-custom), optionally filtered
 * by craft and technique.
 *
 * Both filters are applied server-side via the `?craft=` and
 * `?technique=` query params. The technique filter narrows system
 * symbols to those whose `techniques` array contains the requested
 * technique (or has NULL/empty `techniques`, meaning "applies
 * everywhere"). Custom symbols are never narrowed by technique —
 * knitters who created a stitch should always see it regardless of
 * the active technique selection.
 *
 * "Recent" and "Used" groups are computed in the StitchPalette
 * component from localStorage and the active chart respectively, so
 * they are not part of the server response.
 */
export function useChartSymbols(craft?: Craft, technique?: Technique) {
  return useQuery({
    queryKey: ['chart-symbols', craft ?? 'all', technique ?? 'all'],
    queryFn: async (): Promise<SymbolPalette> => {
      const params: Record<string, string> = {};
      if (craft) params.craft = craft;
      if (technique) params.technique = technique;
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
