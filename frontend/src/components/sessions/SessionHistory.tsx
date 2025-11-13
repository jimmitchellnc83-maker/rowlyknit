import React, { useState } from 'react';
import { History, Clock, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { KnittingSession } from '../../types/counter.types';
import { formatDistanceToNow, format } from 'date-fns';

interface SessionHistoryProps {
  sessions: KnittingSession[];
  onDeleteSession?: (sessionId: string) => Promise<void>;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  sessions,
  onDeleteSession,
}) => {
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const calculateRowsPerHour = (session: KnittingSession): number => {
    if (!session.duration_seconds || session.duration_seconds === 0) return 0;
    const hours = session.duration_seconds / 3600;
    return Math.round(session.rows_completed / hours);
  };

  const getMoodEmoji = (mood?: string): string => {
    switch (mood) {
      case 'productive':
        return '😊';
      case 'relaxed':
        return '😌';
      case 'frustrated':
        return '😤';
      default:
        return '🧶';
    }
  };

  const getMoodColor = (mood?: string): string => {
    switch (mood) {
      case 'productive':
        return 'text-green-600 dark:text-green-400';
      case 'relaxed':
        return 'text-blue-600 dark:text-blue-400';
      case 'frustrated':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const toggleExpand = (sessionId: string) => {
    setExpandedSession(expandedSession === sessionId ? null : sessionId);
  };

  // Calculate totals
  const totalDuration = sessions.reduce(
    (sum, session) => sum + (session.duration_seconds || 0),
    0
  );
  const totalRows = sessions.reduce((sum, session) => sum + session.rows_completed, 0);
  const averageRowsPerHour =
    totalDuration > 0 ? Math.round((totalRows / totalDuration) * 3600) : 0;

  if (sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <History className="w-5 h-5" />
          Session History
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No sessions recorded yet</p>
          <p className="text-sm mt-1">Start a knitting session to track your progress</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <History className="w-5 h-5" />
        Session History
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {sessions.length}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Time</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatDuration(totalDuration)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">Avg Pace</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {averageRowsPerHour}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">rows/hour</div>
        </div>
      </div>

      {/* Session List */}
      <div className="space-y-3">
        {sessions.map((session) => {
          const isExpanded = expandedSession === session.id;
          const rowsPerHour = calculateRowsPerHour(session);

          return (
            <div
              key={session.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Session Header */}
              <button
                onClick={() => toggleExpand(session.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-2xl ${getMoodColor(session.mood)}`}>
                    {getMoodEmoji(session.mood)}
                  </span>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {format(new Date(session.start_time), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(session.start_time), 'h:mm a')}
                      {session.end_time &&
                        ` - ${format(new Date(session.end_time), 'h:mm a')}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDuration(session.duration_seconds || 0)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {session.rows_completed} rows
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      isExpanded ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600 dark:text-gray-400">Pace:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {rowsPerHour} rows/hour
                      </span>
                    </div>
                    {session.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Location:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {session.location}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Counter Values */}
                  {session.starting_counter_values &&
                    session.ending_counter_values &&
                    Object.keys(session.starting_counter_values).length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Counter Progress
                        </div>
                        <div className="space-y-1">
                          {Object.entries(session.starting_counter_values).map(
                            ([counterId, startValue]) => {
                              const endValue =
                                session.ending_counter_values?.[counterId] || startValue;
                              const diff = endValue - startValue;
                              return (
                                <div
                                  key={counterId}
                                  className="flex justify-between text-sm"
                                >
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Counter {counterId.slice(0, 8)}
                                  </span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {startValue} → {endValue}
                                    {diff > 0 && (
                                      <span className="text-green-600 dark:text-green-400 ml-1">
                                        (+{diff})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}

                  {/* Notes */}
                  {session.notes && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Notes
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded">
                        {session.notes}
                      </div>
                    </div>
                  )}

                  {/* Delete Button */}
                  {onDeleteSession && (
                    <button
                      onClick={() => onDeleteSession(session.id)}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                    >
                      Delete Session
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
