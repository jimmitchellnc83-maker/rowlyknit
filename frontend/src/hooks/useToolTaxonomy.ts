import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { ToolTaxonomySuggestion, ToolTaxonomyTree } from '../types/toolTaxonomy';

const DEBOUNCE_MS = 80;
const DEFAULT_LIMIT = 8;

interface UseToolAutocompleteOptions {
  limit?: number;
  craft?: 'knitting' | 'crochet' | 'all';
}

export function useToolAutocomplete(options: UseToolAutocompleteOptions = {}) {
  const { limit = DEFAULT_LIMIT, craft } = options;
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ToolTaxonomySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { limit };
      if (q) params.q = q;
      if (craft && craft !== 'all') params.craft = craft;

      const { data } = await axios.get('/api/tools/taxonomy/search', {
        params,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setSuggestions(data.data.suggestions);
      }
    } catch (err: any) {
      if (err?.name !== 'CanceledError') {
        setSuggestions([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [limit, craft]);

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, query.length === 0 ? 0 : DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, fetchSuggestions]);

  const recordSelection = useCallback(async (toolTypeId: string) => {
    try {
      await axios.post('/api/tools/taxonomy/recent', { toolTypeId });
    } catch {
      // non-critical
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    // Fetch popular/recent immediately when opening with empty query
    if (!query) fetchSuggestions('');
  }, [query, fetchSuggestions]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isLoading,
    isOpen,
    open,
    close,
    recordSelection,
  };
}

/**
 * Fetches the full taxonomy tree for dropdown selectors.
 * Cached via React Query — loads once, shared across components.
 */
export function useToolTaxonomyTree() {
  return useQuery<ToolTaxonomyTree>({
    queryKey: ['toolTaxonomyTree'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tools/taxonomy/categories');
      return data.data.categories;
    },
    staleTime: 1000 * 60 * 30, // cache for 30 min — this data rarely changes
  });
}
