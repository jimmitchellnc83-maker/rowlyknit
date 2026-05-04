import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';

/**
 * Forgot-password form.
 *
 * Enumeration-safe success: any 2xx from /request-password-reset shows
 * the same "if an account exists, we've sent a link" message — the
 * controller already returns 200 whether or not the email matches a
 * real user. We must NOT swallow real failures the same way, though,
 * or the user has no idea the form even tried (and rate-limit lockouts
 * masquerade as success). Live smoke after PR #381 caught this.
 *
 * Failure modes we surface:
 *   - 429 — too many requests (per-IP or per-email composite limiter)
 *   - 4xx other than 429 — validation / CSRF / origin failures
 *   - 5xx — server error
 *   - no response (transport error) — network down, DNS, proxy down
 *
 * Codex: enumeration safety is preserved because every "success" branch
 * shows the same wording regardless of whether the email exists.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setIsLoading(true);

    try {
      await axios.post('/api/auth/request-password-reset', { email });
      setSent(true);
      toast.success('If an account exists with this email, a reset link has been sent.');
    } catch (error) {
      const ax = error as AxiosError<{ message?: string }>;
      const status = ax.response?.status;
      const serverMessage = ax.response?.data?.message;

      let display: string;
      if (status === 429) {
        display =
          serverMessage ||
          'Too many password reset requests. Please wait a few minutes before trying again.';
      } else if (status && status >= 500) {
        display = "Something went wrong on our end. Please try again in a moment.";
      } else if (!ax.response) {
        // Transport failure — no response object at all.
        display = "Couldn't reach the server. Check your connection and try again.";
      } else if (status === 403) {
        // Most often a CSRF / same-origin issue — surface a hint that's
        // useful without leaking internals.
        display = serverMessage || 'Your session expired. Reload the page and try again.';
      } else {
        // Other 4xx (validator complaints, etc.) — show whatever the
        // backend said. We do NOT silently 200 the user out, because
        // they'll never realize the request didn't actually go through.
        display = serverMessage || 'Could not send reset link. Please try again.';
      }

      setErrorMessage(display);
      toast.error(display);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 transition-colors duration-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">Rowly</h1>
          <p className="text-gray-600 dark:text-gray-300">Reset your password</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 mb-6">
              <p className="text-green-800 dark:text-green-300 font-medium mb-2">Check your email</p>
              <p className="text-sm text-green-700 dark:text-green-400">
                If an account exists with <strong>{email}</strong>, we've sent a password reset link. It expires in 1 hour.
              </p>
            </div>
            <Link
              to="/login"
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium transition"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Enter the email address associated with your account and we'll send you a link to reset your password.
            </p>

            {errorMessage ? (
              <div
                role="alert"
                data-testid="forgot-password-error"
                className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
              >
                {errorMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  placeholder="you@example.com"
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-purple-600 dark:bg-purple-700 text-white py-2 px-4 rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 focus:ring-4 focus:ring-purple-300 dark:focus:ring-purple-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium transition">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
