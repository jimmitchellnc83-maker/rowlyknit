import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  FiDownload,
  FiAlertTriangle,
  FiTrash2,
  FiRefreshCw,
  FiX,
  FiClock,
  FiCheckCircle,
  FiXCircle,
} from 'react-icons/fi';
import { formatDate } from '../../utils/formatDate';

type ExportFormat = 'json' | 'csv';
type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';
type DeletionStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled';

interface ExportRequest {
  id: string;
  status: ExportStatus;
  format: ExportFormat;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
  error_message?: string | null;
}

interface DeletionRequestRow {
  id: string;
  status: DeletionStatus;
  scheduled_for: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  reason: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<ExportStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Queued',
    cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    icon: <FiClock className="h-3.5 w-3.5" />,
  },
  processing: {
    label: 'Building',
    cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />,
  },
  completed: {
    label: 'Ready',
    cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    icon: <FiCheckCircle className="h-3.5 w-3.5" />,
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: <FiXCircle className="h-3.5 w-3.5" />,
  },
};

export default function PrivacyTab() {
  const [exports, setExports] = useState<ExportRequest[]>([]);
  const [exportsLoading, setExportsLoading] = useState(true);
  const [requestingFormat, setRequestingFormat] = useState<ExportFormat>('json');
  const [requesting, setRequesting] = useState(false);

  const [deletion, setDeletion] = useState<DeletionRequestRow | null>(null);
  const [deletionLoading, setDeletionLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchExports = useCallback(async () => {
    try {
      const response = await axios.get('/api/gdpr/exports');
      setExports(response.data?.data?.requests ?? []);
    } catch {
      // Silent — empty list is the correct UI when fetch fails.
    } finally {
      setExportsLoading(false);
    }
  }, []);

  const fetchDeletion = useCallback(async () => {
    try {
      const response = await axios.get('/api/gdpr/deletion');
      setDeletion(response.data?.data?.request ?? null);
    } catch {
      // Silent — null is the correct empty state.
    } finally {
      setDeletionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExports();
    fetchDeletion();
  }, [fetchExports, fetchDeletion]);

  // Poll while any export is still building so the UI flips to "Ready"
  // without a manual refresh. Stops once nothing is in flight.
  useEffect(() => {
    const inFlight = exports.some((e) => e.status === 'pending' || e.status === 'processing');
    if (!inFlight) return;
    const t = setInterval(fetchExports, 5000);
    return () => clearInterval(t);
  }, [exports, fetchExports]);

  const handleRequestExport = async () => {
    setRequesting(true);
    try {
      await axios.post('/api/gdpr/exports', { format: requestingFormat });
      toast.success(
        `Export requested. We'll have your ${requestingFormat.toUpperCase()} file ready in a few seconds.`,
      );
      fetchExports();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to request export';
      toast.error(message);
    } finally {
      setRequesting(false);
    }
  };

  const handleDownload = async (req: ExportRequest) => {
    try {
      const response = await axios.get(`/api/gdpr/exports/${req.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rowly-export-${req.id}.${req.format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to download export';
      toast.error(message);
    }
  };

  const handleSubmitDeletion = async () => {
    setDeleteSubmitting(true);
    try {
      const response = await axios.post('/api/gdpr/deletion', {
        reason: deletionReason.trim() || null,
      });
      setDeletion(response.data?.data?.request ?? null);
      toast.success('Check your email to confirm the deletion.');
      setShowDeleteModal(false);
      setDeletionReason('');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to start deletion';
      toast.error(message);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleCancelDeletion = async () => {
    setCancelling(true);
    try {
      await axios.delete('/api/gdpr/deletion');
      setDeletion(null);
      toast.success('Deletion cancelled. Your account is safe.');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to cancel deletion';
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active deletion banner — surfaces grace-window state at the top
          so it's the first thing the user sees on the tab. */}
      {!deletionLoading && deletion && deletion.status !== 'completed' && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400" />
            <div className="flex-1">
              {deletion.status === 'pending' ? (
                <>
                  <p className="font-semibold text-orange-900 dark:text-orange-200">
                    Deletion email pending
                  </p>
                  <p className="mt-1 text-sm text-orange-800 dark:text-orange-300">
                    We sent a confirmation link to your email. Click it to start the 30-day grace
                    window. Until then, no data is removed.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-orange-900 dark:text-orange-200">
                    Account scheduled for deletion
                  </p>
                  <p className="mt-1 text-sm text-orange-800 dark:text-orange-300">
                    Your account will be permanently deleted on{' '}
                    <strong>{formatDate(deletion.scheduled_for)}</strong>. You can cancel any time
                    before then.
                  </p>
                </>
              )}
              <button
                onClick={handleCancelDeletion}
                disabled={cancelling}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-orange-700 shadow-sm hover:bg-orange-100 disabled:opacity-50 dark:bg-gray-800 dark:text-orange-300 dark:hover:bg-gray-700"
              >
                <FiX className="h-4 w-4" />
                {cancelling ? 'Cancelling…' : 'Cancel deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export your data */}
      <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Export your data
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Download a copy of your projects, patterns, yarn stash, recipients, and account
          metadata. Required by GDPR Article 15 — yours to keep regardless.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Format
            </label>
            <select
              value={requestingFormat}
              onChange={(e) => setRequestingFormat(e.target.value as ExportFormat)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="json">JSON (full fidelity)</option>
              <option value="csv">CSV (one file per table)</option>
            </select>
          </div>
          <button
            onClick={handleRequestExport}
            disabled={requesting}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 disabled:bg-gray-400"
          >
            <FiDownload className="h-4 w-4" />
            {requesting ? 'Requesting…' : 'Request export'}
          </button>
        </div>

        {/* History list */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent exports</h4>
          {exportsLoading ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : exports.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No exports yet. Request one above and we&rsquo;ll build it in the background.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
              {exports.map((req) => {
                const badge = STATUS_BADGE[req.status];
                const expired =
                  req.expires_at && new Date(req.expires_at).getTime() < Date.now();
                return (
                  <li key={req.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {req.format.toUpperCase()} export
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Requested {formatDate(req.created_at)}
                        {req.expires_at && req.status === 'completed' && !expired && (
                          <> · Expires {formatDate(req.expires_at)}</>
                        )}
                        {expired && <> · Expired</>}
                      </p>
                      {req.status === 'failed' && req.error_message && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {req.error_message}
                        </p>
                      )}
                    </div>
                    {req.status === 'completed' && !expired && (
                      <button
                        onClick={() => handleDownload(req)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
                      >
                        <FiDownload className="h-3.5 w-3.5" />
                        Download
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Delete your account */}
      <section className="rounded-lg border-2 border-red-200 bg-white p-6 shadow dark:border-red-900/40 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
          Delete your account
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Permanently remove your account and every project, pattern, yarn, photo, and note we
          hold for you. After confirming via email, you have a 30-day grace window to change your
          mind.
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Required by GDPR Article 17 — the &ldquo;right to be forgotten.&rdquo;
        </p>

        {!deletion || deletion.status === 'completed' || deletion.status === 'cancelled' ? (
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={deletionLoading}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <FiTrash2 className="h-4 w-4" />
            Delete my account…
          </button>
        ) : (
          <p className="mt-4 text-sm italic text-gray-500 dark:text-gray-400">
            A deletion request is already in progress (see banner above).
          </p>
        )}
      </section>

      {/* Confirm deletion modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => !deleteSubmitting && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-600" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Delete your account?
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  We&rsquo;ll send a confirmation link to your email. Once you click it, your
                  account enters a 30-day grace window — you can cancel any time before deletion
                  runs.
                </p>
                <label className="mt-4 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Why are you leaving? <span className="font-normal text-gray-500">(optional, helps us improve)</span>
                </label>
                <textarea
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Anything you wish worked better…"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Keep my account
              </button>
              <button
                onClick={handleSubmitDeletion}
                disabled={deleteSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-400"
              >
                <FiTrash2 className="h-4 w-4" />
                {deleteSubmitting ? 'Sending…' : 'Send confirmation email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
