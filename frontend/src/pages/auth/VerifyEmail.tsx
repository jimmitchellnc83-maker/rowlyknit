import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    const verify = async () => {
      try {
        const response = await axios.get(`/api/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Verification failed. The link may have expired.');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 text-center transition-colors duration-200">
        <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-6">Rowly</h1>

        {status === 'verifying' && (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 mb-6">
              <div className="text-green-600 dark:text-green-400 text-5xl mb-3">&#10003;</div>
              <p className="text-green-800 dark:text-green-300 font-medium">{message}</p>
            </div>
            <Link
              to="/login"
              className="inline-block bg-purple-600 text-white py-2 px-6 rounded-lg hover:bg-purple-700 transition font-medium"
            >
              Sign In
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
              to="/login"
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium transition"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
