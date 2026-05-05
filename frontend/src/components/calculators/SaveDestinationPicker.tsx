/**
 * SaveDestinationPicker — Sprint 1 Public Tools Conversion.
 *
 * One modal that lets an entitled, logged-in user pick where their
 * public-tool result lands. Replaces the legacy SaveCalcToProjectModal
 * for new tools; existing gauge / size flows are migrated alongside.
 *
 * Destinations (Sprint 1 — all stored as `structured_memos` rows so
 * the data is captured immediately; Sprint 2 wires up the secondary
 * UI surfaces that read it back):
 *   - project       → memo with `templateType: calculator_result | …`
 *   - pattern       → memo with `templateType: gauge_swatch | …`
 *   - stash         → memo with `templateType: stash_estimate`
 *   - make-mode     → memo with `templateType: make_mode_reminder`
 *
 * The picker is destination-aware: the radio list shows only targets
 * the tool reports in `recommendedSaveTargets`. Targets that aren't
 * yet wired to their natural UI surface (anything other than
 * `project`) get a small subtitle so the user knows where to look —
 * no faking; no surprise.
 *
 * "Create new project" path: the picker can either pick an existing
 * project or create one inline (POST /api/projects then memo) without
 * leaving the modal. Useful for the Size Calculator's "create a
 * project plan from this size" CTA.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiSave, FiX } from 'react-icons/fi';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { trackEvent } from '../../lib/analytics';
import type { ToolResult } from '../../lib/toolResult';
import { templateTypeFor } from '../../lib/toolResult';
import type { SaveTarget } from '../../lib/publicTools';

interface ProjectOption {
  id: string;
  name: string;
  status: string;
}

interface Props {
  open: boolean;
  /** Tool result to attach. */
  result: ToolResult;
  /** Title shown in the modal header (usually `tool.title`). */
  title: string;
  onClose: () => void;
  /**
   * Called after a save succeeds. Receives the project id the memo
   * landed on so the caller can close + show a "View it" link.
   */
  onSaved?: (projectId: string) => void;
}

const DESTINATION_LABEL: Record<SaveTarget, string> = {
  project: 'Project notes',
  pattern: 'Pattern notes',
  stash: 'Yarn stash note',
  'make-mode': 'Make Mode reminder',
};

const DESTINATION_HINT: Record<SaveTarget, string> = {
  project: 'Attach the result to one of your knitting projects.',
  pattern: 'Saved as a pattern note on the project — surfaces on the pattern in the next update.',
  stash: 'Saved as a stash note on the project — surfaces in your yarn stash in the next update.',
  'make-mode': 'Saved as a Make Mode reminder draft on the project — surfaces in Make Mode in the next update.',
};

export default function SaveDestinationPicker({
  open,
  result,
  title,
  onClose,
  onSaved,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [destination, setDestination] = useState<SaveTarget>(
    result.recommendedSaveTargets[0] ?? 'project',
  );
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedId, setSelectedId] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await axios.get('/api/projects');
        if (cancelled) return;
        const list: ProjectOption[] = (res.data?.data?.projects || []).map(
          (p: { id: string; name: string; status: string }) => ({
            id: p.id,
            name: p.name,
            status: p.status,
          }),
        );
        const ranked = [...list].sort(
          (a, b) => statusRank(a.status) - statusRank(b.status),
        );
        setProjects(ranked);
        setSelectedId(ranked[0]?.id ?? '');
        setMode(ranked.length === 0 ? 'new' : 'existing');
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

  const availableTargets = useMemo(
    () => result.recommendedSaveTargets,
    [result.recommendedSaveTargets],
  );

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      let projectId = selectedId;

      if (mode === 'new') {
        const name = newProjectName.trim();
        if (!name) {
          toast.error('Pick a name for the new project');
          setSaving(false);
          return;
        }
        const res = await axios.post('/api/projects', { name });
        projectId = res.data?.data?.project?.id;
        if (!projectId) throw new Error('Could not create project');
        trackEvent('save_destination_selected', {
          toolId: result.toolId,
          destination,
          projectMode: 'new',
        });
      } else {
        if (!projectId) {
          toast.error('Pick a project to save into');
          setSaving(false);
          return;
        }
        trackEvent('save_destination_selected', {
          toolId: result.toolId,
          destination,
          projectMode: 'existing',
        });
      }

      const templateType = templateTypeFor(result.toolId, destination);
      await axios.post(`/api/projects/${projectId}/memos`, {
        templateType,
        title,
        data: {
          toolId: result.toolId,
          toolVersion: result.toolVersion,
          destination,
          inputs: result.inputs,
          // The whole `result` blob is JSON-serializable per the
          // ToolResult contract; nothing in here is a function or DOM
          // node so a structuredClone via JSON survives the trip.
          outputs: result.result as unknown as Record<string, unknown>,
          summary: result.humanSummary,
          notes: note || undefined,
        },
      });

      trackEvent('tool_result_saved', {
        toolId: result.toolId,
        destination,
      });

      const target = projects.find((p) => p.id === projectId);
      toast.success(
        target
          ? `Saved to ${target.name}`
          : 'Saved to your new project',
      );
      onSaved?.(projectId);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Save failed — try again';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-destination-modal-title"
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <FiSave className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <h3
                id="save-destination-modal-title"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                Save to Rowly
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                {result.humanSummary}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-2 space-y-4">
          {availableTargets.length > 1 && (
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Save as
              </legend>
              <div className="space-y-2">
                {availableTargets.map((t) => (
                  <label
                    key={t}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${
                      destination === t
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="destination"
                      value={t}
                      checked={destination === t}
                      onChange={() => setDestination(t)}
                      className="mt-1 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {DESTINATION_LABEL[t]}
                      </span>
                      <span className="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {DESTINATION_HINT[t]}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project
            </legend>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="existing"
                  checked={mode === 'existing'}
                  onChange={() => setMode('existing')}
                  disabled={projects.length === 0}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Use an existing project
                </span>
              </label>
              {mode === 'existing' &&
                (loading ? (
                  <p className="text-sm text-gray-500 italic ml-6">
                    Loading projects…
                  </p>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-gray-500 ml-6">
                    You don&apos;t have any projects yet.{' '}
                    <Link to="/projects" className="text-purple-600 hover:underline">
                      Create one
                    </Link>{' '}
                    or pick &ldquo;Start a new project&rdquo; below.
                  </p>
                ) : (
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full ml-6 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    style={{ width: 'calc(100% - 1.5rem)' }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{' '}
                        {p.status && p.status !== 'active' ? `· ${p.status}` : ''}
                      </option>
                    ))}
                  </select>
                ))}

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="new"
                  checked={mode === 'new'}
                  onChange={() => setMode('new')}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Start a new project
                </span>
              </label>
              {mode === 'new' && (
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                  className="w-full ml-6 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  style={{ width: 'calc(100% - 1.5rem)' }}
                />
              )}
            </div>
          </fieldset>

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
            className="flex-1 px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              (mode === 'existing' && (!selectedId || projects.length === 0)) ||
              (mode === 'new' && !newProjectName.trim())
            }
            className="flex-1 px-4 py-2 min-h-[44px] rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusRank(status: string | undefined): number {
  switch (status) {
    case 'active':
    case 'in-progress':
      return 0;
    case 'planned':
    case 'planning':
      return 1;
    case 'paused':
    case 'on-hold':
      return 2;
    case 'completed':
    case 'complete':
      return 3;
    default:
      return 4;
  }
}
