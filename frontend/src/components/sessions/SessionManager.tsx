import React, { useState, useEffect } from 'react';
import { SessionTimer } from './SessionTimer';
import { SessionHistory } from './SessionHistory';
import { ProjectTimer } from './ProjectTimer';
import { KnittingSession, ProjectMilestone } from '../../types/counter.types';
import axios from 'axios';

interface SessionManagerProps {
  projectId: string;
  totalRows?: number;
  getCurrentCounterValues: () => Record<string, number>;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  projectId,
  totalRows = 0,
  getCurrentCounterValues,
}) => {
  const [currentSession, setCurrentSession] = useState<KnittingSession | null>(null);
  const [sessions, setSessions] = useState<KnittingSession[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timer' | 'history' | 'progress'>('timer');

  // Fetch sessions and milestones
  useEffect(() => {
    fetchSessions();
    fetchMilestones();
    checkActiveSession();
  }, [projectId]);

  const checkActiveSession = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/sessions/active`);
      if (response.data) {
        setCurrentSession(response.data);
      }
    } catch (error) {
      // No active session
      console.log('No active session');
    }
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/projects/${projectId}/sessions`);
      setSessions(response.data || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMilestones = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/milestones`);
      setMilestones(response.data || []);
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
      setMilestones([]);
    }
  };

  const handleStartSession = async (): Promise<KnittingSession> => {
    try {
      const response = await axios.post(`/api/projects/${projectId}/sessions`, {
        start_time: new Date().toISOString(),
        starting_counter_values: getCurrentCounterValues(),
      });

      const newSession = response.data;
      setCurrentSession(newSession);
      return newSession;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  };

  const handleEndSession = async (notes?: string, mood?: string) => {
    if (!currentSession) return;

    try {
      const endingCounterValues = getCurrentCounterValues();
      const startingValues = currentSession.starting_counter_values || {};

      // Calculate rows completed
      const rowsCompleted = Object.entries(endingCounterValues).reduce(
        (total, [counterId, endValue]) => {
          const startValue = startingValues[counterId] || 0;
          return total + (endValue - startValue);
        },
        0
      );

      await axios.put(`/api/projects/${projectId}/sessions/${currentSession.id}`, {
        end_time: new Date().toISOString(),
        ending_counter_values: endingCounterValues,
        rows_completed: rowsCompleted,
        notes,
        mood,
      });

      setCurrentSession(null);
      fetchSessions(); // Refresh session list
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await axios.delete(`/api/projects/${projectId}/sessions/${sessionId}`);
      setSessions(sessions.filter((s) => s.id !== sessionId));
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleAddMilestone = async (
    milestone: Omit<ProjectMilestone, 'id' | 'created_at'>
  ) => {
    try {
      const response = await axios.post(`/api/projects/${projectId}/milestones`, milestone);
      setMilestones([...milestones, response.data]);
    } catch (error) {
      console.error('Failed to add milestone:', error);
      throw error;
    }
  };

  const handleUpdateMilestone = async (
    milestoneId: string,
    updates: Partial<ProjectMilestone>
  ) => {
    try {
      const response = await axios.put(
        `/api/projects/${projectId}/milestones/${milestoneId}`,
        updates
      );
      setMilestones(
        milestones.map((m) => (m.id === milestoneId ? response.data : m))
      );
    } catch (error) {
      console.error('Failed to update milestone:', error);
      throw error;
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    try {
      await axios.delete(`/api/projects/${projectId}/milestones/${milestoneId}`);
      setMilestones(milestones.filter((m) => m.id !== milestoneId));
    } catch (error) {
      console.error('Failed to delete milestone:', error);
      throw error;
    }
  };

  // Calculate totals
  const totalTimeSeconds = sessions.reduce(
    (sum, session) => sum + (session.duration_seconds || 0),
    0
  );
  const completedRows = sessions.reduce(
    (sum, session) => sum + session.rows_completed,
    0
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          Loading sessions...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('timer')}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === 'timer'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Session Timer
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === 'progress'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Progress
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            History ({sessions.length})
          </button>
        </div>

        <div className="p-6">
          {/* Session Timer Tab */}
          {activeTab === 'timer' && (
            <SessionTimer
              projectId={projectId}
              currentSession={currentSession}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
              getCurrentCounterValues={getCurrentCounterValues}
            />
          )}

          {/* Progress Tab */}
          {activeTab === 'progress' && (
            <ProjectTimer
              projectId={projectId}
              milestones={milestones}
              totalTimeSeconds={totalTimeSeconds}
              totalRows={totalRows}
              completedRows={completedRows}
              onAddMilestone={handleAddMilestone}
              onUpdateMilestone={handleUpdateMilestone}
              onDeleteMilestone={handleDeleteMilestone}
            />
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <SessionHistory sessions={sessions} onDeleteSession={handleDeleteSession} />
          )}
        </div>
      </div>
    </div>
  );
};
