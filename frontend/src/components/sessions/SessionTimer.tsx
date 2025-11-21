import React, { useState, useEffect, useRef } from 'react';
import { FiClock, FiPlay, FiPause, FiSquare } from 'react-icons/fi';
import { KnittingSession } from '../../types/counter.types';

interface SessionTimerProps {
  projectId: string;
  currentSession: KnittingSession | null;
  onStartSession: () => Promise<KnittingSession>;
  onEndSession: (notes?: string, mood?: string) => Promise<void>;
  onPauseSession?: () => Promise<void>;
  getCurrentCounterValues: () => Record<string, number>;
}

export const SessionTimer: React.FC<SessionTimerProps> = ({
  projectId: _projectId,
  currentSession,
  onStartSession,
  onEndSession,
  onPauseSession,
  getCurrentCounterValues: _getCurrentCounterValues,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [endNotes, setEndNotes] = useState('');
  const [mood, setMood] = useState<'productive' | 'frustrated' | 'relaxed' | undefined>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate elapsed time from current session
  useEffect(() => {
    if (currentSession && !currentSession.end_time) {
      const startTime = new Date(currentSession.start_time).getTime();
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
      setIsRunning(true);
    } else {
      setElapsedTime(0);
      setIsRunning(false);
    }
  }, [currentSession]);

  // Update timer every second when running
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handleStart = async () => {
    try {
      await onStartSession();
      setIsRunning(true);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const handlePause = async () => {
    if (onPauseSession) {
      try {
        await onPauseSession();
        setIsRunning(false);
      } catch (error) {
        console.error('Failed to pause session:', error);
      }
    }
  };

  const handleStop = () => {
    setShowEndModal(true);
  };

  const handleConfirmEnd = async () => {
    try {
      await onEndSession(endNotes, mood);
      setShowEndModal(false);
      setEndNotes('');
      setMood(undefined);
      setIsRunning(false);
      setElapsedTime(0);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FiClock className="w-5 h-5" />
          Knitting Session
        </h3>
      </div>

      {/* Timer Display */}
      <div className="text-center mb-6">
        <div className="text-6xl font-bold text-gray-900 dark:text-white tabular-nums mb-2">
          {formatTime(elapsedTime)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {isRunning ? 'Session in progress' : 'No active session'}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3 justify-center">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors min-h-[60px]"
          >
            <FiPlay className="w-6 h-6" />
            Start Session
          </button>
        ) : (
          <>
            {onPauseSession && (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors min-h-[60px]"
              >
                <FiPause className="w-6 h-6" />
                Pause
              </button>
            )}
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors min-h-[60px]"
            >
              <FiSquare className="w-6 h-6" />
              End Session
            </button>
          </>
        )}
      </div>

      {/* End Session Modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              End Knitting Session
            </h3>

            {/* Session Summary */}
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Session Duration
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatTime(elapsedTime)}
              </div>
            </div>

            {/* Mood Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                How was this session?
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setMood('productive')}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 transition-colors ${
                    mood === 'productive'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                  }`}
                >
                  😊 Productive
                </button>
                <button
                  onClick={() => setMood('relaxed')}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 transition-colors ${
                    mood === 'relaxed'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
                  }`}
                >
                  😌 Relaxed
                </button>
                <button
                  onClick={() => setMood('frustrated')}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 transition-colors ${
                    mood === 'frustrated'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-orange-500'
                  }`}
                >
                  😤 Frustrated
                </button>
              </div>
            </div>

            {/* Session Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session Notes (optional)
              </label>
              <textarea
                value={endNotes}
                onChange={(e) => setEndNotes(e.target.value)}
                placeholder="Add any notes about this session..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                rows={3}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEnd}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
