import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setIsLoading(true);

    try {
      await axios.post('/api/auth/request-password-reset', { email });
      setSent(true);
      toast.success('If an account exists with this email, a reset link has been sent.');
    } catch (error: any) {
      // Still show success to prevent email enumeration
      setSent(true);
      toast.success('If an account exists with this email, a reset link has been sent.');
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
