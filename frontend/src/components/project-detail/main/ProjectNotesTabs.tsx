import { useState } from 'react';
import { AudioNotes } from '../../notes/AudioNotes';
import { HandwrittenNotes } from '../../notes/HandwrittenNotes';
import { StructuredMemoTemplates } from '../../notes/StructuredMemoTemplates';

type NotesTab = 'audio' | 'handwritten' | 'memos';

interface Props {
  projectId: string;
  patterns: any[];
  audioNotes: any[];
  structuredMemos: any[];
  onSaveAudioNote: (audioBlob: Blob, durationSeconds: number, transcription?: string, patternId?: string) => Promise<void>;
  onDeleteAudioNote: (noteId: string) => Promise<void>;
  onUpdateAudioTranscription: (noteId: string, transcription: string) => Promise<void>;
  onSaveHandwrittenNote: (imageData: string) => Promise<void>;
  onSaveStructuredMemo: (templateType: string, data: any) => Promise<void>;
  onDeleteStructuredMemo: (memoId: string) => Promise<void>;
}

export default function ProjectNotesTabs({
  projectId,
  patterns,
  audioNotes,
  structuredMemos,
  onSaveAudioNote,
  onDeleteAudioNote,
  onUpdateAudioTranscription,
  onSaveHandwrittenNote,
  onSaveStructuredMemo,
  onDeleteStructuredMemo,
}: Props) {
  const [notesTab, setNotesTab] = useState<NotesTab>('audio');

  return (
    <div id="notes-section" className="bg-white rounded-lg shadow">
      <div className="border-b border-gray-200 px-6 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
        <nav className="flex -mb-px gap-6">
          <button
            onClick={() => setNotesTab('audio')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              notesTab === 'audio'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Audio Notes
          </button>
          <button
            onClick={() => setNotesTab('handwritten')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              notesTab === 'handwritten'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Handwritten
          </button>
          <button
            onClick={() => setNotesTab('memos')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              notesTab === 'memos'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Structured Memos
          </button>
        </nav>
      </div>

      <div className="p-6">
        {notesTab === 'audio' && (
          <AudioNotes
            projectId={projectId}
            patterns={patterns}
            notes={audioNotes}
            onSaveNote={onSaveAudioNote}
            onDeleteNote={onDeleteAudioNote}
            onUpdateTranscription={onUpdateAudioTranscription}
          />
        )}

        {notesTab === 'handwritten' && (
          <HandwrittenNotes
            projectId={projectId}
            onSave={onSaveHandwrittenNote}
          />
        )}

        {notesTab === 'memos' && (
          <StructuredMemoTemplates
            projectId={projectId}
            memos={structuredMemos}
            onSaveMemo={onSaveStructuredMemo}
            onDeleteMemo={onDeleteStructuredMemo}
          />
        )}
      </div>
    </div>
  );
}
