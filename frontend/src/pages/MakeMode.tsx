/**
 * Make Mode — canonical pattern execution surface.
 *
 * Reads a canonical Pattern + its `progress_state` and renders a
 * tablet-first row tracker with linked counters, per-section progress,
 * and the PDF source files / QuickKeys the knitter pinned during setup.
 *
 *   - 44px+ tap targets on every frequent control (Make Mode runs on
 *     tablets/PWA while the user has needles in hand)
 *   - Multiple linked counters with named labels
 *   - Per-section progress visible at a glance ("at the same time")
 *   - Active-section selector
 *   - Source files + QuickKeys embedded so the user can reference any
 *     pinned chart snippet without losing row state
 *   - Persistence via PUT /api/pattern-models/:id (both progress_state
 *     and per-section parameters._totalRows)
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiHelpCircle, FiBookOpen, FiFileText, FiX, FiTrash2 } from 'react-icons/fi';
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
// `parameters._totalRows` is set by Make Mode's "Set total rows" editor
// or by Author Mode when that surface is enabled.
const totalRowsFor = (section: PatternSection): number | undefined => {
  const v = section.parameters?.['_totalRows'];
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  return undefined;
};

/** Pure helper — return a new sections array with `_totalRows` patched
 *  on the matching section. Other parameters are preserved. */
export function patchSectionTotalRows(
  sections: PatternSection[],
  sectionId: string,
  totalRows: number,
): PatternSection[] {
  return sections.map((s) =>
    s.id === sectionId
      ? { ...s, parameters: { ...s.parameters, _totalRows: totalRows } }
      : s,
  );
}

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

  const persistTotalRows = async (sectionId: string, totalRows: number) => {
    if (!pattern) return;
    setSaveError(null);
    const nextSections = patchSectionTotalRows(pattern.sections, sectionId, totalRows);
    try {
      await update.mutateAsync({ id: id!, patch: { sections: nextSections } });
      trackDesignerEvent(DESIGNER_EVENTS.PATTERN_SAVED, {
        craft: pattern.craft,
        technique: pattern.technique,
        sectionCount: nextSections.length,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save total rows';
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
              onSetTotalRows={persistTotalRows}
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
  onSetTotalRows: (sectionId: string, totalRows: number) => Promise<void> | void;
  isPending: boolean;
  analyticsContext: { craft: 'knit' | 'crochet'; technique: string };
}) {
  const { section, progress, onMutate, onSetTotalRows, isPending, analyticsContext } = props;
  const total = totalRowsFor(section);
  const row = rowForSection(progress, section.id);
  const fraction = sectionFraction(progress, section.id, total);
  const complete = isSectionComplete(progress, section.id, total);

  const [showSetter, setShowSetter] = useState(false);
  const [setterValue, setSetterValue] = useState(String(row));
  const [totalEditor, setTotalEditor] = useState<string | null>(null);
  const [totalEditorError, setTotalEditorError] = useState<string | null>(null);

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
          aria-label="Reset section to row 0"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
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

      <div className="mt-3 flex flex-wrap items-stretch justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setSetterValue(String(row));
            setShowSetter(true);
          }}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
        >
          Jump to row…
        </button>
        <button
          type="button"
          onClick={() => {
            setTotalEditorError(null);
            setTotalEditor(total !== undefined ? String(total) : '');
          }}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
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
          error={totalEditorError}
          isPending={isPending}
          onChange={(v) => {
            setTotalEditorError(null);
            setTotalEditor(v);
          }}
          onCancel={() => {
            setTotalEditorError(null);
            setTotalEditor(null);
          }}
          onSubmit={async () => {
            const n = Number(totalEditor);
            if (!Number.isFinite(n) || n <= 0) {
              setTotalEditorError('Enter a row count greater than 0.');
              return;
            }
            await onSetTotalRows(section.id, Math.floor(n));
            setTotalEditorError(null);
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
          <li
            key={id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/30"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200">
              {id}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onMutate(decrementCounter(progress, id))}
                aria-label={`Decrement ${id}`}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-gray-200 text-lg font-bold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              >
                −
              </button>
              <span className="min-w-[2.5rem] text-center text-lg font-semibold tabular-nums">
                {counters[id]}
              </span>
              <button
                type="button"
                onClick={() => {
                  onMutate(incrementCounter(progress, id));
                  trackDesignerEvent(DESIGNER_EVENTS.COUNTER_INCREMENTED, analyticsContext);
                }}
                aria-label={`Increment ${id}`}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-blue-600 text-lg font-bold text-white hover:bg-blue-700"
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
                aria-label={`Remove counter ${id}`}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:hover:bg-red-900/20"
              >
                <FiTrash2 className="h-4 w-4" />
                <span className="sr-only">Remove counter {id}</span>
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
          aria-label="New counter name"
          className="min-h-[44px] flex-1 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
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
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
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
    <div
      role="dialog"
      aria-label="Jump to row"
      className="mt-3 rounded-md border border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20"
    >
      <label className="block text-sm font-medium text-blue-900 dark:text-blue-200" htmlFor="make-jump-row">
        Jump to row
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="make-jump-row"
          type="number"
          min={0}
          inputMode="numeric"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="min-h-[44px] flex-1 rounded-md border border-blue-300 px-3 text-base dark:border-blue-700 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={props.onSubmit}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          aria-label="Cancel jump to row"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-blue-300 px-4 text-sm font-medium text-blue-900 dark:border-blue-700 dark:text-blue-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TotalRowsEditor(props: {
  value: string;
  error: string | null;
  isPending: boolean;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <div
      role="dialog"
      aria-label="Set total rows"
      className="mt-3 rounded-md border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/30"
    >
      <label className="block text-sm font-medium text-gray-800 dark:text-gray-100" htmlFor="make-total-rows">
        Total rows for this section
      </label>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        Saved to this section so the row counter can show progress and the
        completion banner.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="make-total-rows"
          type="number"
          min={1}
          inputMode="numeric"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="min-h-[44px] flex-1 rounded-md border border-gray-300 px-3 text-base dark:border-gray-600 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={() => void props.onSubmit()}
          disabled={props.isPending}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {props.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          aria-label="Cancel total rows edit"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
        >
          <FiX className="h-4 w-4" />
          <span className="sr-only">Cancel</span>
        </button>
      </div>
      {props.error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {props.error}
        </p>
      )}
    </div>
  );
}

