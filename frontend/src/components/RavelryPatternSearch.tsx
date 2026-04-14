import { useState, useEffect, useRef, useCallback } from 'react';
import { FiSearch, FiX, FiDownload, FiStar, FiLoader } from 'react-icons/fi';
import axios from 'axios';

interface RavelryPattern {
  id: number;
  name: string;
  designer: string | null;
  difficultyAverage: number | null;
  ratingAverage: number | null;
  yarnWeight: string | null;
  yardageMax: number | null;
  photoUrl: string | null;
  photoSquareUrl: string | null;
  categories: string[];
  craft: string | null;
}

interface RavelryPatternSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (patternData: {
    name: string;
    designer: string;
    difficulty: string;
    category: string;
    description: string;
  }) => void;
}

export default function RavelryPatternSearch({ isOpen, onClose, onImport }: RavelryPatternSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RavelryPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchPatterns = useCallback(async (searchQuery: string, searchPage: number) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotalPages(0);
      setTotalResults(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('/api/ravelry/patterns/search', {
        params: {
          query: searchQuery,
          page: searchPage,
          page_size: 20,
        },
      });

      if (response.data.success) {
        const { patterns, pagination } = response.data.data;
        if (searchPage === 1) {
          setResults(patterns);
        } else {
          setResults((prev) => [...prev, ...patterns]);
        }
        setTotalPages(pagination.totalPages);
        setTotalResults(pagination.totalResults);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to search Ravelry. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setPage(1);
      setError(null);
      return;
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setTotalPages(0);
      setTotalResults(0);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setPage(1);
      searchPatterns(query, 1);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchPatterns]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    searchPatterns(query, nextPage);
  };

  const handleImport = (pattern: RavelryPattern) => {
    // Map Ravelry difficulty (1-10 scale) to app difficulty levels
    let difficulty = 'intermediate';
    if (pattern.difficultyAverage !== null) {
      if (pattern.difficultyAverage <= 2.5) difficulty = 'beginner';
      else if (pattern.difficultyAverage <= 5) difficulty = 'intermediate';
      else if (pattern.difficultyAverage <= 7.5) difficulty = 'advanced';
      else difficulty = 'expert';
    }

    // Map Ravelry categories to the app's category options
    const categoryMap: Record<string, string> = {
      'Pullover': 'sweater',
      'Cardigan': 'sweater',
      'Sweater': 'sweater',
      'Scarf': 'scarf',
      'Cowl': 'scarf',
      'Hat': 'hat',
      'Beanie': 'hat',
      'Blanket': 'blanket',
      'Afghan': 'blanket',
      'Socks': 'socks',
      'Shawl': 'shawl',
      'Wrap': 'shawl',
      'Toy': 'toy',
      'Softies': 'toy',
    };

    let category = 'other';
    for (const cat of pattern.categories) {
      const mapped = categoryMap[cat];
      if (mapped) {
        category = mapped;
        break;
      }
    }

    const descriptionParts: string[] = [];
    if (pattern.craft) descriptionParts.push(`Craft: ${pattern.craft}`);
    if (pattern.yarnWeight) descriptionParts.push(`Yarn weight: ${pattern.yarnWeight}`);
    if (pattern.categories.length > 0) descriptionParts.push(`Categories: ${pattern.categories.join(', ')}`);
    if (pattern.ratingAverage) descriptionParts.push(`Rating: ${pattern.ratingAverage.toFixed(1)}/5`);

    onImport({
      name: pattern.name || '',
      designer: pattern.designer || '',
      difficulty,
      category,
      description: descriptionParts.join('\n'),
    });
    onClose();
  };

  const getDifficultyLabel = (avg: number | null): string => {
    if (avg === null) return '';
    if (avg <= 2.5) return 'Beginner';
    if (avg <= 5) return 'Intermediate';
    if (avg <= 7.5) return 'Advanced';
    return 'Expert';
  };

  const getDifficultyColor = (avg: number | null): string => {
    if (avg === null) return '';
    if (avg <= 2.5) return 'bg-green-100 text-green-800';
    if (avg <= 5) return 'bg-yellow-100 text-yellow-800';
    if (avg <= 7.5) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Search Ravelry Patterns</h2>
            <p className="text-sm text-gray-500 mt-1">Find patterns and import them to your library</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for patterns (e.g., raglan sweater, baby blanket...)"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
            />
          </div>
          {totalResults > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Found {totalResults.toLocaleString()} results
            </p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => searchPatterns(query, 1)}
                className="mt-2 text-purple-600 hover:text-purple-800 text-sm"
              >
                Try again
              </button>
            </div>
          )}

          {!error && results.length === 0 && !loading && query && (
            <div className="text-center py-12 text-gray-500">
              No patterns found matching your search.
            </div>
          )}

          {!error && results.length === 0 && !loading && !query && (
            <div className="text-center py-12 text-gray-400">
              <FiSearch className="mx-auto h-12 w-12 mb-3" />
              <p>Start typing to search the Ravelry pattern database</p>
            </div>
          )}

          <div className="space-y-3">
            {results.map((pattern) => (
              <div
                key={pattern.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:bg-purple-50/30 transition"
              >
                <div className="flex items-start gap-4">
                  {/* Photo */}
                  {(pattern.photoSquareUrl || pattern.photoUrl) && (
                    <img
                      src={pattern.photoSquareUrl || pattern.photoUrl || ''}
                      alt={pattern.name}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  {!pattern.photoSquareUrl && !pattern.photoUrl && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-xs">No photo</span>
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{pattern.name}</h3>
                    {pattern.designer && (
                      <p className="text-sm text-gray-600">by {pattern.designer}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {pattern.difficultyAverage !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyColor(pattern.difficultyAverage)}`}>
                          {getDifficultyLabel(pattern.difficultyAverage)} ({pattern.difficultyAverage.toFixed(1)})
                        </span>
                      )}
                      {pattern.yarnWeight && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          {pattern.yarnWeight}
                        </span>
                      )}
                      {pattern.ratingAverage && (
                        <span className="text-xs text-gray-500 flex items-center gap-0.5">
                          <FiStar className="h-3 w-3" />
                          {pattern.ratingAverage.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {pattern.categories.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {pattern.categories.slice(0, 3).join(' / ')}
                      </p>
                    )}
                  </div>

                  {/* Import Button */}
                  <button
                    onClick={() => handleImport(pattern)}
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
                  >
                    <FiDownload className="h-4 w-4" />
                    Import Pattern
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <FiLoader className="h-6 w-6 text-purple-600 animate-spin" />
              <span className="ml-2 text-gray-500">Searching Ravelry...</span>
            </div>
          )}

          {/* Load More */}
          {!loading && results.length > 0 && page < totalPages && (
            <div className="text-center py-4">
              <button
                onClick={handleLoadMore}
                className="px-6 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition"
              >
                Load More Results
              </button>
            </div>
          )}
        </div>

        {/* Footer with attribution */}
        <div className="p-3 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Powered by Ravelry</p>
        </div>
      </div>
    </div>
  );
}
