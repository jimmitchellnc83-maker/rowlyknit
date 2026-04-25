import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiPlus } from 'react-icons/fi';

interface Counter {
  id: string;
  name: string;
  current_value: number;
  type: string;
}

interface PanelSummary {
  id: string;
  name: string;
  display_color: string | null;
  started: boolean;
  current_row?: number;
  repeat_length?: number;
}

interface GroupSummary {
  id: string;
  name: string;
  masterCounterId: string;
  masterRow: number;
  panelCount: number;
  panelSummaries: PanelSummary[];
}

export default function PanelHub() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [projectName, setProjectName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [counterMode, setCounterMode] = useState<'new' | 'existing'>('new');
  const [existingCounterId, setExistingCounterId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    try {
      const [groupsRes, countersRes, projectRes] = await Promise.all([
        axios.get(`/api/projects/${projectId}/panel-groups/live`),
        axios.get(`/api/projects/${projectId}/counters`),
        axios.get(`/api/projects/${projectId}`),
      ]);
      setGroups(groupsRes.data.data.groups);
      setCounters(countersRes.data.data.counters);
      setProjectName(projectRes.data.data.project?.name || '');
    } catch {
      toast.error('Could not load panel groups');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createGroup = async () => {
    if (!projectId || !newName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (counterMode === 'existing' && !existingCounterId) {
      toast.error('Pick an existing counter or create a new one');
      return;
    }
    setSaving(true);
    try {
      const body =
        counterMode === 'new'
          ? { name: newName.trim(), createMasterCounter: true }
          : { name: newName.trim(), masterCounterId: existingCounterId };
      const res = await axios.post(
        `/api/projects/${projectId}/panel-groups`,
        body,
      );
      toast.success('Panel group created');
      const newGroup = res.data.data.panelGroup;
      navigate(`/projects/${projectId}/panels/${newGroup.id}/setup`);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : null;
      toast.error(message || 'Could not create panel group');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading panels…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-8">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to={`/projects/${projectId}`}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <FiArrowLeft className="w-4 h-4" />
            Project
          </Link>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            Guided Pieces
          </h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {projectName && (
              <>
                For <span className="font-medium">{projectName}</span>.{' '}
              </>
            )}
            Guided Pieces tracks multi-panel patterns. Advance the master
            counter once and every piece's current instruction updates itself —
            no PDF flipping.
          </p>
        </section>

        {groups.length > 0 && (
          <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <h2 className="px-4 pt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Your pieces
            </h2>
            <p className="px-4 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Body, sleeves, collar — each piece has its own master counter.
              Tap one to knit it.
            </p>
            <ul className="divide-y divide-gray-200 dark:divide-gray-800 mt-2">
              {groups.map((group) => (
                <li key={group.id}>
                  <Link
                    to={`/projects/${projectId}/panels/${group.id}`}
                    className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {group.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {group.panelCount === 0
                            ? 'No panels yet'
                            : `${group.panelCount} panel${group.panelCount === 1 ? '' : 's'}`}
                          {' · '}master row {group.masterRow}
                        </p>
                        {group.panelSummaries.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {group.panelSummaries.map((p) => (
                              <span
                                key={p.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                style={{
                                  borderLeft: `3px solid ${p.display_color || '#3B82F6'}`,
                                }}
                                title={p.name}
                              >
                                <span className="truncate max-w-[80px]">
                                  {p.name}
                                </span>
                                {p.started && p.repeat_length && (
                                  <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                                    {p.current_row}/{p.repeat_length}
                                  </span>
                                )}
                                {!p.started && (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    —
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 mt-1">
                        Open →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
            >
              <FiPlus className="w-4 h-4" />
              New panel group
            </button>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                New panel group
              </h2>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Body, Sleeve"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Master counter
                </p>
                <label className="flex items-start gap-2 mb-2 cursor-pointer">
                  <input
                    type="radio"
                    name="counter-mode"
                    checked={counterMode === 'new'}
                    onChange={() => setCounterMode('new')}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Create a new master counter
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="counter-mode"
                    checked={counterMode === 'existing'}
                    onChange={() => setCounterMode('existing')}
                    className="mt-0.5"
                    disabled={counters.length === 0}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Use an existing counter{' '}
                    {counters.length === 0 && (
                      <span className="text-xs text-gray-500">
                        (none available)
                      </span>
                    )}
                  </span>
                </label>
                {counterMode === 'existing' && counters.length > 0 && (
                  <select
                    value={existingCounterId}
                    onChange={(e) => setExistingCounterId(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select counter…</option>
                    {counters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (row {c.current_value})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createGroup}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create + add panels'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
