import { useCallback, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiX } from 'react-icons/fi';

interface ParsedRow {
  row_number: number;
  instruction: string;
  confidence: number;
}

interface ParsedPanel {
  suggested_name: string;
  repeat_length: number;
  rows: ParsedRow[];
  warnings: string[];
}

interface ParseResponse {
  panels: ParsedPanel[];
  warnings: string[];
}

interface Props {
  projectId: string;
  groupId: string;
  displayColor: string;
  onSaved: () => void;
  onCancel: () => void;
}

export default function PastePanelFlow({
  projectId,
  groupId,
  displayColor,
  onSaved,
  onCancel,
}: Props) {
  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [parsing, setParsing] = useState(false);
  const [editedRows, setEditedRows] = useState<Record<string, ParsedRow[]>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const runParse = useCallback(async () => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const res = await axios.post('/api/panels/parse', { text });
      const data: ParseResponse = res.data.data;
      setParseResult(data);
      // Seed edits with parsed rows + suggested names keyed by panel index
      const initialRows: Record<string, ParsedRow[]> = {};
      const initialNames: Record<string, string> = {};
      data.panels.forEach((p, i) => {
        const key = String(i);
        initialRows[key] = p.rows.map((r) => ({ ...r }));
        initialNames[key] = p.suggested_name;
      });
      setEditedRows(initialRows);
      setNames(initialNames);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
      toast.error(msg || 'Parse failed');
    } finally {
      setParsing(false);
    }
  }, [text]);

  const updateRow = (panelKey: string, rowNumber: number, instruction: string) => {
    setEditedRows((prev) => ({
      ...prev,
      [panelKey]: prev[panelKey].map((r) =>
        r.row_number === rowNumber
          ? { ...r, instruction, confidence: 1 }
          : r,
      ),
    }));
  };

  const savePanels = async () => {
    if (!parseResult) return;
    // Validate: no empty rows
    for (const panelIdx in editedRows) {
      const rows = editedRows[panelIdx];
      const empty = rows.filter((r) => !r.instruction.trim());
      if (empty.length > 0) {
        toast.error(
          `Fill row${empty.length > 1 ? 's' : ''} ${empty.map((r) => r.row_number).join(', ')} on "${names[panelIdx]}" before saving.`,
        );
        return;
      }
    }

    setSaving(true);
    let savedCount = 0;
    try {
      for (const key of Object.keys(editedRows)) {
        const panel = parseResult.panels[Number(key)];
        const rows = editedRows[key];
        await axios.post(
          `/api/projects/${projectId}/panel-groups/${groupId}/panels`,
          {
            name: names[key] || panel.suggested_name,
            repeatLength: panel.repeat_length,
            rowOffset: 0,
            displayColor,
            rows: rows.map((r) => ({
              rowNumber: r.row_number,
              instruction: r.instruction,
            })),
          },
        );
        savedCount += 1;
      }
      toast.success(`Created ${savedCount} panel${savedCount > 1 ? 's' : ''}`);
      onSaved();
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
      toast.error(msg || 'Could not save panels');
    } finally {
      setSaving(false);
    }
  };

  const hasParsed = parseResult !== null;
  const canSave =
    hasParsed &&
    parseResult.panels.length > 0 &&
    Object.values(editedRows).every(
      (rows) => rows.length > 0 && rows.every((r) => r.instruction.trim().length > 0),
    );

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Paste pattern text
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>

      {!hasParsed ? (
        <>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            Paste the repeating section of your pattern. Rowly will detect rows like
            <code className="mx-1 px-1 rounded bg-gray-100 dark:bg-gray-800">Row 1: K2, P2</code>
            or
            <code className="mx-1 px-1 rounded bg-gray-100 dark:bg-gray-800">Rnd 1: knit</code>
            and group them into panels. Leave a blank line between panels.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Row 1: K2, P2, C4F, P2, K2\nRow 2: P2, K2, P4, K2, P2\nRow 3: K2, P2, K4, P2, K2\nRow 4: P2, K2, P4, K2, P2`}
            rows={10}
            className="w-full font-mono text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={parsing}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runParse}
              disabled={parsing || !text.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
            >
              {parsing ? 'Parsing…' : 'Preview'}
            </button>
          </div>
        </>
      ) : (
        <>
          {parseResult.warnings.length > 0 && (
            <div className="mb-3 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {parseResult.warnings.join(' ')}
              </p>
            </div>
          )}

          {parseResult.panels.length === 0 ? (
            <div className="p-3 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
              No panels detected. Go back and check your text uses
              <code className="mx-1 px-1 rounded bg-white dark:bg-gray-700">Row N:</code>
              markers.
            </div>
          ) : (
            <div className="space-y-4">
              {parseResult.panels.map((panel, i) => {
                const key = String(i);
                const rows = editedRows[key] || [];
                const hasGaps = panel.warnings.length > 0;
                return (
                  <div
                    key={key}
                    className="border border-gray-200 dark:border-gray-700 rounded-md p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={names[key] || ''}
                        onChange={(e) =>
                          setNames((p) => ({ ...p, [key]: e.target.value }))
                        }
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        Repeat of {panel.repeat_length}
                      </span>
                    </div>

                    {hasGaps && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                        {panel.warnings.join(' ')}
                      </p>
                    )}

                    <div className="space-y-1">
                      {rows.map((r) => {
                        const isPlaceholder = r.confidence === 0;
                        return (
                          <div key={r.row_number} className="flex items-start gap-2">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 flex-shrink-0 rounded-md text-xs font-medium ${
                                isPlaceholder
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {r.row_number}
                            </span>
                            <input
                              type="text"
                              value={r.instruction}
                              onChange={(e) =>
                                updateRow(key, r.row_number, e.target.value)
                              }
                              placeholder={
                                isPlaceholder ? 'Fill in this row…' : ''
                              }
                              className={`flex-1 px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                                isPlaceholder
                                  ? 'border-amber-400 dark:border-amber-700'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setParseResult(null)}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Back to text
            </button>
            <button
              type="button"
              onClick={savePanels}
              disabled={saving || !canSave}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
            >
              {saving
                ? 'Saving…'
                : `Save ${parseResult.panels.length} panel${parseResult.panels.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
