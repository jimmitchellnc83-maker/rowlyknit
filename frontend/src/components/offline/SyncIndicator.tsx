import React, { useState } from 'react';
import { FiCloud, FiCloudOff, FiRefreshCw, FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';
import { syncManager, SyncStatus } from '../../utils/offline/syncManager';

export const SyncIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [failedItems, setFailedItems] = useState<any[]>([]);

  // Update online status
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to sync status updates
  React.useEffect(() => {
    const unsubscribe = syncManager.onSyncStatusChange((status) => {
      setSyncStatus(status);
    });

    // Get initial status
    syncManager.getSyncStatus().then(setSyncStatus);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleManualSync = async () => {
    try {
      await syncManager.sync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  const handleRetryFailed = async () => {
    try {
      await syncManager.retryFailed();
      setShowDetails(false);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const handleShowDetails = async () => {
    setShowDetails(true);
    const items = await syncManager.getFailedItems();
    setFailedItems(items);
  };

  // Determine indicator color and icon
  const getStatusColor = () => {
    if (!isOnline) return 'text-gray-500';
    if (syncStatus.failedCount > 0) return 'text-red-600';
    if (syncStatus.pendingCount > 0) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <FiCloudOff className="w-5 h-5" />;
    if (syncStatus.isSyncing) return <FiRefreshCw className="w-5 h-5 animate-spin" />;
    if (syncStatus.failedCount > 0) return <FiAlertCircle className="w-5 h-5" />;
    if (syncStatus.pendingCount > 0) return <FiCloud className="w-5 h-5" />;
    return <FiCheckCircle className="w-5 h-5" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncStatus.isSyncing) return 'Syncing...';
    if (syncStatus.failedCount > 0)
      return `${syncStatus.failedCount} failed`;
    if (syncStatus.pendingCount > 0)
      return `${syncStatus.pendingCount} pending`;
    return 'Synced';
  };

  return (
    <>
      {/* Sync Indicator Button */}
      <button
        onClick={isOnline ? handleManualSync : undefined}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          isOnline
            ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
            : 'cursor-not-allowed opacity-70'
        }`}
        title={isOnline ? 'Click to sync now' : 'Device is offline'}
      >
        <span className={getStatusColor()}>{getStatusIcon()}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getStatusText()}
        </span>
      </button>

      {/* Failed Items Details Link */}
      {syncStatus.failedCount > 0 && (
        <button
          onClick={handleShowDetails}
          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 underline ml-2"
        >
          View failed items
        </button>
      )}

      {/* Failed Items Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FiAlertCircle className="w-6 h-6 text-red-600" />
                Sync Conflicts
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The following changes could not be synced after {3} attempts. You can retry
              syncing or resolve them manually.
            </p>

            {failedItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FiCheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No failed items</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {failedItems.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {item.type}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {item.method} {item.endpoint}
                        </div>
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400">
                        {item.retries} retries
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Timestamp: {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDetails(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleRetryFailed}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Retry All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
