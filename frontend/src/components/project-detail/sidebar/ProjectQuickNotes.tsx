import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiEdit2, FiCheck, FiX, FiHelpCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { topicForSituation } from '../../../data/knit911';

interface Props {
  currentNotes: string;
  onSave: (notes: string) => Promise<void>;
}

export default function ProjectQuickNotes({ currentNotes, onSave }: Props) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(currentNotes || '');

  // Match the most recent ~200 chars against the Knit911 keyword index.
  // Surfaces a contextual help link when the knitter has jotted about a
  // recognizable problem ("dropped stitch", "curling edges", etc.).
  const knit911Match = useMemo(() => {
    const haystack = (currentNotes || '').slice(-400);
    if (!haystack.trim()) return null;
    return topicForSituation(haystack);
  }, [currentNotes]);

  const handleEditNotes = () => {
    setNotesText(currentNotes || '');
    setEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    try {
      await onSave(notesText);
      toast.success('Notes saved successfully!');
      setEditingNotes(false);
    } catch (error: any) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    }
  };

  const handleCancelNotes = () => {
    setNotesText('');
    setEditingNotes(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
        {!editingNotes && (
          <button
            onClick={handleEditNotes}
            className="text-purple-600 hover:text-purple-700"
            title="Edit notes"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {editingNotes ? (
        <div className="space-y-3">
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            rows={6}
            placeholder="Add notes about your project..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveNotes}
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm flex items-center justify-center gap-2"
            >
              <FiCheck className="h-4 w-4" />
              Save
            </button>
            <button
              onClick={handleCancelNotes}
              className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm flex items-center justify-center gap-2"
            >
              <FiX className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : currentNotes ? (
        <>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentNotes}</p>
          {knit911Match && (
            <Link
              to={`/help/knit911#${knit911Match.slug}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300"
              target="_blank"
              rel="noopener noreferrer"
              title="Open the Knit911 fix in a new tab"
            >
              <FiHelpCircle className="h-3.5 w-3.5" />
              Sounds like: <span className="font-semibold">{knit911Match.title}</span>
            </Link>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={handleEditNotes}
          className="w-full text-left text-sm text-gray-500 italic hover:text-purple-700 dark:hover:text-purple-300"
        >
          Jot decisions, mods, and reminders — they stay visible here every session.
        </button>
      )}
    </div>
  );
}
