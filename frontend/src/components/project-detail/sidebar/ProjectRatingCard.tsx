import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiGlobe, FiLock, FiSave, FiTrash2 } from 'react-icons/fi';
import RatingStars from './RatingStars';

export interface ProjectRating {
  id: string;
  project_id: string;
  rating: number;
  notes: string | null;
  is_public: boolean;
  updated_at?: string;
}

interface Props {
  projectId: string;
  initialRating: ProjectRating | null;
}

export default function ProjectRatingCard({ projectId, initialRating }: Props) {
  const [rating, setRating] = useState<number>(initialRating?.rating ?? 0);
  const [notes, setNotes] = useState<string>(initialRating?.notes ?? '');
  const [isPublic, setIsPublic] = useState<boolean>(initialRating?.is_public ?? false);
  const [saving, setSaving] = useState(false);
  const [hasRating, setHasRating] = useState<boolean>(!!initialRating);

  useEffect(() => {
    setRating(initialRating?.rating ?? 0);
    setNotes(initialRating?.notes ?? '');
    setIsPublic(initialRating?.is_public ?? false);
    setHasRating(!!initialRating);
  }, [initialRating]);

  const handleSave = async () => {
    if (rating < 1 || rating > 5) {
      toast.error('Pick a star rating first');
      return;
    }
    setSaving(true);
    try {
      await axios.put(`/api/projects/${projectId}/rating`, {
        rating,
        notes: notes || null,
        isPublic,
      });
      setHasRating(true);
      toast.success(hasRating ? 'Rating updated' : 'Rating saved');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to save rating');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await axios.delete(`/api/projects/${projectId}/rating`);
      setRating(0);
      setNotes('');
      setIsPublic(false);
      setHasRating(false);
      toast.success('Rating removed');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to remove rating');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6" data-testid="project-rating-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your rating</h2>
        {hasRating && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-gray-400 hover:text-red-600 disabled:opacity-50"
            title="Remove rating"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-3">
        <RatingStars value={rating} onChange={setRating} />
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="How did it go? (optional)"
        rows={3}
        className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400"
      />

      <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer select-none text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        {isPublic ? (
          <span className="inline-flex items-center gap-1">
            <FiGlobe className="h-4 w-4 text-purple-600" />
            Public — counts toward "made by" on the pattern
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-gray-500">
            <FiLock className="h-4 w-4" />
            Private to you
          </span>
        )}
      </label>

      <button
        onClick={handleSave}
        disabled={saving || rating < 1}
        className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <FiSave className="h-4 w-4" />
        {saving ? 'Saving…' : hasRating ? 'Update rating' : 'Save rating'}
      </button>
    </div>
  );
}
