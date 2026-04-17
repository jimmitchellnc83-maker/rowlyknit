import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  FiRefreshCw,
  FiLink,
  FiLoader,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowLeft,
} from 'react-icons/fi';
import {
  importRavelryPatternToRowly,
  extractRavelryIdFromSourceUrl,
  type RavelryPattern,
} from '../lib/ravelryImport';

type ImportStatus = 'pending' | 'imported' | 'importing' | 'error';

interface Row {
  pattern: RavelryPattern;
  status: ImportStatus;
  errorMessage?: string;
}

// Cap the number of favorites we pull — prevents unbounded Ravelry API paging
// and keeps the page responsive. Users can run Sync multiple times.
const MAX_FAVORITES = 200;
const PAGE_SIZE = 50;

export default function RavelrySync() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [oauthRequired, setOAuthRequired] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const loadFavoritesAndExistingImports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch existing Rowly patterns first so we can mark Ravelry IDs already imported.
      // /api/patterns caps `limit` at 100, so page through up to 10 pages.
      const existingRavelryIds = new Set<number>();
      try {
        let existingPage = 1;
        let totalPages = 1;
        do {
          const existingResp = await axios.get('/api/patterns', {
            params: { limit: 100, page: existingPage },
          });
          const patterns: Array<{ source_url?: string | null }> =
            existingResp.data?.data?.patterns || [];
          for (const p of patterns) {
            const id = extractRavelryIdFromSourceUrl(p.source_url);
            if (id) existingRavelryIds.add(id);
          }
          totalPages = existingResp.data?.data?.pagination?.totalPages || 1;
          existingPage += 1;
        } while (existingPage <= totalPages && existingPage <= 10);
      } catch {
        // Non-fatal — dupe detection is best-effort.
      }

      // Page through favorites up to MAX_FAVORITES.
      let allFavorites: RavelryPattern[] = [];
      let currentPage = 1;
      let totalPages = 1;
      do {
        const resp = await axios.get('/api/ravelry/favorites', {
          params: { page: currentPage, page_size: PAGE_SIZE },
        });
        if (!resp.data?.success) break;
        const { patterns, pagination } = resp.data.data as {
          patterns: RavelryPattern[];
          pagination: { totalPages: number };
        };
        allFavorites = [...allFavorites, ...patterns];
        totalPages = pagination.totalPages || 1;
        currentPage += 1;
      } while (currentPage <= totalPages && allFavorites.length < MAX_FAVORITES);

      if (allFavorites.length > MAX_FAVORITES) {
        allFavorites = allFavorites.slice(0, MAX_FAVORITES);
      }

      const newRows: Row[] = allFavorites.map((pattern) => ({
        pattern,
        status: existingRavelryIds.has(pattern.id) ? 'imported' : 'pending',
      }));
      setRows(newRows);
    } catch (err: any) {
      if (err.response?.data?.code === 'RAVELRY_OAUTH_REQUIRED' || err.response?.status === 403) {
        setOAuthRequired(true);
      } else {
        setError(err.response?.data?.message || 'Failed to load Ravelry favorites.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavoritesAndExistingImports();
  }, [loadFavoritesAndExistingImports]);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows]);
  const importedCount = useMemo(() => rows.filter((r) => r.status === 'imported').length, [rows]);

  const handleSyncAll = async () => {
    if (pendingCount === 0 || syncing) return;
    setSyncing(true);
    setSyncedCount(0);
    setFailedCount(0);

    let syncedLocal = 0;
    let failedLocal = 0;

    // Sequentially so we don't pound the backend or Ravelry rate limits.
    for (let i = 0; i < rows.length; i++) {
      // Snapshot the row — state may have been updated but we iterate over the
      // original list and update by index.
      const current = rows[i];
      if (current.status !== 'pending') continue;

      setRows((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'importing' };
        return next;
      });

      try {
        // fetchDetail:false to avoid per-item detail calls that would hit the
        // Ravelry rate limiter (30/min). The compact data from favorites is enough
        // for a basic pattern record — users can open and enrich individually later.
        await importRavelryPatternToRowly(current.pattern, { fetchDetail: false });
        syncedLocal += 1;
        setRows((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'imported' };
          return next;
        });
        setSyncedCount(syncedLocal);
      } catch (err: any) {
        failedLocal += 1;
        const message = err.response?.data?.message || err.message || 'Import failed';
        setRows((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error', errorMessage: message };
          return next;
        });
        setFailedCount(failedLocal);
      }
    }

    setSyncing(false);
    if (failedLocal === 0 && syncedLocal > 0) {
      toast.success(`Synced ${syncedLocal} pattern${syncedLocal === 1 ? '' : 's'} from Ravelry`);
    } else if (syncedLocal > 0 && failedLocal > 0) {
      toast.info(`Synced ${syncedLocal}, ${failedLocal} failed. See list below for details.`);
    } else if (syncedLocal === 0 && failedLocal > 0) {
      toast.error(`Sync failed — ${failedLocal} pattern${failedLocal === 1 ? '' : 's'} could not be imported.`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sync from Ravelry</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Bulk-import your Ravelry favorite patterns into your Rowly library.
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
            You'll need to link your Ravelry account before your favorites can be synced.
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
          <span className="ml-3 text-gray-500 dark:text-gray-400">
            Loading your Ravelry favorites...
          </span>
        </div>
      )}

      {!oauthRequired && !loading && error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <FiAlertCircle className="mx-auto h-10 w-10 text-red-500 mb-3" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={loadFavoritesAndExistingImports}
            className="px-4 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition"
          >
            Try again
          </button>
        </div>
      )}

      {!oauthRequired && !loading && !error && rows.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FiRefreshCw className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No favorites found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Add some favorites on Ravelry and click Refresh to try again.
          </p>
          <button
            onClick={loadFavoritesAndExistingImports}
            className="mt-4 px-4 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition"
          >
            Refresh
          </button>
        </div>
      )}

      {!oauthRequired && !loading && !error && rows.length > 0 && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Your Ravelry library</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {rows.length} favorite{rows.length === 1 ? '' : 's'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {importedCount} already in Rowly · {pendingCount} ready to sync
                </p>
                {syncing && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                    Syncing: {syncedCount} imported, {failedCount} failed…
                  </p>
                )}
              </div>
              <button
                onClick={handleSyncAll}
                disabled={pendingCount === 0 || syncing}
                className="flex items-center gap-2 px-5 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <FiLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <FiRefreshCw className="h-4 w-4" />
                )}
                {syncing
                  ? 'Syncing...'
                  : pendingCount === 0
                    ? 'Nothing to sync'
                    : `Sync ${pendingCount} pattern${pendingCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((row, index) => {
              const { pattern, status, errorMessage } = row;
              return (
                <div key={pattern.id} className="flex items-center gap-4 p-4">
                  {pattern.photoSquareUrl || pattern.photoUrl ? (
                    <img
                      src={pattern.photoSquareUrl || pattern.photoUrl || ''}
                      alt={pattern.name}
                      className="w-12 h-12 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {pattern.name}
                    </p>
                    {pattern.designer && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        by {pattern.designer}
                      </p>
                    )}
                    {status === 'error' && errorMessage && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errorMessage}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {status === 'imported' && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-xs rounded">
                        <FiCheckCircle className="h-3.5 w-3.5" />
                        Imported
                      </span>
                    )}
                    {status === 'importing' && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300 text-xs rounded">
                        <FiLoader className="h-3.5 w-3.5 animate-spin" />
                        Importing
                      </span>
                    )}
                    {status === 'pending' && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-400 text-xs rounded">
                        Ready
                      </span>
                    )}
                    {status === 'error' && (
                      <button
                        onClick={async () => {
                          setRows((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index], status: 'importing', errorMessage: undefined };
                            return next;
                          });
                          try {
                            await importRavelryPatternToRowly(row.pattern, { fetchDetail: false });
                            setRows((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], status: 'imported' };
                              return next;
                            });
                          } catch (err: any) {
                            setRows((prev) => {
                              const next = [...prev];
                              next[index] = {
                                ...next[index],
                                status: 'error',
                                errorMessage: err.response?.data?.message || err.message || 'Retry failed',
                              };
                              return next;
                            });
                          }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 border border-red-300 text-red-600 text-xs rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        <FiAlertCircle className="h-3.5 w-3.5" />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
