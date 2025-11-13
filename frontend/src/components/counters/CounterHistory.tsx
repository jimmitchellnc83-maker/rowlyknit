import { useState, useEffect } from 'react';
import { FiX, FiRotateCcw, FiClock } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { Counter, CounterHistory as CounterHistoryType } from '../../types/counter.types';

interface CounterHistoryProps {
  counter: Counter;
  onClose: () => void;
  onUpdate: () => void;
}

export default function CounterHistory({ counter, onClose, onUpdate }: CounterHistoryProps) {
  const [history, setHistory] = useState<CounterHistoryType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [counter.id]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `/api/projects/${counter.project_id}/counters/${counter.id}/history`
      );
      setHistory(response.data.data.history);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (historyId: string) => {
    try {
      await axios.post(
        `/api/projects/${counter.project_id}/counters/${counter.id}/undo/${historyId}`
      );
      toast.success('Counter reverted!');
      fetchHistory();
      onUpdate();
    } catch (error) {
      console.error('Error undoing action:', error);
      toast.error('Failed to undo action');
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'increment':
        return 'text-green-600 bg-green-50';
      case 'decrement':
        return 'text-yellow-600 bg-yellow-50';
      case 'reset':
        return 'text-red-600 bg-red-50';
      case 'set':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'increment':
        return '+';
      case 'decrement':
        return '-';
      case 'reset':
        return '↺';
      case 'set':
        return '=';
      default:
        return '•';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Counter History</h2>
            <p className="text-sm text-gray-500">{counter.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <FiClock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getActionColor(
                            entry.action
                          )}`}
                        >
                          {getActionIcon(entry.action)}
                        </span>
                        <div>
                          <div className="font-medium text-gray-900">
                            {entry.old_value} → {entry.new_value}
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                          </div>
                        </div>
                      </div>

                      {entry.user_note && (
                        <div className="ml-11 mb-2 text-sm text-gray-600 italic">
                          "{entry.user_note}"
                        </div>
                      )}

                      <div className="ml-11 text-xs text-gray-400 flex items-center gap-2">
                        <FiClock className="h-3 w-3" />
                        {formatTime(entry.created_at)} •{' '}
                        {new Date(entry.created_at).toLocaleString()}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Revert counter to ${entry.old_value}? This will create a new history entry.`
                          )
                        ) {
                          handleUndo(entry.id);
                        }
                      }}
                      className="ml-3 p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                      title="Undo to this point"
                    >
                      <FiRotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
