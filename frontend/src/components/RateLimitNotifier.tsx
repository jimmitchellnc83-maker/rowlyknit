import { useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * RateLimitNotifier Component
 *
 * Listens for rate limit events from the axios interceptor
 * and displays user-friendly toast notifications
 */
export const RateLimitNotifier = () => {
  useEffect(() => {
    const handleRateLimitExceeded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { message, tier, limit, retryAfter } = customEvent.detail;

      // Format retry time
      let retryMessage = '';
      if (retryAfter) {
        const minutes = Math.ceil(retryAfter / 60);
        const seconds = retryAfter % 60;

        if (minutes > 0) {
          retryMessage = minutes === 1 ? '1 minute' : `${minutes} minutes`;
        } else {
          retryMessage = seconds === 1 ? '1 second' : `${seconds} seconds`;
        }
      }

      // Show user-friendly toast
      toast.warning(
        <div>
          <strong>Rate Limit Reached</strong>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
            {message || `You've reached your ${tier} tier limit of ${limit} requests.`}
          </p>
          {retryMessage && (
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
              Please wait {retryMessage} before trying again.
            </p>
          )}
        </div>,
        {
          autoClose: retryAfter ? Math.min(retryAfter * 1000, 10000) : 5000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
    };

    // Listen for rate limit events
    window.addEventListener('rate-limit-exceeded', handleRateLimitExceeded);

    // Cleanup
    return () => {
      window.removeEventListener('rate-limit-exceeded', handleRateLimitExceeded);
    };
  }, []);

  // This component doesn't render anything
  return null;
};
