import { useState } from 'react';
import { toast } from 'react-toastify';
import ModalShell from './ModalShell';

export interface NewPatternData {
  name: string;
  description: string;
  designer: string;
  difficulty: string;
}

interface UploadPatternModalProps {
  onClose: () => void;
  onSubmit: (data: NewPatternData, file: File) => Promise<void>;
}

export default function UploadPatternModal({ onClose, onSubmit }: UploadPatternModalProps) {
  const [newPatternData, setNewPatternData] = useState<NewPatternData>({
    name: '',
    description: '',
    designer: '',
    difficulty: 'intermediate',
  });
  const [patternFile, setPatternFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patternFile) {
      toast.error('Please select a pattern file to upload');
      return;
    }

    if (!newPatternData.name.trim()) {
      toast.error('Please enter a pattern name');
      return;
    }

    setUploading(true);
    try {
      await onSubmit(newPatternData, patternFile);
      onClose();
    } catch {
      // stay open on error
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell
      titleId="upload-pattern-title"
      title="Upload New Pattern"
      subtitle="Upload a PDF pattern and add it to this project"
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pattern Name *
          </label>
          <input
            type="text"
            value={newPatternData.name}
            onChange={(e) => setNewPatternData({ ...newPatternData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., Cable Knit Sweater"
            required
            disabled={uploading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Designer
          </label>
          <input
            type="text"
            value={newPatternData.designer}
            onChange={(e) => setNewPatternData({ ...newPatternData, designer: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., Jane Doe"
            disabled={uploading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Difficulty
          </label>
          <select
            value={newPatternData.difficulty}
            onChange={(e) => setNewPatternData({ ...newPatternData, difficulty: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={uploading}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={newPatternData.description}
            onChange={(e) => setNewPatternData({ ...newPatternData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={3}
            placeholder="Brief description of the pattern..."
            disabled={uploading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pattern File (PDF) *
          </label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setPatternFile(e.target.files?.[0] || null)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            required
            disabled={uploading}
          />
          {patternFile && (
            <p className="text-sm text-gray-600 mt-2">
              Selected: {patternFile.name} ({(patternFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload & Add to Project'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
