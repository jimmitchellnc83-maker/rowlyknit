import { useState } from 'react';
import ModalShell from './ModalShell';

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
}

interface InitialProject {
  name: string;
  description?: string;
  status?: string;
  notes?: string;
  recipient_id?: string;
}

export interface EditProjectFormData {
  name: string;
  description: string;
  status: string;
  notes: string;
  recipientId: string;
}

interface EditProjectModalProps {
  project: InitialProject;
  availableRecipients: Recipient[];
  onClose: () => void;
  onSubmit: (data: EditProjectFormData) => Promise<void>;
}

export default function EditProjectModal({
  project,
  availableRecipients,
  onClose,
  onSubmit,
}: EditProjectModalProps) {
  const [formData, setFormData] = useState<EditProjectFormData>({
    name: project.name,
    description: project.description || '',
    status: project.status || 'active',
    notes: project.notes || '',
    recipientId: project.recipient_id || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err: unknown) {
      // Surface the failure so the user knows to retry instead of staring at
      // the same form. Server-supplied messages take precedence when
      // available (e.g., validation errors); otherwise we fall back to a
      // generic retry prompt that doesn't pretend to know more than we do.
      const ax = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const message =
        ax?.response?.data?.message ??
        ax?.response?.data?.error ??
        ax?.message ??
        'Could not save changes. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell titleId="edit-project-title" title="Edit Project" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
          >
            {error}
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gift Recipient (Optional)
            </label>
            <select
              value={formData.recipientId}
              onChange={(e) => setFormData({ ...formData, recipientId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">None</option>
              {availableRecipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.first_name} {r.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={5}
            placeholder="Add notes about your project..."
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
