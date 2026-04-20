import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  FiLoader,
  FiRefreshCw,
  FiBookOpen,
  FiClock,
  FiExternalLink,
  FiArrowLeft,
} from 'react-icons/fi';

type BookmarkType = 'queue' | 'library';

interface Bookmark {
  id: string;
  type: BookmarkType;
  ravelry_id: number;
  pattern_ravelry_id: number | null;
  title: string;
  author: string | null;
  photo_url: string | null;
  source_type: string | null;
  position: number | null;
  notes: string | null;
  created_at: string;
}

interface BookmarksResponse {
  bookmarks: Bookmark[];
  pagination: {
    page: number;
    pageSize: number;
    totalResults: number;
    totalPages: number;
  };
}

const PAGE_SIZE = 50;

function ravelryPatternUrl(patternId: number | null): string | null {
  return patternId ? `https://www.ravelry.com/patterns/library/${patternId}` : null;
}

export default function RavelryBookmarks() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<BookmarkType | 'all'>('all');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const fetchBookmarks = useCallback(
    async (filter: BookmarkType | 'all', p: number) => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page: p, page_size: PAGE_SIZE };
        if (filter !== 'all') params.type = filter;
        const response = await axios.get<{ success: boolean; data: BookmarksResponse }>(
          '/api/ravelry/bookmarks',
          { params }
        );
        setBookmarks(response.data.data.bookmarks);
        setTotalPages(response.data.data.pagination.totalPages);
        setTotalResults(response.data.data.pagination.totalResults);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to load bookmarks');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchBookmarks(activeFilter, page);
  }, [activeFilter, page, fetchBookmarks]);

  const handleFilterChange = (f: BookmarkType | 'all') => {
    setActiveFilter(f);
    setPage(1);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Ravelry bookmarks
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Your queue (to-knit list) and library (purchased patterns + books) mirrored from
            Ravelry. Display-only — edits don't sync back.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/profile?tab=integrations')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={() => navigate('/ravelry/bookmarks/sync')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiRefreshCw className="h-4 w-4" />
            Sync from Ravelry
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
        <button
          onClick={() => handleFilterChange('all')}
          className={`py-2 px-4 rounded-md text-sm font-medium transition ${
            activeFilter === 'all'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          All
        </button>
        <button
          onClick={() => handleFilterChange('queue')}
          className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition ${
            activeFilter === 'queue'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <FiClock className="h-4 w-4" />
          Queue
        </button>
        <button
          onClick={() => handleFilterChange('library')}
          className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition ${
            activeFilter === 'library'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <FiBookOpen className="h-4 w-4" />
          Library
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <FiLoader className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <FiBookOpen className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No bookmarks yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Sync from Ravelry to see your queue and library here.
          </p>
          <button
            onClick={() => navigate('/ravelry/bookmarks/sync')}
            className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <FiRefreshCw className="h-4 w-4" />
            Sync from Ravelry
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {totalResults} bookmark{totalResults === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookmarks.map((b) => {
              const patternUrl = ravelryPatternUrl(b.pattern_ravelry_id);
              return (
                <div
                  key={b.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    {b.photo_url ? (
                      <img
                        src={b.photo_url}
                        alt={b.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <FiBookOpen className="h-12 w-12 text-gray-400" />
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {b.type === 'queue' ? (
                        <>
                          <FiClock className="h-3 w-3" />
                          Queue
                        </>
                      ) : (
                        <>
                          <FiBookOpen className="h-3 w-3" />
                          Library
                          {b.source_type ? ` · ${b.source_type}` : ''}
                        </>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                      {b.title}
                    </h3>
                    {b.author && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">by {b.author}</p>
                    )}
                    {patternUrl && (
                      <a
                        href={patternUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                      >
                        View on Ravelry
                        <FiExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
