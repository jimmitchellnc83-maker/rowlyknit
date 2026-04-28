import { useMemo } from 'react';
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
import { getRelevantSymbolCategories } from '../utils/techniqueRules';

/**
 * Fetch the symbol palette (system + user-custom), optionally filtered by craft.
 *
 * "Recent" and "Used" groups are computed in the StitchPalette component from
 * localStorage and the active chart respectively, so they are not part of
 * the server response.
 *
 * When `technique` is also supplied, the palette is narrowed client-side
 * to symbols whose `category` belongs to the technique's relevant set
 * (per `techniqueRules.getRelevantSymbolCategories`). Custom symbols are
 * never filtered — knitters who created a stitch should always see it.
 */
export function useChartSymbols(craft?: Craft, technique?: Technique) {
  const query = useQuery({
    queryKey: ['chart-symbols', craft ?? 'all'],
    queryFn: async (): Promise<SymbolPalette> => {
      const params: Record<string, string> = {};
      if (craft) params.craft = craft;
      const { data } = await axios.get('/api/charts/symbols', { params });
      return data.data as SymbolPalette;
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredData = useMemo(() => {
    if (!query.data) return query.data;
    if (!craft || !technique) return query.data;
    const allowed = getRelevantSymbolCategories(craft, technique);
    if (allowed.size === 0) return query.data;
    return {
      system: query.data.system.filter(
        (s) => !s.category || allowed.has(s.category),
      ),
      custom: query.data.custom,
    };
  }, [query.data, craft, technique]);

  return { ...query, data: filteredData };
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
