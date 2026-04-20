import { useState, useEffect, useCallback } from 'react';
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
  FiBookOpen,
} from 'react-icons/fi';

type Phase = 'idle' | 'running' | 'done' | 'error';

interface PageResult {
  imported: number;
  skipped: number;
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
}

interface Totals {
  imported: number;
  skipped: number;
}

const PAGE_SIZE = 50;
const MAX_PAGES = 30;

async function importAllPages(endpoint: string): Promise<Totals> {
  let imported = 0;
  let skipped = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await axios.post<{ success: boolean; data: PageResult }>(
      endpoint,
      {},
      { params: { page, page_size: PAGE_SIZE } }
    );
    const pageResult = response.data.data;
    imported += pageResult.imported;
    skipped += pageResult.skipped;
    if (page >= pageResult.totalPages) break;
  }
  return { imported, skipped };
}

export default function RavelryBookmarksSync() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('idle');
  const [oauthRequired, setOAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusLabel, setStatusLabel] = useState<string>('');
  const [queueTotals, setQueueTotals] = useState<Totals>({ imported: 0, skipped: 0 });
  const [libraryTotals, setLibraryTotals] = useState<Totals>({ imported: 0, skipped: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkOAuthStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/ravelry/oauth/status');
      setOAuthRequired(!response.data?.data?.connected);
    } catch {
      setOAuthRequired(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkOAuthStatus();
  }, [checkOAuthStatus]);

  const handleImport = async () => {
    setPhase('running');
    setErrorMessage(null);
    setQueueTotals({ imported: 0, skipped: 0 });
    setLibraryTotals({ imported: 0, skipped: 0 });

    try {
      setStatusLabel('Importing queue…');
      const queue = await importAllPages('/api/ravelry/queue/import');
      setQueueTotals(queue);

      setStatusLabel('Importing library…');
      const library = await importAllPages('/api/ravelry/library/import');
      setLibraryTotals(library);

      setPhase('done');
      const total = queue.imported + library.imported;
      if (total > 0) {
        toast.success(
          `Imported ${queue.imported} queue + ${library.imported} library item${total === 1 ? '' : 's'} from Ravelry.`
        );
      } else {
        toast.info('Your Ravelry bookmarks are already in Rowly — nothing new to import.');
      }
    } catch (err: any) {
      if (err.response?.data?.code === 'RAVELRY_OAUTH_REQUIRED' || err.response?.status === 403) {
        setOAuthRequired(true);
      }
      const message = err.response?.data?.message || err.message || 'Bookmarks import failed';
      setErrorMessage(message);
      setPhase('error');
      toast.error(`Bookmarks import failed: ${message}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Sync bookmarks from Ravelry
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Bulk-import your Ravelry queue (to-knit list) and library (purchased patterns + books)
            into Rowly. Already-imported items are skipped.
          </p>
        </div>
        <button
          onClick={() => navigate('/ravelry/bookmarks')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <FiArrowLeft className="h-4 w-4" />
          View bookmarks
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <FiLoader className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      )}

      {!loading && oauthRequired && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FiLink className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Connect your Ravelry account
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You'll need to link your Ravelry account before your bookmarks can be imported.
          </p>
          <button
            onClick={() => navigate('/profile?tab=integrations')}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Connect to Ravelry
          </button>
        </div>
      )}

      {!loading && !oauthRequired && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          {phase === 'idle' && (
            <div className="text-center">
              <FiBookOpen className="mx-auto h-16 w-16 text-purple-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Ready to import
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Pulls both your queue and library in one pass. Progress shown live.
              </p>
              <button
                onClick={handleImport}
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <FiRefreshCw className="h-4 w-4" />
                Import my Ravelry bookmarks
              </button>
            </div>
          )}

          {phase === 'running' && (
            <div className="text-center">
              <FiLoader className="mx-auto h-12 w-12 text-purple-500 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {statusLabel}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Queue: {queueTotals.imported} new · {queueTotals.skipped} already in Rowly
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Library: {libraryTotals.imported} new · {libraryTotals.skipped} already in Rowly
              </p>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center">
              <FiCheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Import complete
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-1">
                Queue: {queueTotals.imported} new
                {queueTotals.skipped > 0 && ` · ${queueTotals.skipped} already existed`}.
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Library: {libraryTotals.imported} new
                {libraryTotals.skipped > 0 && ` · ${libraryTotals.skipped} already existed`}.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/ravelry/bookmarks')}
                  className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Browse bookmarks
                </button>
                <button
                  onClick={handleImport}
                  className="px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Run again
                </button>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="text-center">
              <FiAlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Import failed
              </h3>
              <p className="text-red-600 dark:text-red-400 mb-4">{errorMessage}</p>
              {(queueTotals.imported > 0 || libraryTotals.imported > 0) && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {queueTotals.imported} queue + {libraryTotals.imported} library item
                  {queueTotals.imported + libraryTotals.imported === 1 ? '' : 's'} imported before
                  the failure.
                </p>
              )}
              <button
                onClick={handleImport}
                className="inline-flex items-center gap-2 px-5 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
              >
                <FiRefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
