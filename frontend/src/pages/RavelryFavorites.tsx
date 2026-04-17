import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  FiHeart,
  FiLink,
  FiLoader,
  FiDownload,
  FiCheckCircle,
  FiAlertCircle,
  FiStar,
  FiArrowLeft,
} from 'react-icons/fi';
import {
  importRavelryPatternToRowly,
  extractRavelryIdFromSourceUrl,
  type RavelryPattern,
} from '../lib/ravelryImport';

type ImportStatus = 'idle' | 'importing' | 'imported' | 'error';

interface RowRecord {
  pattern: RavelryPattern;
  status: ImportStatus;
  errorMessage?: string;
}

export default function RavelryFavorites() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<RowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthRequired, setOAuthRequired] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [existingRavelryIds, setExistingRavelryIds] = useState<Set<number>>(new Set());

  const loadPage = useCallback(
    async (pageNum: number) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const response = await axios.get('/api/ravelry/favorites', {
          params: { page: pageNum, page_size: 24 },
        });

        if (response.data?.success) {
          const { patterns, pagination } = response.data.data as {
            patterns: RavelryPattern[];
            pagination: { page: number; pageSize: number; totalResults: number; totalPages: number };
          };
          setTotalPages(pagination.totalPages || 1);
          setTotalResults(pagination.totalResults || 0);

          const newRows: RowRecord[] = patterns.map((p) => ({ pattern: p, status: 'idle' }));
          setRows((prev) => (pageNum === 1 ? newRows : [...prev, ...newRows]));
        }
      } catch (err: any) {
        if (err.response?.data?.code === 'RAVELRY_OAUTH_REQUIRED' || err.response?.status === 403) {
          setOAuthRequired(true);
        } else {
          setError(err.response?.data?.message || 'Failed to load Ravelry favorites.');
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  const loadExistingImports = useCallback(async () => {
    // Best-effort dupe detection. /api/patterns caps `limit` at 100, so we page
    // through until we run out of results or we exhaust Rowly's pagination.
    try {
      const ids = new Set<number>();
      let page = 1;
      let totalPages = 1;
      do {
        const response = await axios.get('/api/patterns', { params: { limit: 100, page } });
        const patterns: Array<{ source_url?: string | null }> = response.data?.data?.patterns || [];
        for (const p of patterns) {
          const id = extractRavelryIdFromSourceUrl(p.source_url);
          if (id) ids.add(id);
        }
        totalPages = response.data?.data?.pagination?.totalPages || 1;
        page += 1;
      } while (page <= totalPages && page <= 10); // hard cap at 10 pages
      setExistingRavelryIds(ids);
    } catch {
      // Non-fatal — dupe detection is best-effort
    }
  }, []);

  useEffect(() => {
    loadExistingImports();
    loadPage(1);
  }, [loadExistingImports, loadPage]);

  const handleImport = async (index: number) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status: 'importing', errorMessage: undefined };
      return next;
    });

    try {
      await importRavelryPatternToRowly(rows[index].pattern, { fetchDetail: true });
      setRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'imported' };
        return next;
      });
      setExistingRavelryIds((prev) => {
        const next = new Set(prev);
        next.add(rows[index].pattern.id);
        return next;
      });
      toast.success(`Imported "${rows[index].pattern.name}" to your pattern library`);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Import failed';
      setRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'error', errorMessage: message };
        return next;
      });
      toast.error(`Failed to import "${rows[index].pattern.name}": ${message}`);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Ravelry Favorites</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Patterns you've favorited on Ravelry. Click Import to add one to your Rowly library.
          </p>
        </div>
        <button
          onClick={() => navigate('/patterns')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to Patterns
        </button>
      </div>

      {oauthRequired && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FiLink className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Connect your Ravelry account
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You'll need to link your Ravelry account before your favorites can be loaded.
          </p>
          <button
            onClick={() => navigate('/profile?tab=integrations')}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Connect to Ravelry
          </button>
        </div>
      )}

      {!oauthRequired && loading && (
        <div className="flex items-center justify-center py-16">
          <FiLoader className="h-8 w-8 text-purple-600 animate-spin" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading your favorites...</span>
        </div>
      )}

      {!oauthRequired && !loading && error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <FiAlertCircle className="mx-auto h-10 w-10 text-red-500 mb-3" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => loadPage(1)}
            className="px-4 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition"
          >
            Try again
          </button>
        </div>
      )}

      {!oauthRequired && !loading && !error && rows.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FiHeart className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No favorites yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Favorite some patterns on Ravelry and they'll show up here.
          </p>
        </div>
      )}

      {!oauthRequired && !loading && !error && rows.length > 0 && (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Showing {rows.length} of {totalResults.toLocaleString()} favorites
          </p>
          <div className="space-y-3">
            {rows.map((row, index) => {
              const { pattern } = row;
              const alreadyExists =
                row.status !== 'imported' && existingRavelryIds.has(pattern.id);
              return (
                <div
                  key={pattern.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-600 transition"
                >
                  <div className="flex items-start gap-4">
                    {pattern.photoSquareUrl || pattern.photoUrl ? (
                      <img
                        src={pattern.photoSquareUrl || pattern.photoUrl || ''}
                        alt={pattern.name}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-400 text-xs">No photo</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {pattern.name}
                      </h3>
                      {pattern.designer && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          by {pattern.designer}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {pattern.yarnWeight && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                            {pattern.yarnWeight}
                          </span>
                        )}
                        {pattern.ratingAverage != null && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                            <FiStar className="h-3 w-3" />
                            {pattern.ratingAverage.toFixed(1)}
                          </span>
                        )}
                        {pattern.categories.length > 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {pattern.categories.slice(0, 3).join(' / ')}
                          </span>
                        )}
                      </div>
                      {row.status === 'error' && row.errorMessage && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                          {row.errorMessage}
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {row.status === 'imported' || alreadyExists ? (
                        <span className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-sm rounded-lg">
                          <FiCheckCircle className="h-4 w-4" />
                          Imported
                        </span>
                      ) : row.status === 'importing' ? (
                        <span className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300 text-sm rounded-lg">
                          <FiLoader className="h-4 w-4 animate-spin" />
                          Importing...
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImport(index)}
                          className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
                        >
                          <FiDownload className="h-4 w-4" />
                          Import
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {page < totalPages && (
            <div className="text-center py-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
