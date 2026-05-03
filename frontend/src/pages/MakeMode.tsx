/**
 * Make Mode — canonical pattern execution surface.
 *
 * Reads a canonical Pattern + its `progress_state` and renders a
 * mobile-first row tracker with linked counters, per-section progress,
 * and the PDF source files / QuickKeys the knitter pinned during setup.
 *
 *   - Big tap targets for +1 / -1 row (44px+ for thumb access)
 *   - Multiple linked counters with named labels
 *   - Per-section progress visible at a glance ("at the same time")
 *   - Active-section selector
 *   - Source files + QuickKeys embedded so the user can reference any
 *     pinned chart snippet without losing row state
 *   - Persistence via PUT /api/pattern-models/:id
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiHelpCircle, FiBookOpen, FiFileText } from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';
import { usePatternModel, useUpdatePatternModel } from '../hooks/usePatternModel';
import {
  decrementCounter,
  decrementRow,
  incrementCounter,
  incrementRow,
  isSectionComplete,
  resetSection,
  rowForSection,
  sectionFraction,
  setActiveSection,
  setCounter,
  setRow,
} from '../utils/progressMath';
import { DESIGNER_EVENTS, trackDesignerEvent } from '../lib/designerAnalytics';
import type { CanonicalPattern, PatternSection, ProgressState } from '../types/pattern';
import QuickKeysPanel from '../components/quickkeys/QuickKeysPanel';
import SourceFilesPanel from '../components/source-files/SourceFilesPanel';

// 2026-04-28 product call: take the legacy compute totals out of band
// for now so Make Mode doesn't depend on the canonical chart layer.
// `parameters._totalRows` is populated when the Author UI saves a row
// estimate; otherwise we ask the user (set-row dialog).
const totalRowsFor = (section: PatternSection): number | undefined => {
  const v = section.parameters['_totalRows'];
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  return undefined;
};

export default function MakeMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: pattern, isLoading, error } = usePatternModel(id);
  const update = useUpdatePatternModel();

  const [progress, setProgress] = useState<ProgressState>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useSeo({
    title: pattern ? `Make — ${pattern.name}` : 'Make Mode',
    description: 'Track row-by-row progress on a Rowly pattern.',
    canonicalPath: id ? `/patterns/${id}/make` : '/patterns',
  });

  // Initialize from the loaded pattern's progress_state.
  useEffect(() => {
    if (!pattern) return;
    setProgress(pattern.progressState ?? {});
  }, [pattern]);

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-8">Loading pattern…</div>;
  }
  if (error || !pattern) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-600">Pattern not found or you don't have access.</p>
        <button
          type="button"
          onClick={() => navigate('/patterns')}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Back to patterns
        </button>
      </div>
    );
  }

  const persist = async (next: ProgressState) => {
    setProgress(next);
    setSaveError(null);
    try {
      await update.mutateAsync({ id: id!, patch: { progressState: next } });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save progress';
      setSaveError(message);
    }
  };

  const sortedSections = [...pattern.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeSection =
    sortedSections.find((s) => s.id === progress.activeSectionId) ?? sortedSections[0];

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Make Mode</p>
          <h1 className="text-xl font-semibold sm:text-2xl">{pattern.name || 'Untitled Pattern'}</h1>
        </div>
        <Link
          to="/help/knit911"
          className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:border-purple-400 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
          title="Common knitting problems and fixes"
        >
          <FiHelpCircle className="h-3.5 w-3.5" />
          Stuck?
        </Link>
      </header>

      {saveError && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <SectionPicker
            sections={sortedSections}
            progress={progress}
            onPick={(sectionId) => {
              persist(setActiveSection(progress, sectionId));
              trackDesignerEvent(DESIGNER_EVENTS.ACTIVE_SECTION_SWITCHED, {
                craft: pattern.craft,
                technique: pattern.technique,
                sectionKind: sortedSections.find((s) => s.id === sectionId)?.kind ?? 'unknown',
              });
            }}
          />

          {activeSection && (
            <ActiveSectionPanel
              section={activeSection}
              progress={progress}
              onMutate={persist}
              isPending={update.isPending}
              analyticsContext={{ craft: pattern.craft, technique: pattern.technique }}
            />
          )}

          <ConcurrentSections
            sections={sortedSections}
            progress={progress}
            activeSectionId={activeSection?.id ?? null}
          />

          <CountersPanel
            progress={progress}
            onMutate={persist}
            analyticsContext={{ craft: pattern.craft, technique: pattern.technique }}
          />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <ReferenceMaterials
            pattern={pattern}
            activeRow={activeSection ? rowForSection(progress, activeSection.id) : undefined}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Reference panel: source PDFs + QuickKeys for the canonical pattern.
 * Source files attach to the legacy pattern row that the canonical
 * pattern was derived from (`pattern.sourcePatternId`). When that link
 * is missing, render a hint so the user knows where to look — instead
 * of an empty silent panel.
 */
