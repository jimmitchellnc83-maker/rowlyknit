import { FiPlus, FiTrash2, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import {
  SECTION_TYPE_LABELS,
  type CustomDraft,
  type DraftSection,
  type DraftSectionType,
} from '../../types/customDraft';

interface CustomDraftEditorProps {
  draft: CustomDraft;
  onChange: (next: CustomDraft) => void;
}

const SECTION_TYPES: DraftSectionType[] = [
  'straight',
  'ribbing',
  'increase',
  'decrease',
  'cast_off_each_side',
  'bind_off',
];

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Section types where changePerSide is meaningful (rendered greyed-out
 *  for the others). */
const SECTIONS_WITH_SHAPING: ReadonlySet<DraftSectionType> = new Set([
  'increase',
  'decrease',
  'cast_off_each_side',
]);

export default function CustomDraftEditor({ draft, onChange }: CustomDraftEditorProps) {
  const updateSection = (id: string, updates: Partial<DraftSection>) => {
    onChange({
      ...draft,
      sections: draft.sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  const removeSection = (id: string) => {
    onChange({ ...draft, sections: draft.sections.filter((s) => s.id !== id) });
  };

  const addSection = () => {
    onChange({
      ...draft,
      sections: [
        ...draft.sections,
        {
          id: newId(),
          name: 'New section',
          type: 'straight',
          rows: 20,
          changePerSide: 0,
          note: '',
        },
      ],
    });
  };

  const moveSection = (id: string, direction: -1 | 1) => {
    const idx = draft.sections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= draft.sections.length) return;
    const next = [...draft.sections];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange({ ...draft, sections: next });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Craft mode</span>
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            value={draft.craftMode}
            onChange={(e) => onChange({ ...draft, craftMode: e.target.value as CustomDraft['craftMode'] })}
          >
            <option value="hand">Hand knitting</option>
            <option value="machine">Machine knitting</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Starting stitches</span>
          <input
            type="number"
            min={0}
            step={1}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            value={draft.startingStitches}
            onChange={(e) =>
              onChange({ ...draft, startingStitches: Math.max(0, Number(e.target.value) || 0) })
            }
          />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          Sections ({draft.sections.length})
        </h3>
        <button
          type="button"
          onClick={addSection}
          className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:bg-gray-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
        >
          <FiPlus className="h-3 w-3" /> Add section
        </button>
      </div>

      <div className="space-y-3">
        {draft.sections.map((section, idx) => {
          const showShapingField = SECTIONS_WITH_SHAPING.has(section.type);
          return (
            <div
              key={section.id}
              className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 dark:border-purple-900/40 dark:bg-purple-900/10"
            >
              <div className="grid grid-cols-12 items-end gap-2">
                <label className="col-span-12 text-xs sm:col-span-4">
                  <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Name</span>
                  <input
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    value={section.name}
                    onChange={(e) => updateSection(section.id, { name: e.target.value })}
                  />
                </label>
                <label className="col-span-6 text-xs sm:col-span-3">
                  <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Type</span>
                  <select
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    value={section.type}
                    onChange={(e) => updateSection(section.id, { type: e.target.value as DraftSectionType })}
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {SECTION_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-3 text-xs sm:col-span-2">
                  <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Rows</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    value={section.rows}
                    onChange={(e) =>
                      updateSection(section.id, { rows: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </label>
                <label className="col-span-3 text-xs sm:col-span-2">
                  <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                    Δ each side
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={!showShapingField}
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:disabled:bg-gray-800"
                    value={section.changePerSide}
                    onChange={(e) =>
                      updateSection(section.id, {
                        changePerSide: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </label>
                <div className="col-span-12 flex items-center justify-end gap-1 sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => moveSection(section.id, -1)}
                    disabled={idx === 0}
                    aria-label="Move section up"
                    className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    <FiArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(section.id, 1)}
                    disabled={idx === draft.sections.length - 1}
                    aria-label="Move section down"
                    className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    <FiArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(section.id)}
                    aria-label="Remove section"
                    className="rounded border border-red-300 bg-white p-1 text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-gray-700 dark:text-red-300"
                  >
                    <FiTrash2 className="h-3 w-3" />
                  </button>
                </div>
                <label className="col-span-12 text-xs">
                  <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Note</span>
                  <textarea
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    rows={1}
                    value={section.note}
                    onChange={(e) => updateSection(section.id, { note: e.target.value })}
                  />
                </label>
              </div>
            </div>
          );
        })}
        {draft.sections.length === 0 && (
          <p className="rounded border border-dashed border-gray-300 p-4 text-center text-sm italic text-gray-500">
            No sections yet — click "Add section" to start drafting.
          </p>
        )}
      </div>
    </div>
  );
}
