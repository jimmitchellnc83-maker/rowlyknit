import { useState, useEffect } from 'react';
import { FiWifiOff, FiWifi } from 'react-icons/fi';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner && isOnline) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        showBanner ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div
        className={`px-4 py-3 text-center text-white font-medium ${
          isOnline ? 'bg-green-600' : 'bg-orange-600'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          {isOnline ? (
            <>
              <FiWifi className="h-5 w-5" />
              <span>Back online! Your changes will sync automatically.</span>
            </>
          ) : (
            <>
              <FiWifiOff className="h-5 w-5" />
              <span>You're offline. Changes will sync when you reconnect.</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
