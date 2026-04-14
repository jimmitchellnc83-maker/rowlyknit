import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiDownload, FiStar, FiLoader, FiLink } from 'react-icons/fi';
import axios from 'axios';

interface RavelryYarn {
  id: number;
  name: string;
  brand: string;
  weight: string | null;
  fiberContent: string | null;
  yardage: number | null;
  grams: number | null;
  ratingAverage: number | null;
  ratingCount: number | null;
  photoUrl: string | null;
}

interface RavelryYarnSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (yarnData: {
    brand: string;
    name: string;
    weight: string;
    fiberContent: string;
    yardsTotal: string;
  }) => void;
}

export default function RavelryYarnSearch({ isOpen, onClose, onImport }: RavelryYarnSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RavelryYarn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [ravelryConnected, setRavelryConnected] = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchYarns = useCallback(async (searchQuery: string, searchPage: number) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotalPages(0);
      setTotalResults(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('/api/ravelry/yarns/search', {
        params: {
          query: searchQuery,
          page: searchPage,
          page_size: 20,
        },
      });

      if (response.data.success) {
        const { yarns, pagination } = response.data.data;
        if (searchPage === 1) {
          setResults(yarns);
        } else {
          setResults((prev) => [...prev, ...yarns]);
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
      setRavelryConnected(null);
      return;
    }

    // Check Ravelry connection status
    const checkConnection = async () => {
      try {
        const response = await axios.get('/api/ravelry/oauth/status');
        setRavelryConnected(response.data.data.connected);
      } catch {
        setRavelryConnected(false);
      }
    };
    checkConnection();

    // Focus the search input when modal opens
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
      searchYarns(query, 1);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchYarns]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    searchYarns(query, nextPage);
  };

  const handleImport = (yarn: RavelryYarn) => {
    // Map Ravelry weight names to the app's weight values
    const weightMap: Record<string, string> = {
      'Lace': 'lace',
      'Light Fingering': 'fingering',
      'Fingering': 'fingering',
      'Sport': 'sport',
      'DK': 'dk',
      'Worsted': 'worsted',
      'Aran': 'worsted',
      'Bulky': 'bulky',
      'Super Bulky': 'super-bulky',
      'Jumbo': 'super-bulky',
    };

    const mappedWeight = yarn.weight ? (weightMap[yarn.weight] || 'worsted') : 'worsted';

    onImport({
      brand: yarn.brand || '',
      name: yarn.name || '',
      weight: mappedWeight,
      fiberContent: yarn.fiberContent || '',
      yardsTotal: yarn.yardage ? String(yarn.yardage) : '',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Search Ravelry Yarns</h2>
            <p className="text-sm text-gray-500 mt-1">Find yarn details and import them to your stash</p>
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
              placeholder="Search for yarn (e.g., Malabrigo Rios, Cascade 220...)"
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
          {ravelryConnected === false && (
            <div className="text-center py-12">
              <FiLink className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-600 mb-2">Connect your Ravelry account to search yarns</p>
              <button
                onClick={() => { onClose(); navigate('/profile?tab=integrations'); }}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Connect to Ravelry
              </button>
            </div>
          )}

          {ravelryConnected === null && (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="h-6 w-6 text-purple-600 animate-spin" />
            </div>
          )}

          {ravelryConnected && error && (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => searchYarns(query, 1)}
                className="mt-2 text-purple-600 hover:text-purple-800 text-sm"
              >
                Try again
              </button>
            </div>
          )}

          {ravelryConnected && !error && results.length === 0 && !loading && query && (
            <div className="text-center py-12 text-gray-500">
              No yarns found matching your search.
            </div>
          )}

          {ravelryConnected && !error && results.length === 0 && !loading && !query && (
            <div className="text-center py-12 text-gray-400">
              <FiSearch className="mx-auto h-12 w-12 mb-3" />
              <p>Start typing to search the Ravelry yarn database</p>
            </div>
          )}

          <div className="space-y-3">
            {results.map((yarn) => (
              <div
                key={yarn.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:bg-purple-50/30 transition"
              >
                <div className="flex items-start gap-4">
                  {/* Photo */}
                  {yarn.photoUrl && (
                    <img
                      src={yarn.photoUrl}
                      alt={yarn.name}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  {!yarn.photoUrl && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-xs">No photo</span>
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {yarn.brand && <span className="text-gray-600">{yarn.brand} </span>}
                      {yarn.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {yarn.weight && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          {yarn.weight}
                        </span>
                      )}
                      {yarn.yardage && (
                        <span className="text-xs text-gray-500">
                          {yarn.yardage} yds/skein
                        </span>
                      )}
                      {yarn.grams && (
                        <span className="text-xs text-gray-500">
                          {yarn.grams}g
                        </span>
                      )}
                      {yarn.ratingAverage && (
                        <span className="text-xs text-gray-500 flex items-center gap-0.5">
                          <FiStar className="h-3 w-3" />
                          {yarn.ratingAverage.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {yarn.fiberContent && (
                      <p className="text-sm text-gray-500 mt-1 truncate">{yarn.fiberContent}</p>
                    )}
                  </div>

                  {/* Import Button */}
                  <button
                    onClick={() => handleImport(yarn)}
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
                  >
                    <FiDownload className="h-4 w-4" />
                    Import to Stash
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
