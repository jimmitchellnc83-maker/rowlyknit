import { useState } from 'react';
import { FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';

interface Props {
  currentNotes: string;
  onSave: (notes: string) => Promise<void>;
}

export default function ProjectQuickNotes({ currentNotes, onSave }: Props) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(currentNotes || '');

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
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentNotes}</p>
      ) : (
        <p className="text-sm text-gray-500 italic">No notes added yet</p>
      )}
    </div>
  );
}
