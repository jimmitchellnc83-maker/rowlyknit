import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiClipboard, FiGrid, FiPlus, FiTrash2, FiEdit3 } from 'react-icons/fi';
import type { Panel, PanelGroup, PanelRow } from '../types/panel.types';
import PastePanelFlow from '../components/panels/PastePanelFlow';
import TemplatePicker from '../components/panels/TemplatePicker';

interface PanelFormState {
  id: string | null;
  name: string;
  repeat_length: number;
  row_offset: number;
  display_color: string;
  rows: Array<{ row_number: number; instruction: string }>;
}

const DEFAULT_COLORS = [
  '#3B82F6',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
];

function buildEmptyForm(repeatLength = 4): PanelFormState {
  return {
    id: null,
    name: '',
    repeat_length: repeatLength,
    row_offset: 0,
    display_color: DEFAULT_COLORS[0],
    rows: Array.from({ length: repeatLength }, (_, i) => ({
      row_number: i + 1,
      instruction: '',
    })),
  };
}

export default function PanelGroupSetup() {
  const { id: projectId, groupId } = useParams<{ id: string; groupId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const panelFromUrl = searchParams.get('panel');

  const [group, setGroup] = useState<PanelGroup | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [panelRows, setPanelRows] = useState<PanelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<PanelFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState<'none' | 'picker' | 'paste' | 'template' | 'copy'>(
    'none',
  );
  const [otherGroups, setOtherGroups] = useState<PanelGroup[]>([]);
  const [copyingFromId, setCopyingFromId] = useState<string | null>(null);
  const [copyInProgress, setCopyInProgress] = useState(false);
  const [pendingPanelDelete, setPendingPanelDelete] = useState<string | null>(null);

  const fetchGroup = useCallback(async () => {
    if (!projectId || !groupId) return;
    try {
      const [groupRes, allGroupsRes] = await Promise.all([
        axios.get(`/api/projects/${projectId}/panel-groups/${groupId}`),
        axios.get(`/api/projects/${projectId}/panel-groups`),
      ]);
      setGroup(groupRes.data.data.panelGroup);
      setPanels(groupRes.data.data.panels);
      setPanelRows(groupRes.data.data.panelRows);
      const allGroups: PanelGroup[] = allGroupsRes.data.data.panelGroups;
      setOtherGroups(allGroups.filter((g) => g.id !== groupId));
    } catch {
      toast.error('Could not load panel group');
    } finally {
      setLoading(false);
    }
  }, [projectId, groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  useEffect(() => {
    if (!panelFromUrl || panels.length === 0 || activeForm) return;
    const target = panels.find((p) => p.id === panelFromUrl);
    if (!target) return;
    const rowsForPanel = panelRows
      .filter((r) => r.panel_id === target.id)
      .sort((a, b) => a.row_number - b.row_number);
    setActiveForm({
      id: target.id,
      name: target.name,
      repeat_length: target.repeat_length,
      row_offset: target.row_offset,
      display_color: target.display_color || DEFAULT_COLORS[0],
      rows: Array.from({ length: target.repeat_length }, (_, i) => {
        const existing = rowsForPanel.find((r) => r.row_number === i + 1);
        return { row_number: i + 1, instruction: existing?.instruction || '' };
      }),
    });
  }, [panelFromUrl, panels, panelRows, activeForm]);

  const openPathPicker = () => setAddMode('picker');

  const chooseManual = () => {
    setAddMode('none');
    setActiveForm(buildEmptyForm());
  };

  const choosePaste = () => setAddMode('paste');
  const chooseTemplate = () => setAddMode('template');

  const closeForm = () => {
    setActiveForm(null);
    setAddMode('none');
  };

  const onSavedFromFlow = async () => {
    setAddMode('none');
    await fetchGroup();
  };

  const chooseCopy = () => {
    setAddMode('copy');
    setCopyingFromId(otherGroups[0]?.id ?? null);
  };

  const runCopy = async () => {
    if (!copyingFromId || !projectId || !groupId) return;
    setCopyInProgress(true);
    try {
      const res = await axios.post(
        `/api/projects/${projectId}/panel-groups/${groupId}/copy-panels`,
        { sourceGroupId: copyingFromId },
      );
      const n = res.data.data.copiedPanelCount;
      toast.success(`Copied ${n} panel${n === 1 ? '' : 's'}`);
      setAddMode('none');
      await fetchGroup();
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
      toast.error(msg || 'Copy failed');
    } finally {
      setCopyInProgress(false);
    }
  };

  const setFormField = <K extends keyof PanelFormState>(
    key: K,
    value: PanelFormState[K],
  ) => {
    setActiveForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateRepeatLength = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) return;
    setActiveForm((prev) => {
      if (!prev) return prev;
      const existing = prev.rows;
      const nextRows = Array.from({ length: n }, (_, i) => {
        const prior = existing.find((r) => r.row_number === i + 1);
        return { row_number: i + 1, instruction: prior?.instruction || '' };
      });
      return { ...prev, repeat_length: n, rows: nextRows };
    });
  };

  const updateRowInstruction = (rowNumber: number, instruction: string) => {
    setActiveForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) =>
          r.row_number === rowNumber ? { ...r, instruction } : r,
        ),
      };
    });
  };

  const savePanel = async () => {
    if (!activeForm || !projectId || !groupId) return;
    if (!activeForm.name.trim()) {
      toast.error('Panel name is required');
      return;
    }
    if (activeForm.repeat_length <= 0) {
      toast.error('Repeat length must be at least 1');
      return;
    }
    const rowsToSave = activeForm.rows.filter(
      (r) => r.instruction.trim().length > 0,
    );
    if (rowsToSave.length !== activeForm.repeat_length) {
      toast.error(
        `Fill in all ${activeForm.repeat_length} rows before saving`,
      );
      return;
    }

    setSaving(true);
    try {
      if (activeForm.id) {
        await axios.put(`/api/projects/${projectId}/panels/${activeForm.id}`, {
          name: activeForm.name,
          repeatLength: activeForm.repeat_length,
          rowOffset: activeForm.row_offset,
          displayColor: activeForm.display_color,
        });
        await axios.post(
          `/api/projects/${projectId}/panels/${activeForm.id}/rows/bulk`,
          {
            rows: rowsToSave.map((r) => ({
              rowNumber: r.row_number,
              instruction: r.instruction,
            })),
          },
        );
      } else {
        await axios.post(
          `/api/projects/${projectId}/panel-groups/${groupId}/panels`,
          {
            name: activeForm.name,
            repeatLength: activeForm.repeat_length,
            rowOffset: activeForm.row_offset,
            displayColor: activeForm.display_color,
            rows: rowsToSave.map((r) => ({
              rowNumber: r.row_number,
              instruction: r.instruction,
            })),
          },
        );
      }
      toast.success('Panel saved');
      setActiveForm(null);
      await fetchGroup();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : null;
      toast.error(message || 'Could not save panel');
    } finally {
      setSaving(false);
    }
  };

  const performDeletePanel = async (panelId: string) => {
    if (!projectId) return;
    setPendingPanelDelete(null);
    try {
      await axios.delete(`/api/projects/${projectId}/panels/${panelId}`);
      toast.success('Panel deleted');
      await fetchGroup();
    } catch {
      toast.error('Could not delete panel');
    }
  };

  const groupedPanels = useMemo(
    () => [...panels].sort((a, b) => a.sort_order - b.sort_order),
    [panels],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }
  if (!group) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-8">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to={`/projects/${projectId}/panels/${groupId}`}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <FiArrowLeft className="w-4 h-4" />
            Done
          </Link>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            {group.name} setup
          </h1>
          <span className="w-12" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {activeForm ? (
          <PanelEditor
            form={activeForm}
            saving={saving}
            onFieldChange={setFormField}
            onRepeatLengthChange={updateRepeatLength}
            onRowInstructionChange={updateRowInstruction}
            onSave={savePanel}
            onCancel={closeForm}
          />
        ) : addMode === 'paste' ? (
          <PastePanelFlow
            projectId={projectId!}
            groupId={groupId!}
            displayColor={DEFAULT_COLORS[0]}
            onSaved={onSavedFromFlow}
            onCancel={closeForm}
          />
        ) : addMode === 'template' ? (
          <TemplatePicker
            projectId={projectId!}
            groupId={groupId!}
            onSaved={onSavedFromFlow}
            onCancel={closeForm}
          />
        ) : addMode === 'copy' ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Copy panels from another group
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Great for mirror pieces — copy the left sleeve's panels into the
              right sleeve group. The source is untouched; this group gets
              duplicates appended.
            </p>
            {otherGroups.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No other groups in this project yet.
              </p>
            ) : (
              <>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source group
                </label>
                <select
                  value={copyingFromId ?? ''}
                  onChange={(e) => setCopyingFromId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  {otherGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={closeForm}
                disabled={copyInProgress}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runCopy}
                disabled={copyInProgress || !copyingFromId || otherGroups.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
              >
                {copyInProgress ? 'Copying…' : 'Copy panels'}
              </button>
            </div>
          </div>
        ) : addMode === 'picker' ? (
          <PathPicker
            hasOtherGroups={otherGroups.length > 0}
            onPaste={choosePaste}
            onTemplate={chooseTemplate}
            onManual={chooseManual}
            onCopy={chooseCopy}
            onCancel={closeForm}
          />
        ) : (
          <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Panels in this group
            </h2>
            {groupedPanels.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                No panels yet. Add your first one below.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800 mb-3">
                {groupedPanels.map((panel) => (
                  <li
                    key={panel.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0"
                      style={{ borderLeftWidth: 0 }}
                    >
                      <span
                        className="inline-block w-2.5 h-6 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor:
                            panel.display_color || DEFAULT_COLORS[0],
                        }}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {panel.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Repeat of {panel.repeat_length}
                          {panel.row_offset > 0
                            ? ` · offset ${panel.row_offset}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/projects/${projectId}/panels/${groupId}/setup?panel=${panel.id}`,
                          )
                        }
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                      >
                        Edit
                      </button>
                      {pendingPanelDelete === panel.id ? (
                        <span className="flex items-center gap-1 text-xs">
                          <button
                            type="button"
                            onClick={() => void performDeletePanel(panel.id)}
                            className="px-2 py-1 font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingPanelDelete(null)}
                            className="px-1 py-1 text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingPanelDelete(panel.id)}
                          aria-label="Delete panel"
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={openPathPicker}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
            >
              <FiPlus className="w-4 h-4" />
              Add panel
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

interface PathPickerProps {
  hasOtherGroups: boolean;
  onPaste: () => void;
  onTemplate: () => void;
  onManual: () => void;
  onCopy: () => void;
  onCancel: () => void;
}

function PathPicker({
  hasOtherGroups,
  onPaste,
  onTemplate,
  onManual,
  onCopy,
  onCancel,
}: PathPickerProps) {
  const paths: Array<{
    key: string;
    label: string;
    blurb: string;
    icon: React.ReactNode;
    onClick: () => void;
    show: boolean;
  }> = [
    {
      key: 'paste',
      label: 'Paste pattern text',
      blurb: 'Fastest. Paste "Row 1: …" lines; Rowly splits them into panels.',
      icon: <FiClipboard className="w-5 h-5" />,
      onClick: onPaste,
      show: true,
    },
    {
      key: 'template',
      label: 'Pick a template',
      blurb: 'Common stitch patterns — seed, moss, rib, cables, stockinette.',
      icon: <FiGrid className="w-5 h-5" />,
      onClick: onTemplate,
      show: true,
    },
    {
      key: 'copy',
      label: 'Copy from another piece',
      blurb: 'Clone panels from another group — ideal for mirror pieces like sleeves.',
      icon: <FiPlus className="w-5 h-5 rotate-45" />,
      onClick: onCopy,
      show: hasOtherGroups,
    },
    {
      key: 'manual',
      label: 'Build manually',
      blurb: 'Set a repeat length and fill each row by hand.',
      icon: <FiEdit3 className="w-5 h-5" />,
      onClick: onManual,
      show: true,
    },
  ];
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        How do you want to add this panel?
      </h2>
      <div className="space-y-2">
        {paths.filter((p) => p.show).map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={p.onClick}
            className="w-full flex items-center gap-3 text-left px-3 py-3 rounded-md border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex-shrink-0">
              {p.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium text-sm text-gray-900 dark:text-gray-100">
                {p.label}
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {p.blurb}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="w-full mt-3 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
      >
        Cancel
      </button>
    </div>
  );
}

interface PanelEditorProps {
  form: PanelFormState;
  saving: boolean;
  onFieldChange: <K extends keyof PanelFormState>(
    key: K,
    value: PanelFormState[K],
  ) => void;
  onRepeatLengthChange: (n: number) => void;
  onRowInstructionChange: (rowNumber: number, instruction: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function PanelEditor({
  form,
  saving,
  onFieldChange,
  onRepeatLengthChange,
  onRowInstructionChange,
  onSave,
  onCancel,
}: PanelEditorProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        {form.id ? 'Edit panel' : 'New panel'}
      </h2>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
            Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
            placeholder="e.g. Cable A"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Repeat length
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={form.repeat_length}
              onChange={(e) =>
                onRepeatLengthChange(parseInt(e.target.value, 10) || 1)
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Row offset
            </label>
            <input
              type="number"
              min={0}
              value={form.row_offset}
              onChange={(e) =>
                onFieldChange(
                  'row_offset',
                  Math.max(0, parseInt(e.target.value, 10) || 0),
                )
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onFieldChange('display_color', color)}
                aria-label={`Color ${color}`}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  form.display_color === color
                    ? 'border-gray-900 dark:border-gray-100 scale-110'
                    : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
            Rows in this repeat
          </label>
          <div className="space-y-1.5">
            {form.rows.map((row) => (
              <div
                key={row.row_number}
                className="flex items-start gap-2"
              >
                <span className="inline-flex items-center justify-center w-9 h-9 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300">
                  {row.row_number}
                </span>
                <input
                  type="text"
                  value={row.instruction}
                  onChange={(e) =>
                    onRowInstructionChange(row.row_number, e.target.value)
                  }
                  placeholder="Instruction for this row"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save panel'}
        </button>
      </div>
    </div>
  );
}
