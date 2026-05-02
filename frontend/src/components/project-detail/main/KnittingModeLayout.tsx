import { useState, useEffect, useCallback } from 'react';
import type { IconType } from 'react-icons';
import { FiClock, FiMic } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import PatternPreview from '../../PatternPreview';
import CounterHierarchy from '../../counters/CounterHierarchy';
import { SessionTimer, SessionHistory } from '../../sessions';
import { AudioNotes } from '../../notes/AudioNotes';
import QuickKeysPanel from '../../quickkeys/QuickKeysPanel';
import PiecesQuickPanel from './PiecesQuickPanel';
import type { ChartData } from '../../designer/ChartGrid';

interface Props {
  projectId: string;
  patterns: any[];
  counters: any[];
  audioNotes: any[];
  onSaveAudioNote: (audioBlob: Blob, durationSeconds: number, transcription?: string, patternId?: string) => Promise<void>;
  onDeleteAudioNote: (noteId: string) => Promise<void>;
  onUpdateAudioTranscription: (noteId: string, transcription: string) => Promise<void>;
  /** If the parent project has a saved Designer chart, thread it through so
   *  the counter pane's ChartRowTracker renders here too — this is the
   *  mode where a hands-free chart follower matters most. */
  linkedChart?: ChartData | null;
}

export default function KnittingModeLayout({
  projectId,
  patterns,
  counters,
  audioNotes,
  onSaveAudioNote,
  onDeleteAudioNote,
  onUpdateAudioTranscription,
  linkedChart,
}: Props) {
  const [showVoiceNotes, setShowVoiceNotes] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  const checkActiveSession = useCallback(async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/sessions/active`);
      if (response.data.success && response.data.data) {
        setCurrentSession(response.data.data);
      }
    } catch {
      setCurrentSession(null);
    }
  }, [projectId]);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/sessions`);
      setSessions(response.data.success ? response.data.data.sessions || [] : []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
    }
  }, [projectId]);

  useEffect(() => {
    void Promise.all([fetchSessions(), checkActiveSession()]);
  }, [fetchSessions, checkActiveSession]);

  const getCurrentCounterValues = () => {
    const counterValues: Record<string, number> = {};
    counters.forEach((counter: any) => {
      counterValues[counter.id] = counter.current_count || 0;
    });
    return counterValues;
  };

  const handleStartSession = async (): Promise<any> => {
    try {
      const response = await axios.post(`/api/projects/${projectId}/sessions/start`, {
        mood: undefined,
        location: undefined,
        notes: 'Knitting session',
      });
      const newSession = response.data.success ? response.data.data.session : response.data;
      setCurrentSession(newSession);
      await fetchSessions();
      toast.success('Knitting session started! 🎉');
      return newSession;
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start session');
      throw error;
    }
  };

  const handleEndSession = async (notes?: string, mood?: string) => {
    if (!currentSession) return;
    try {
      await axios.post(`/api/projects/${projectId}/sessions/${currentSession.id}/end`, {
        notes,
        mood,
      });
      setCurrentSession(null);
      await fetchSessions();
      toast.success('Session ended and saved!');
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Failed to end session');
      throw error;
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await axios.delete(`/api/projects/${projectId}/sessions/${sessionId}`);
      await fetchSessions();
      toast.success('Session deleted');
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error('Failed to delete session');
    }
  };

  const toggles: { active: boolean; toggle: () => void; title: string; Icon: IconType }[] = [
    { active: showVoiceNotes, toggle: () => setShowVoiceNotes(v => !v), title: 'Voice Notes', Icon: FiMic },
    { active: showHistory, toggle: () => setShowHistory(v => !v), title: 'History', Icon: FiClock },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      {/* Main Content - Left Column */}
      <div className="lg:col-span-2 space-y-4 md:space-y-6">
        {patterns.length > 0 && (
          <PatternPreview patterns={patterns} mode="knitting" />
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6">
          <CounterHierarchy projectId={projectId} linkedChart={linkedChart} />
        </div>
      </div>

      {/* Sidebar - Right Column */}
      <div className="space-y-4 md:space-y-6">
        {/* Pieces strip surfaces the project's panel/piece state inside
            Make Mode so the knitter can see the active piece + reach
            Panel Knitting without backing out. Renders nothing when
            the project has no pieces or panel groups. */}
        <PiecesQuickPanel projectId={projectId} />

        {/* QuickKeys for the project's primary pattern. Renders nothing
            when the pattern has no QuickKey crops, so projects without
            saved snippets don't see an empty panel. */}
        {patterns.length > 0 && patterns[0]?.id && (
          <QuickKeysPanel patternId={patterns[0].id} />
        )}

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">Session Timer</h2>
            <div className="flex gap-2">
              {toggles.map(({ active, toggle, title, Icon }) => (
                <button
                  key={title}
                  onClick={toggle}
                  className={`p-2 rounded-lg transition ${
                    active
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title={title}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <SessionTimer
            projectId={projectId}
            currentSession={currentSession}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            getCurrentCounterValues={getCurrentCounterValues}
          />
        </div>

        {showVoiceNotes && (
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Voice Notes</h2>
            <AudioNotes
              projectId={projectId}
              patterns={patterns}
              notes={audioNotes}
              onSaveNote={onSaveAudioNote}
              onDeleteNote={onDeleteAudioNote}
              onUpdateTranscription={onUpdateAudioTranscription}
            />
          </div>
        )}

        {showHistory && sessions.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Session History</h2>
            <SessionHistory sessions={sessions} onDeleteSession={handleDeleteSession} />
          </div>
        )}
      </div>
    </div>
  );
}
