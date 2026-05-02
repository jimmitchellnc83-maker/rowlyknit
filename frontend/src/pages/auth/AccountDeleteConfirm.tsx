import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../../stores/authStore';
import { formatDate } from '../../utils/formatDate';

type ConfirmStatus = 'idle' | 'confirming' | 'success' | 'error' | 'needs-login';

export default function AccountDeleteConfirm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState<ConfirmStatus>('idle');
  const [message, setMessage] = useState('');
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  // The confirm endpoint marks the token consumed on first call, so guard
  // against StrictMode / re-renders firing it twice and getting a 404.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!token) {
      setStatus('error');
      setMessage('No confirmation token in the link. Open the email and try again.');
      return;
    }
    if (!isAuthenticated) {
      setStatus('needs-login');
      return;
    }

    fired.current = true;
    setStatus('confirming');
    axios
      .post('/api/gdpr/deletion/confirm', { token })
      .then((response) => {
        const req = response.data?.data?.request;
        setScheduledFor(req?.scheduled_for ?? null);
        setMessage(response.data?.message ?? 'Deletion confirmed.');
        setStatus('success');
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'This confirmation link is invalid or has already been used.';
        setMessage(msg);
        setStatus('error');
      });
  }, [token, isAuthenticated]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 text-center transition-colors duration-200">
        <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-6">Rowly</h1>

        {status === 'idle' || status === 'confirming' ? (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Confirming your deletion request…</p>
          </div>
        ) : null}

        {status === 'needs-login' && (
          <div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 mb-6">
              <p className="text-yellow-800 dark:text-yellow-300 font-medium">
                Sign in to confirm your account deletion. We need you logged in to verify
                ownership of this account.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block bg-purple-600 text-white py-2 px-6 rounded-lg hover:bg-purple-700 transition font-medium"
            >
              Sign in
            </Link>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 mb-6">
              <div className="text-green-600 dark:text-green-400 text-5xl mb-3">&#10003;</div>
              <p className="text-green-800 dark:text-green-300 font-medium">{message}</p>
              {scheduledFor && (
                <p className="mt-2 text-sm text-green-700 dark:text-green-400">
                  Scheduled for <strong>{formatDate(scheduledFor)}</strong>.
                </p>
              )}
              <p className="mt-3 text-xs text-green-700 dark:text-green-400">
                Changed your mind? You can cancel from your Profile any time before then.
              </p>
            </div>
            <Link
              to="/profile?tab=privacy"
              className="inline-block bg-purple-600 text-white py-2 px-6 rounded-lg hover:bg-purple-700 transition font-medium"
            >
              Open Profile
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 mb-6">
              <div className="text-red-600 dark:text-red-400 text-5xl mb-3">&#10007;</div>
              <p className="text-red-800 dark:text-red-300 font-medium">{message}</p>
            </div>
            <Link
              to="/profile?tab=privacy"
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium transition"
            >
              Back to Privacy settings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
