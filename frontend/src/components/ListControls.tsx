import { FiSearch, FiHeart } from 'react-icons/fi';

export interface SortOption<T> {
  id: string;
  label: string;
  compare: (a: T, b: T) => number;
}

interface ListControlsProps<T> {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  sortOptions: SortOption<T>[];
  sortValue: string;
  onSortChange: (id: string) => void;

  showFavorites?: boolean;
  onShowFavoritesChange?: (on: boolean) => void;

  resultCount?: number;
}

export default function ListControls<T>({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  sortOptions,
  sortValue,
  onSortChange,
  showFavorites,
  onShowFavoritesChange,
  resultCount,
}: ListControlsProps<T>) {
  const favoritesToggleAvailable = typeof showFavorites === 'boolean' && onShowFavoritesChange;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span className="hidden sm:inline">Sort</span>
        <select
          value={sortValue}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {sortOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {favoritesToggleAvailable && (
        <button
          type="button"
          onClick={() => onShowFavoritesChange!(!showFavorites)}
          aria-pressed={showFavorites}
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition ${
            showFavorites
              ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title={showFavorites ? 'Showing favorites only' : 'Show favorites only'}
        >
          <FiHeart className={`h-4 w-4 ${showFavorites ? 'fill-current' : ''}`} />
          <span className="hidden sm:inline">Favorites</span>
        </button>
      )}

      {typeof resultCount === 'number' && (
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          {resultCount} result{resultCount === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}

export function applyListControls<T>(
  items: T[],
  opts: {
    search: string;
    searchFields: (item: T) => Array<string | null | undefined>;
    sort: SortOption<T> | undefined;
  },
): T[] {
  const needle = opts.search.trim().toLowerCase();
  let result = items;
  if (needle) {
    result = result.filter((item) =>
      opts.searchFields(item).some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)),
    );
  }
  if (opts.sort) {
    result = [...result].sort(opts.sort.compare);
  }
  return result;
}
