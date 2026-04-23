import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiX } from 'react-icons/fi';
import { PANEL_TEMPLATES, type PanelTemplate } from '../../data/panelTemplates';

interface Props {
  projectId: string;
  groupId: string;
  onSaved: () => void;
  onCancel: () => void;
}

export default function TemplatePicker({
  projectId,
  groupId,
  onSaved,
  onCancel,
}: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [customName, setCustomName] = useState<Record<string, string>>({});

  const addTemplate = async (template: PanelTemplate) => {
    setSavingId(template.id);
    try {
      await axios.post(
        `/api/projects/${projectId}/panel-groups/${groupId}/panels`,
        {
          name: customName[template.id] || template.name,
          repeatLength: template.repeat_length,
          rowOffset: 0,
          displayColor: template.display_color,
          rows: template.rows.map((r) => ({
            rowNumber: r.row_number,
            instruction: r.instruction,
          })),
        },
      );
      toast.success(`Added "${template.name}"`);
      onSaved();
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
      toast.error(msg || 'Could not add template');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Pick a template
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
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Pre-built panels for common stitch patterns. You can rename, recolor,
        and edit rows after adding.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PANEL_TEMPLATES.map((template) => {
          const isSaving = savingId === template.id;
          const name = customName[template.id] ?? template.name;
          return (
            <div
              key={template.id}
              className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3"
              style={{ borderLeftWidth: 4, borderLeftColor: template.display_color }}
            >
              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setCustomName((p) => ({ ...p, [template.id]: e.target.value }))
                }
                className="w-full text-sm font-medium bg-transparent border-b border-transparent focus:border-gray-400 focus:outline-none text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {template.description} · {template.repeat_length}-row repeat
              </p>
              <button
                type="button"
                onClick={() => addTemplate(template)}
                disabled={isSaving || savingId !== null}
                className="mt-2 w-full px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
              >
                {isSaving ? 'Adding…' : 'Add this template'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
