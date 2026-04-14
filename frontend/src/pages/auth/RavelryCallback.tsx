import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiLoader } from 'react-icons/fi';
import axios from 'axios';

export default function RavelryCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      navigate('/profile?tab=integrations&ravelry=error', { replace: true });
      return;
    }

    const exchangeCode = async () => {
      try {
        await axios.post('/api/ravelry/oauth/callback', { code, state });
        navigate('/profile?tab=integrations&ravelry=connected', { replace: true });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to connect to Ravelry.');
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <button
            onClick={() => navigate('/profile?tab=integrations', { replace: true })}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Back to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <FiLoader className="h-8 w-8 text-purple-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 text-lg">Connecting to Ravelry...</p>
      </div>
    </div>
  );
}