function ReferenceMaterials({
  pattern,
  activeRow,
}: {
  pattern: CanonicalPattern;
  activeRow?: number;
}) {
  const [tab, setTab] = useState<'quickkeys' | 'pdfs'>('quickkeys');
  const sourcePatternId = pattern.sourcePatternId;

  if (!sourcePatternId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-4">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
          <FiFileText className="h-4 w-4" /> Pattern PDFs
        </h2>
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
          This pattern doesn't have a linked PDF yet. Open the pattern's
          Sources tab to upload one — your QuickKeys and crops will
          appear here automatically.
        </p>
        <Link
          to={`/patterns/${pattern.id}?tab=sources`}
          className="mt-2 inline-block text-xs font-medium text-amber-900 dark:text-amber-200 underline"
        >
          Open Sources tab
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setTab('quickkeys')}
          aria-pressed={tab === 'quickkeys'}
          className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-medium ${
            tab === 'quickkeys'
              ? 'text-purple-700 dark:text-purple-300 border-b-2 border-purple-600'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <FiBookOpen className="h-4 w-4" />
          QuickKeys
        </button>
        <button
          type="button"
          onClick={() => setTab('pdfs')}
          aria-pressed={tab === 'pdfs'}
          className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-medium ${
            tab === 'pdfs'
              ? 'text-purple-700 dark:text-purple-300 border-b-2 border-purple-600'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <FiFileText className="h-4 w-4" />
          PDFs
        </button>
      </div>
      <div className="p-3">
        {tab === 'quickkeys' ? (
          <QuickKeysPanel patternId={sourcePatternId} activeRow={activeRow} />
        ) : (
          <div className="min-h-[400px]">
            <SourceFilesPanel patternId={sourcePatternId} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionPicker(props: {
  sections: PatternSection[];
  progress: ProgressState;
  onPick: (sectionId: string) => void;
}) {
  const { sections, progress, onPick } = props;
  if (sections.length === 0) return null;
  const activeId = progress.activeSectionId ?? sections[0].id;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {sections.map((s) => {
        const total = totalRowsFor(s);
        const row = rowForSection(progress, s.id);
        const isActive = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            aria-pressed={isActive}
            className={`min-h-[44px] flex-1 sm:flex-initial rounded-md border px-3 py-2 text-sm ${
              isActive
                ? 'border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
            }`}
          >
            <span className="block font-semibold">{s.name}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Row {row}
              {total !== undefined ? ` / ${total}` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ActiveSectionPanel(props: {
  section: PatternSection;
  progress: ProgressState;
  onMutate: (next: ProgressState) => void;
  isPending: boolean;
  analyticsContext: { craft: 'knit' | 'crochet'; technique: string };
}) {
  const { section, progress, onMutate, isPending, analyticsContext } = props;
  const total = totalRowsFor(section);
  const row = rowForSection(progress, section.id);
  const fraction = sectionFraction(progress, section.id, total);
  const complete = isSectionComplete(progress, section.id, total);

  const [showSetter, setShowSetter] = useState(false);
  const [setterValue, setSetterValue] = useState(String(row));
  const [totalEditor, setTotalEditor] = useState<string | null>(null);

  useEffect(() => {
    setSetterValue(String(row));
  }, [row]);

  return (
    <section className="mb-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {section.name} <span className="text-gray-400">· {section.kind}</span>
        </h2>
        <button
          type="button"
          onClick={() => onMutate(resetSection(progress, section.id))}
          disabled={isPending}
          className="text-xs text-gray-500 underline disabled:opacity-50 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Reset
        </button>
      </div>

      <div className="mb-4 text-center">
        <p className="text-5xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
          {row}
          {total !== undefined && <span className="text-2xl text-gray-400"> / {total}</span>}
        </p>
        {total !== undefined && (
          <div className="mx-auto mt-2 h-2 max-w-xs rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{ width: `${Math.round(fraction * 100)}%` }}
            />
          </div>
        )}
        {complete && (
          <p className="mt-2 text-sm font-medium text-green-700 dark:text-green-400">
            Section complete!
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            onMutate(decrementRow(progress, section.id));
            trackDesignerEvent(DESIGNER_EVENTS.ROW_DECREMENTED, {
              ...analyticsContext,
              sectionKind: section.kind,
            });
          }}
          disabled={isPending || row === 0}
          aria-label="Decrement row"
          className="min-h-[64px] rounded-lg bg-gray-100 text-2xl font-bold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          −1
        </button>
        <button
          type="button"
          onClick={() => {
            onMutate(incrementRow(progress, section.id, total));
            trackDesignerEvent(DESIGNER_EVENTS.ROW_INCREMENTED, {
              ...analyticsContext,
              sectionKind: section.kind,
            });
          }}
          disabled={isPending || (total !== undefined && row >= total)}
          aria-label="Increment row"
          className="min-h-[64px] rounded-lg bg-blue-600 text-2xl font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          +1
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setSetterValue(String(row));
            setShowSetter(true);
          }}
          className="text-blue-600 underline hover:text-blue-800"
        >
          Jump to row…
        </button>
        <button
          type="button"
          onClick={() =>
            setTotalEditor(total !== undefined ? String(total) : '')
          }
          className="text-gray-500 underline hover:text-gray-700 dark:hover:text-gray-300"
        >
          {total !== undefined ? `Edit total (${total})` : 'Set total rows'}
        </button>
      </div>

      {showSetter && (
        <RowSetterDialog
          value={setterValue}
          onChange={setSetterValue}
          onCancel={() => setShowSetter(false)}
          onSubmit={() => {
            const n = Number(setterValue);
            if (Number.isFinite(n)) {
              onMutate(setRow(progress, section.id, n, total));
            }
            setShowSetter(false);
          }}
        />
      )}

      {totalEditor !== null && (
        <TotalRowsEditor
          value={totalEditor}
          onChange={setTotalEditor}
          onCancel={() => setTotalEditor(null)}
          onSubmit={() => {
            const n = Number(totalEditor);
            if (!Number.isFinite(n) || n <= 0) {
              setTotalEditor(null);
              return;
            }
            // Patch the section's _totalRows parameter via the state
            // mutator. We don't have a direct setter, so this would
            // need to be lifted up to a section-PATCH call. For PR 6,
            // emit a console warning; full wiring lands when Author
            // mode gets section parameter editing.
            // eslint-disable-next-line no-console
            console.warn(
              `[MakeMode] _totalRows editing requires Author mode for now (set parameters._totalRows on the section).`,
            );
            setTotalEditor(null);
          }}
        />
      )}
    </section>
  );
}

function ConcurrentSections(props: {
  sections: PatternSection[];
  progress: ProgressState;
  activeSectionId: string | null;
}) {
  const { sections, progress, activeSectionId } = props;
  const others = sections.filter((s) => s.id !== activeSectionId);
  const tracked = others.filter((s) => rowForSection(progress, s.id) > 0);
  if (tracked.length === 0) return null;

  return (
    <section className="mb-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        At the same time
      </h2>
      <ul className="space-y-1">
        {tracked.map((s) => {
          const total = totalRowsFor(s);
          const row = rowForSection(progress, s.id);
          return (
            <li key={s.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-200">{s.name}</span>
              <span className="tabular-nums text-gray-500">
                {row}
                {total !== undefined ? ` / ${total}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CountersPanel(props: {
  progress: ProgressState;
  onMutate: (next: ProgressState) => void;
  analyticsContext: { craft: 'knit' | 'crochet'; technique: string };
}) {
  const { progress, onMutate, analyticsContext } = props;
  const [newName, setNewName] = useState('');
  const counters = progress.counters ?? {};
  const counterIds = Object.keys(counters).sort();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
        Linked counters
      </h2>
      {counterIds.length === 0 && (
        <p className="mb-3 text-xs text-gray-500">
          Add a counter for repeats, increases, or any side count you need.
        </p>
      )}
      <ul className="mb-3 space-y-2">
        {counterIds.map((id) => (
          <li key={id} className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-200">{id}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onMutate(decrementCounter(progress, id))}
                aria-label={`Decrement ${id}`}
                className="min-h-[36px] min-w-[36px] rounded bg-gray-100 px-2 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                −
              </button>
              <span className="min-w-[2rem] text-center font-semibold tabular-nums">
                {counters[id]}
              </span>
              <button
                type="button"
                onClick={() => {
                  onMutate(incrementCounter(progress, id));
                  trackDesignerEvent(DESIGNER_EVENTS.COUNTER_INCREMENTED, analyticsContext);
                }}
                aria-label={`Increment ${id}`}
                className="min-h-[36px] min-w-[36px] rounded bg-blue-600 px-2 text-sm text-white hover:bg-blue-700"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = { ...counters };
                  delete next[id];
                  onMutate({ ...progress, counters: next });
                  trackDesignerEvent(DESIGNER_EVENTS.COUNTER_REMOVED, analyticsContext);
                }}
                aria-label={`Delete ${id}`}
                className="text-xs text-red-600 underline hover:text-red-800"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New counter name"
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => {
            const trimmed = newName.trim();
            if (!trimmed || counters[trimmed] !== undefined) return;
            onMutate(setCounter(progress, trimmed, 0));
            setNewName('');
            trackDesignerEvent(DESIGNER_EVENTS.COUNTER_ADDED, analyticsContext);
          }}
          className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        >
          Add
        </button>
      </div>
    </section>
  );
}

function RowSetterDialog(props: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
      <label className="block text-sm font-medium text-blue-900 dark:text-blue-200">
        Jump to row
      </label>
      <div className="mt-2 flex gap-2">
        <input
          type="number"
          min={0}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="flex-1 rounded-md border border-blue-300 px-2 py-1 text-sm dark:border-blue-700 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={props.onSubmit}
          className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        >
          Go
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-md border border-blue-300 px-3 py-1 text-sm dark:border-blue-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TotalRowsEditor(props: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/30">
      <p className="text-xs text-gray-700 dark:text-gray-200">
        Set the total row count for this section. Use Author mode for now to
        persist this value into the section's parameters.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="number"
          min={0}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={props.onSubmit}
          className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        >
          OK
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm dark:border-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

