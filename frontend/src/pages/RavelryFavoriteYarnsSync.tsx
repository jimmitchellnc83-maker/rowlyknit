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
  FiHeart,
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

const PAGE_SIZE = 50;
const MAX_PAGES = 30;

export default function RavelryFavoriteYarnsSync() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('idle');
  const [oauthRequired, setOAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importedTotal, setImportedTotal] = useState(0);
  const [skippedTotal, setSkippedTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);
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
    setImportedTotal(0);
    setSkippedTotal(0);
    setCurrentPage(0);
    setTotalPages(null);
    setTotalResults(null);
    setErrorMessage(null);

    let importedRunning = 0;
    let skippedRunning = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      setCurrentPage(page);
      try {
        const response = await axios.post<{ success: boolean; data: PageResult }>(
          '/api/ravelry/favorites/yarns/import',
          {},
          { params: { page, page_size: PAGE_SIZE } }
        );
        const pageResult = response.data.data;
        importedRunning += pageResult.imported;
        skippedRunning += pageResult.skipped;
        setImportedTotal(importedRunning);
        setSkippedTotal(skippedRunning);
        setTotalPages(pageResult.totalPages);
        setTotalResults(pageResult.totalResults);

        if (page >= pageResult.totalPages) break;
      } catch (err: any) {
        if (err.response?.data?.code === 'RAVELRY_OAUTH_REQUIRED' || err.response?.status === 403) {
          setOAuthRequired(true);
        }
        const message = err.response?.data?.message || err.message || 'Favorite yarns import failed';
        setErrorMessage(`Page ${page}: ${message}`);
        setPhase('error');
        toast.error(`Favorite yarns import failed on page ${page}: ${message}`);
        return;
      }
    }

    setPhase('done');
    if (importedRunning > 0) {
      toast.success(
        `Imported ${importedRunning} favorited yarn${importedRunning === 1 ? '' : 's'} from Ravelry.`
      );
    } else {
      toast.info('Your Ravelry favorited yarns are already in Rowly — nothing new to import.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Sync favorited yarns from Ravelry
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Bulk-import the yarns you've hearted on Ravelry into your Rowly yarn list as wishlist
            items. Already-imported yarns are skipped so your local edits stay intact.
          </p>
        </div>
        <button
          onClick={() => navigate('/yarn')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to Yarn
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
            You'll need to link your Ravelry account before your favorited yarns can be imported.
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
              <FiHeart className="mx-auto h-16 w-16 text-purple-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Ready to import
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Click below to fetch the yarns you've favorited on Ravelry. They'll appear in your
                yarn list with the heart toggled on, and with skeins set to zero until you buy them.
              </p>
              <button
                onClick={handleImport}
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <FiRefreshCw className="h-4 w-4" />
                Import my favorited yarns
              </button>
            </div>
          )}

          {phase === 'running' && (
            <div className="text-center">
              <FiLoader className="mx-auto h-12 w-12 text-purple-500 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Importing…
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Page {currentPage}
                {totalPages ? ` of ${totalPages}` : ''}
                {totalResults ? ` · ${totalResults} favorited on Ravelry` : ''}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {importedTotal} new · {skippedTotal} already in Rowly
              </p>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center">
              <FiCheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Import complete
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {importedTotal} yarn{importedTotal === 1 ? '' : 's'} added as favorites
                {skippedTotal > 0 && ` · ${skippedTotal} already existed, skipped`}.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/yarn?favorite=true')}
                  className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  View favorited yarns
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
              {importedTotal > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {importedTotal} yarn{importedTotal === 1 ? '' : 's'} imported before the failure —
                  already saved.
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
