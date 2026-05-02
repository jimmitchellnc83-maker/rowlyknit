/**
 * Author Mode — PR 5 of the Designer rebuild.
 *
 * Reads a canonical Pattern (`pattern_models` table) and renders the
 * pattern as structured sections + per-section editable metadata. Behind
 * the `VITE_DESIGNER_AUTHOR_MODE` flag — disabled by default in prod
 * until the canonical chart layer + side-by-side editor mature.
 *
 * What this page does today:
 *  - Loads the canonical pattern via `usePatternModel(id)`
 *  - Renders pattern metadata (name, craft, technique, gauge)
 *  - Lists sections with editable name + notes + chart placement summary
 *  - US/UK terminology toggle for crochet patterns
 *  - Saves edits via `useUpdatePatternModel`
 *
 * What's deferred (per gap analysis):
 *  - Inline chart editor (the chart rendering layer ships with PR 6's
 *    Make mode + a follow-up canonical-chart UI PR)
 *  - Side-by-side chart/text sync (depends on chart editor)
 *  - Repeat-block editor (depends on chart editor)
 *  - Multi-size grading editor
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import { usePatternModel, useUpdatePatternModel } from '../hooks/usePatternModel';
import { resolveDialectAbbreviation, type TerminologyDialect } from '../utils/techniqueRules';
import { DESIGNER_EVENTS, trackDesignerEvent } from '../lib/designerAnalytics';
import type { CanonicalPattern, PatternSection, Technique } from '../types/pattern';

const TECHNIQUE_LABELS: Record<Technique, string> = {
  standard: 'Standard',
  lace: 'Lace',
  cables: 'Cables',
  colorwork: 'Colorwork',
  tapestry: 'Tapestry',
  filet: 'Filet',
  tunisian: 'Tunisian',
};

export default function AuthorMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: pattern, isLoading, error } = usePatternModel(id);
  const update = useUpdatePatternModel();

  const [dialect, setDialect] = useState<TerminologyDialect>('us');
  const [sections, setSections] = useState<PatternSection[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useSeo({
    title: pattern ? `Author — ${pattern.name}` : 'Author Mode',
    description: 'Edit a canonical pattern in Rowly Author Mode.',
    canonicalPath: id ? `/patterns/${id}/author` : '/patterns',
  });

  // Initialize editable state from the loaded pattern.
  useEffect(() => {
    if (!pattern) return;
    setSections(pattern.sections);
    setName(pattern.name);
    setNotes(pattern.notes ?? '');
    setDirty(false);
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

  const handleSave = async () => {
    if (!id) return;
    setSaveError(null);
    try {
      await update.mutateAsync({
        id,
        patch: { name: name.trim(), sections, notes: notes.trim() || null },
      });
      setDirty(false);
      if (pattern) {
        trackDesignerEvent(DESIGNER_EVENTS.PATTERN_SAVED, {
          craft: pattern.craft,
          technique: pattern.technique,
          sectionCount: sections.length,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save';
      setSaveError(message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Author Mode (preview)</p>
          <h1 className="text-2xl font-semibold">{pattern.name || 'Untitled Pattern'}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {pattern.craft === 'knit' ? 'Knit' : 'Crochet'} ·{' '}
            {TECHNIQUE_LABELS[pattern.technique] ?? pattern.technique}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pattern.craft === 'crochet' && (
            <DialectToggle
              value={dialect}
              onChange={(d) => {
                setDialect(d);
                trackDesignerEvent(DESIGNER_EVENTS.DIALECT_TOGGLED, {
                  craft: pattern.craft,
                  technique: pattern.technique,
                  dialect: d,
                });
              }}
            />
          )}
          <button
            type="button"
            disabled={!dirty || update.isPending}
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {saveError}
        </div>
      )}

      <PatternMetaPanel
        name={name}
        notes={notes}
        onNameChange={(v) => {
          setName(v);
          setDirty(true);
        }}
        onNotesChange={(v) => {
          setNotes(v);
          setDirty(true);
        }}
      />

      <GaugeSummary pattern={pattern} />

      <SectionsEditor
        sections={sections}
        pattern={pattern}
        dialect={dialect}
        onChange={(next) => {
          setSections(next);
          setDirty(true);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PatternMetaPanel(props: {
  name: string;
  notes: string;
  onNameChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Pattern info</h2>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Name</span>
        <input
          type="text"
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Notes</span>
        <textarea
          value={props.notes}
          onChange={(e) => props.onNotesChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>
    </section>
  );
}

function GaugeSummary({ pattern }: { pattern: CanonicalPattern }) {
  const g = pattern.gaugeProfile;
  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Gauge</h2>
      <p className="text-sm text-gray-700 dark:text-gray-200">
        {g.stitches} sts × {g.rows} rows over {g.measurement} {g.unit}
        {g.toolSize ? <span className="ml-2 text-gray-500">({g.toolSize})</span> : null}
      </p>
    </section>
  );
}

function DialectToggle(props: {
  value: TerminologyDialect;
  onChange: (v: TerminologyDialect) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-600"
      role="group"
      aria-label="Terminology dialect"
    >
      {(['us', 'uk'] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => props.onChange(d)}
          aria-pressed={props.value === d}
          className={`px-3 py-1.5 text-xs font-medium uppercase ${
            props.value === d
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200'
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

function SectionsEditor(props: {
  sections: PatternSection[];
  pattern: CanonicalPattern;
  dialect: TerminologyDialect;
  onChange: (next: PatternSection[]) => void;
}) {
  const { sections, pattern, dialect, onChange } = props;

  const updateSection = (idx: number, patch: Partial<PatternSection>) => {
    const next = sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.sortOrder - b.sortOrder),
    [sections],
  );

  if (sortedSections.length === 0) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800">
        This pattern has no sections yet.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Sections ({sortedSections.length})
      </h2>
      {sortedSections.map((section, idx) => (
        <div
          key={section.id}
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              {section.kind}
            </span>
            <input
              type="text"
              value={section.name}
              onChange={(e) => updateSection(idx, { name: e.target.value })}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm font-semibold dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <ChartPlacementSummary section={section} pattern={pattern} dialect={dialect} />
          <textarea
            value={section.notes ?? ''}
            onChange={(e) => updateSection(idx, { notes: e.target.value || null })}
            rows={2}
            placeholder="Section notes…"
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      ))}
    </section>
  );
}

function ChartPlacementSummary(props: {
  section: PatternSection;
  pattern: CanonicalPattern;
  dialect: TerminologyDialect;
}) {
  const placement = props.section.chartPlacement;
  if (!placement || !placement.chartId) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">No chart attached to this section.</p>
    );
  }

  // Render any legend overrides so the dialect toggle is visibly meaningful
  // even before the canonical chart-rendering layer ships.
  const legend = props.pattern.legend.overrides;
  const sample = Object.keys(legend).slice(0, 4);

  return (
    <div className="rounded border border-dashed border-gray-300 p-3 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300">
      <p className="font-medium">
        Chart {placement.chartId}{' '}
        <span className="text-gray-400">
          ({placement.repeatMode ?? 'tile'} mode)
        </span>
      </p>
      {placement.offset && (
        <p className="text-gray-500">
          Offset: x={placement.offset.x}, y={placement.offset.y}
        </p>
      )}
      {sample.length > 0 && (
        <p className="mt-2 text-gray-500">
          Legend overrides:{' '}
          {sample.map((sym, i) => {
            const display = resolveDialectAbbreviation(
              sym,
              props.pattern.craft,
              props.pattern.technique,
              props.dialect,
            );
            return (
              <span key={sym} className="mr-2">
                {sym} → <strong>{display}</strong>
                {i < sample.length - 1 ? ',' : ''}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
