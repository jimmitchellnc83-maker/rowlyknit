// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { FiMic, FiSquare, FiPlay, FiPause, FiTrash2, FiDownload, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';

interface AudioNote {
  id: string;
  project_id: string;
  pattern_id?: string;
  audio_url: string;
  transcription?: string;
  duration_seconds: number;
  counter_values?: Record<string, number>;
  created_at: string;
}

interface AudioNotesProps {
  projectId: string;
  patternId?: string;
  notes: AudioNote[];
  getCurrentCounterValues?: () => Record<string, number>;
  onSaveNote: (audioBlob: Blob, transcription?: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onUpdateTranscription?: (noteId: string, transcription: string) => Promise<void>;
}

export const AudioNotes: React.FC<AudioNotesProps> = ({
  projectId,
  patternId,
  notes,
  getCurrentCounterValues,
  onSaveNote,
  onDeleteNote,
  onUpdateTranscription,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTranscription, setEditTranscription] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audioElementsRef.current.clear();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Save the note (transcription can be added manually later)
        try {
          await onSaveNote(audioBlob, undefined);
        } catch (error) {
          console.error('Failed to save audio note:', error);
          alert('Failed to save audio note');
        }
      };

      mediaRecorder.start(1000); // Request data every 1000ms for reliability
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone. Please grant microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const playAudio = (note: AudioNote) => {
    // Pause any currently playing audio
    if (playingNoteId) {
      const currentAudio = audioElementsRef.current.get(playingNoteId);
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    }

    // Get or create audio element for this note
    let audio = audioElementsRef.current.get(note.id);
    if (!audio) {
      audio = new Audio(note.audio_url);
      audio.onended = () => setPlayingNoteId(null);
      audioElementsRef.current.set(note.id, audio);
    }

    if (playingNoteId === note.id) {
      audio.pause();
      setPlayingNoteId(null);
    } else {
      audio.play();
      setPlayingNoteId(note.id);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this audio note?')) return;

    try {
      // Stop and cleanup audio if playing
      const audio = audioElementsRef.current.get(noteId);
      if (audio) {
        audio.pause();
        audio.src = '';
        audioElementsRef.current.delete(noteId);
      }

      await onDeleteNote(noteId);
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note');
    }
  };

  const startEditTranscription = (note: AudioNote) => {
    setEditingNoteId(note.id);
    setEditTranscription(note.transcription || '');
  };

  const saveTranscription = async (noteId: string) => {
    if (!onUpdateTranscription) return;

    try {
      await onUpdateTranscription(noteId, editTranscription);
      setEditingNoteId(null);
      setEditTranscription('');
    } catch (error) {
      console.error('Failed to update transcription:', error);
      alert('Failed to update transcription');
    }
  };

  const cancelEditTranscription = () => {
    setEditingNoteId(null);
    setEditTranscription('');
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Audio Notes
      </h3>

      {/* Recording Controls */}
      <div className="mb-6">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors min-h-[60px]"
          >
            <FiMic className="w-6 h-6" />
            Start Recording
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-4 h-4 bg-red-600 rounded-full animate-pulse" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatDuration(recordingTime)}
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors min-h-[60px]"
            >
              <FiSquare className="w-6 h-6" />
              Stop Recording
            </button>
          </div>
        )}
      </div>

      {/* Audio Notes List */}
      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <FiMic className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No audio notes yet</p>
            <p className="text-sm mt-1">Record your first voice note</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              {/* Note Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Duration: {formatDuration(note.duration_seconds)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playAudio(note)}
                    className={`p-2 rounded-lg transition-colors ${
                      playingNoteId === note.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title={playingNoteId === note.id ? 'Pause' : 'Play'}
                  >
                    {playingNoteId === note.id ? (
                      <FiPause className="w-5 h-5" />
                    ) : (
                      <FiPlay className="w-5 h-5" />
                    )}
                  </button>
                  <a
                    href={note.audio_url}
                    download={`audio-note-${note.id}.webm`}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    title="Download"
                  >
                    <FiDownload className="w-5 h-5" />
                  </a>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                    title="Delete"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Transcription */}
              {editingNoteId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editTranscription}
                    onChange={(e) => setEditTranscription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    rows={3}
                    placeholder="Add transcription or notes..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveTranscription(note.id)}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                    >
                      <FiCheck className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={cancelEditTranscription}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm"
                    >
                      <FiX className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Transcription
                    </div>
                    {onUpdateTranscription && (
                      <button
                        onClick={() => startEditTranscription(note)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700"
                      >
                        <FiEdit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {note.transcription || (
                      <span className="italic text-gray-500 dark:text-gray-400">
                        No transcription available. Click edit to add notes.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Counter Values */}
              {note.counter_values && Object.keys(note.counter_values).length > 0 && (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium">At: </span>
                  {Object.entries(note.counter_values)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(', ')}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        💡 Tip: Click the microphone icon to record voice notes hands-free while knitting
      </p>
    </div>
  );
};
