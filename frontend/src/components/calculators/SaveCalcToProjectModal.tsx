import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiSave, FiX } from 'react-icons/fi';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ProjectOption {
  id: string;
  name: string;
  status: string;
}

export interface CalculatorMemoPayload {
  calculator: 'gauge' | 'gift_size' | 'yarn_sub';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  summary: string;
  notes?: string;
}

interface Props {
  open: boolean;
  payload: CalculatorMemoPayload;
  title: string;
  onClose: () => void;
}

export default function SaveCalcToProjectModal({ open, payload, title, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await axios.get('/api/projects');
        if (cancelled) return;
        const list: ProjectOption[] = (res.data?.data?.projects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          status: p.status,
        }));
        const ranked = [...list].sort((a, b) => statusRank(a.status) - statusRank(b.status));
        setProjects(ranked);
        setSelectedId(ranked[0]?.id ?? '');
      } catch {
        toast.error('Could not load your projects');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async () => {
    if (!selectedId) {
      toast.error('Pick a project to save into');
      return;
    }
    setSaving(true);
    try {
      const body = {
        templateType: 'calculator_result',
        title,
        data: { ...payload, notes: note || undefined },
      };
      await axios.post(`/api/projects/${selectedId}/memos`, body);
      const project = projects.find((p) => p.id === selectedId);
      toast.success(
        <span>
          Saved to <Link to={`/projects/${selectedId}`} className="underline font-medium">{project?.name ?? 'project'}</Link>
        </span>,
      );
      onClose();
    } catch {
      toast.error('Could not save the calculation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-calc-modal-title"
    >
      <div ref={dialogRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <FiSave className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <h3 id="save-calc-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Save to a project
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-2 space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project
            </span>
            {loading ? (
              <p className="text-sm text-gray-500 italic">Loading projects…</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-gray-500">
                You don&apos;t have any projects yet.{' '}
                <Link to="/projects" className="text-purple-600 hover:underline">Create one</Link>{' '}
                first.
              </p>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.status && p.status !== 'in-progress' ? `· ${p.status}` : ''}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Why you ran this — for future you."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
        </div>
        <div className="flex gap-3 px-6 pb-6 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedId || projects.length === 0}
            className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Active projects first, then planning, on-hold, complete. Anything else
// falls through to the bottom in stable order.
function statusRank(status: string | undefined): number {
  switch (status) {
    case 'in-progress':
      return 0;
    case 'planning':
      return 1;
    case 'on-hold':
      return 2;
    case 'complete':
      return 3;
    default:
      return 4;
  }
}
