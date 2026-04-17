import { useRef, useEffect, useState } from 'react';
import { FiSearch, FiClock, FiTrendingUp } from 'react-icons/fi';
import { useToolAutocomplete } from '../hooks/useToolTaxonomy';
import type { ToolTaxonomySuggestion } from '../types/toolTaxonomy';

interface Props {
  onSelect: (suggestion: ToolTaxonomySuggestion) => void;
  initialLabel?: string;
  craft?: 'knitting' | 'crochet' | 'all';
  placeholder?: string;
}

export default function ToolTypeAutocomplete({
  onSelect,
  initialLabel = '',
  craft = 'all',
  placeholder = 'Search tools... e.g. "swift", "blocking", "dpn"',
}: Props) {
  const {
    query,
    setQuery,
    suggestions,
    isLoading,
    isOpen,
    open,
    close,
    recordSelection,
  } = useToolAutocomplete({ craft });

  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Set initial label when editing
  useEffect(() => {
    if (initialLabel) setQuery(initialLabel);
  }, [initialLabel, setQuery]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [close]);

  const handleSelect = (suggestion: ToolTaxonomySuggestion) => {
    setQuery(suggestion.label);
    recordSelection(suggestion.toolTypeId);
    onSelect(suggestion);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIndex(-1);
  }, [suggestions]);

  // Group suggestions by subcategory for display
  const grouped = groupBySubcategory(suggestions);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) open();
          }}
          onFocus={open}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          {grouped.map((group) => (
            <li key={group.key}>
              {group.subcategoryLabel && (
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                  {group.subcategoryLabel}
                  <span className="ml-1 text-gray-400 normal-case">
                    &middot; {group.categoryLabel}
                  </span>
                </div>
              )}
              {group.items.map((suggestion, idx) => {
                const flatIdx = getFlatIndex(grouped, group.key, idx);
                const isHighlighted = flatIdx === highlightIndex;
                return (
                  <div
                    key={suggestion.toolTypeId}
                    role="option"
                    aria-selected={isHighlighted}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                      isHighlighted ? 'bg-purple-50 text-purple-900' : 'hover:bg-gray-50'
                    }`}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(suggestion); }}
                    onMouseEnter={() => setHighlightIndex(flatIdx)}
                  >
                    <div className="flex items-center gap-2">
                      {suggestion.source === 'recent' && (
                        <FiClock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      {suggestion.source === 'popular' && (
                        <FiTrendingUp className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {highlightMatch(suggestion.label, query)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {suggestion.appliesTo.includes('knitting') && !suggestion.appliesTo.includes('both') && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">knit</span>
                      )}
                      {suggestion.appliesTo.includes('crochet') && !suggestion.appliesTo.includes('both') && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">crochet</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
      )}

      {isOpen && !isLoading && suggestions.length === 0 && query.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
          No tools found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

interface SuggestionGroup {
  key: string;
  subcategoryLabel: string;
  categoryLabel: string;
  items: ToolTaxonomySuggestion[];
}

function groupBySubcategory(suggestions: ToolTaxonomySuggestion[]): SuggestionGroup[] {
  const map = new Map<string, SuggestionGroup>();
  for (const s of suggestions) {
    const key = s.subcategoryId;
    if (!map.has(key)) {
      map.set(key, {
        key,
        subcategoryLabel: s.subcategoryLabel,
        categoryLabel: s.categoryLabel,
        items: [],
      });
    }
    map.get(key)!.items.push(s);
  }
  return [...map.values()];
}

function getFlatIndex(groups: SuggestionGroup[], groupKey: string, itemIdx: number): number {
  let flat = 0;
  for (const g of groups) {
    if (g.key === groupKey) return flat + itemIdx;
    flat += g.items.length;
  }
  return flat;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold text-purple-700">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
