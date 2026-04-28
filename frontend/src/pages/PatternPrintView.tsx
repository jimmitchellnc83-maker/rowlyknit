import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FiArrowLeft, FiPrinter } from 'react-icons/fi';
import {
  computeBlanket,
  computeBodyBlock,
  computeCustomDraft,
  computeHat,
  computeMittens,
  computeScarf,
  computeShawl,
  computeSleeve,
  computeSocks,
  formatLength,
  toInches,
  type BlanketInput,
  type BodyBlockInput,
  type BodyBlockOutput,
  type HatInput,
  type MittenInput,
  type ScarfInput,
  type ShawlInput,
  type SleeveInput,
  type SockInput,
} from '../utils/designerMath';
import BodySchematic from '../components/designer/BodySchematic';
import HatSchematic from '../components/designer/HatSchematic';
import MittenSchematic from '../components/designer/MittenSchematic';
import RectSchematic from '../components/designer/RectSchematic';
import ShawlSchematic from '../components/designer/ShawlSchematic';
import SleeveSchematic from '../components/designer/SleeveSchematic';
import SockSchematic from '../components/designer/SockSchematic';
import CustomDraftSchematic from '../components/designer/CustomDraftSchematic';
import ChartGrid from '../components/designer/ChartGrid';
import { estimateYardageFromArea, formatYardage, type YardageRange } from '../utils/yardageEstimate';
import { finishedAreaSqIn } from '../utils/designerArea';
import { estimatePerColorYardage, displayLabel, displayPercent } from '../utils/yarnEstimatePerColor';
import { type DesignerFormSnapshot } from '../utils/designerSnapshot';
import { formatDate } from '../utils/formatDate';
import { DEFAULT_CUSTOM_DRAFT } from '../types/customDraft';
import { useChartSymbols } from '../hooks/useChartSymbols';
import { buildChartInstructions, collectChartSymbols } from '../utils/chartInstruction';
import { StitchIcon } from '../data/stitchSvgLibrary';

/**
 * Clean printable pattern write-up. Reads the same localStorage key the
 * designer page writes to, recomputes outputs, and formats them as a
 * document a knitter can print or save as PDF (via the browser's print
 * dialog — "Save as PDF" works everywhere).
 *
 * Not a separate data model — this is a pure presentation layer over the
 * designer form state. The Designer page owns the inputs; the print view
 * is a rendering of the latest state.
 */

const LS_KEY = 'rowly:designer:current';

// DesignerFormSnapshot is imported from utils/designerSnapshot — shared
// with the Designer page (producer), Project Detail (embedder), and this
// print view (renderer) so they all agree on the shape.

function readForm(): DesignerFormSnapshot | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DesignerFormSnapshot;
  } catch {
    return null;
  }
}

function normGauge(f: DesignerFormSnapshot) {
  const m = toInches(f.gaugeMeasurement as number, f.unit);
  return {
    stitchesPer4in: ((f.gaugeStitches as number) / m) * 4,
    rowsPer4in: ((f.gaugeRows as number) / m) * 4,
  };
}

function itemTitle(t: string): string {
  const map: Record<string, string> = {
    sweater: 'Sweater',
    hat: 'Hat',
    scarf: 'Scarf',
    blanket: 'Blanket',
    shawl: 'Shawl',
    mittens: 'Mittens',
    socks: 'Socks',
    custom: 'Custom shape',
  };
  return map[t] ?? 'Pattern';
}

// ---------------------------------------------------------------------------
// Print-scoped styles. Applied inline so they're guaranteed to reach the
// print layout (no CSS-module / tailwind-purge surprises).
// ---------------------------------------------------------------------------

const PRINT_STYLES = `
  @media print {
    /* Hide the global app chrome (sidebar, top bars, sync indicator). */
    aside, nav.fixed, .fixed.top-4, [aria-label="Back to Designer"], [data-print-hide="true"] {
      display: none !important;
    }
    /* Let the print-view fill the page. */
    body { background: white !important; }
    .md\\:ml-64 { margin-left: 0 !important; }
    /* Page breaks between major sections. */
    .print-page-break { break-before: page; }
    .print-avoid-break { break-inside: avoid; }
    /* Readable typography. */
    body, .print-body { font-size: 11pt; line-height: 1.5; color: black !important; }
    h1 { font-size: 22pt; }
    h2 { font-size: 14pt; }
  }
`;

type PrintMode = 'knitting' | 'publishing';

function readMode(raw: string | null): PrintMode {
  return raw === 'publishing' ? 'publishing' : 'knitting';
}

export default function PatternPrintView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const patternId = searchParams.get('patternId');
  const mode: PrintMode = readMode(searchParams.get('mode'));

  const setMode = (next: PrintMode) => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'knitting') sp.delete('mode');
    else sp.set('mode', next);
    setSearchParams(sp, { replace: true });
  };

  // Source precedence: ?patternId > ?projectId > localStorage (in-progress
  // Designer draft). Pattern + project modes fetch the saved snapshot
  // from the server; localStorage mode is the default when neither is set.
  const remoteMode = projectId || patternId;
  const [form, setForm] = useState<DesignerFormSnapshot | null>(() =>
    remoteMode ? null : readForm(),
  );
  const [loading, setLoading] = useState(!!remoteMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!remoteMode) return;
    let cancelled = false;
    (async () => {
      try {
        const url = projectId
          ? `/api/projects/${projectId}`
          : `/api/patterns/${patternId}`;
        const res = await axios.get(url);
        if (cancelled) return;
        const obj = projectId
          ? res.data.data.project
          : res.data.data.pattern;
        const snapshot = obj?.metadata?.designer as DesignerFormSnapshot | undefined;
        if (!snapshot) {
          setLoadError(
            projectId
              ? 'This project has no design attached.'
              : 'This pattern has no design attached.',
          );
        } else {
          setForm(snapshot);
          setSourceTitle(obj.name ?? null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setLoadError(e.response?.data?.message ?? 'Could not load the source.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, patternId, remoteMode]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading project design…</div>;
  }

  if (loadError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{loadError}</p>
        <p className="mt-2 text-sm text-gray-500">
          <Link to="/projects" className="text-purple-600 underline">
            Back to Projects
          </Link>
        </p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-700 dark:text-gray-300">
          No design found. Visit the{' '}
          <Link to="/designer" className="text-purple-600 underline">
            Designer
          </Link>{' '}
          to create one, then return here to print.
        </p>
      </div>
    );
  }

  const gauge = normGauge(form);
  const unitLabel = form.unit === 'cm' ? 'cm' : 'in';

  return (
    <div className="max-w-4xl mx-auto p-6 print-body">
      <style>{PRINT_STYLES}</style>

      {/* Toolbar — hidden in print */}
      <div className="mb-6 flex items-center justify-between" data-print-hide="true">
        {projectId ? (
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex items-center gap-2 text-sm text-purple-700 hover:underline"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
        ) : patternId ? (
          <Link
            to={`/patterns/${patternId}`}
            className="inline-flex items-center gap-2 text-sm text-purple-700 hover:underline"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back to pattern
          </Link>
        ) : (
          <Link
            to="/designer"
            className="inline-flex items-center gap-2 text-sm text-purple-700 hover:underline"
            aria-label="Back to Designer"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back to Designer
          </Link>
        )}
        <div className="flex items-center gap-3">
          <div
            className="inline-flex rounded-md border border-gray-300 dark:border-gray-600"
            role="group"
            aria-label="Print mode"
          >
            {[
              { value: 'knitting' as const, label: 'Knitting copy' },
              { value: 'publishing' as const, label: 'Publishing copy' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                aria-pressed={mode === opt.value}
                className={`px-3 py-1.5 text-xs font-medium ${
                  mode === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200'
                }`}
                title={
                  opt.value === 'knitting'
                    ? 'Compact, knitter-focused — no cover page'
                    : 'Sellable PDF with cover page + sectioned layout'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <FiPrinter className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {mode === 'publishing' && (
        <PublishingCover form={form} sourceTitle={sourceTitle} />
      )}

      {/* Pattern header */}
      <header className="mb-6 border-b border-gray-300 pb-4 print-avoid-break">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {form.patternTitle?.trim() || sourceTitle || itemTitle(form.itemType)}
        </h1>
        {form.patternSubtitle?.trim() && (
          <p className="mt-1 text-base text-gray-700 dark:text-gray-300">
            {form.patternSubtitle}
          </p>
        )}
        {!form.patternTitle && sourceTitle && (
          <p className="text-sm text-gray-500">{itemTitle(form.itemType)}</p>
        )}
        {form.patternDesignerName?.trim() && (
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Designed by {form.patternDesignerName}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          Generated {formatDate(new Date(), {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {' · '}
          Gauge {form.gaugeStitches} sts × {form.gaugeRows} rows over {form.gaugeMeasurement}{' '}
          {unitLabel}
        </p>

        {form.patternSummary?.trim() && (
          <p className="mt-3 text-sm text-gray-800 dark:text-gray-200">{form.patternSummary}</p>
        )}

        {form.colors.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Colors</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {form.colors.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded border border-gray-400"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden="true"
                  />
                  <span className="text-sm">
                    {i === 0 ? 'MC · ' : ''}
                    {c.label}{' '}
                    <span className="font-mono text-xs text-gray-500">{c.hex.toUpperCase()}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {form.patternNotes?.trim() && (
        <Section title="Notes from the designer">
          <p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-200">
            {form.patternNotes}
          </p>
        </Section>
      )}

      {/* Render by item type */}
      {form.itemType === 'sweater' && <SweaterPrint form={form} gauge={gauge} />}
      {form.itemType === 'hat' && <HatPrint form={form} gauge={gauge} />}
      {form.itemType === 'scarf' && <ScarfPrint form={form} gauge={gauge} />}
      {form.itemType === 'blanket' && <BlanketPrint form={form} gauge={gauge} />}
      {form.itemType === 'shawl' && <ShawlPrint form={form} gauge={gauge} />}
      {form.itemType === 'mittens' && <MittensPrint form={form} gauge={gauge} />}
      {form.itemType === 'socks' && <SocksPrint form={form} gauge={gauge} />}
      {form.itemType === 'custom' && <CustomDraftPrint form={form} gauge={gauge} />}

      {form.chart && (
        <div className="print-page-break mt-8">
          <Section title="Chart">
            <p className="mb-2 text-xs text-gray-500">
              {form.chart.workedInRound
                ? 'Read the chart from the bottom up. Every round reads right-to-left.'
                : 'Read the chart from the bottom up. RS rows read right-to-left; WS rows left-to-right.'}
            </p>
            {/* Non-interactive render — tool is "erase" but the grid itself
                doesn't matter since we don't care about interactions here. */}
            <ChartGrid chart={form.chart} onChange={() => {}} tool={{ type: 'erase' }} />
          </Section>
          <ChartInstructionsSection form={form} />
          <ChartGlossarySection form={form} />
        </div>
      )}

      {form.patternCopyright?.trim() && (
        <footer className="mt-10 border-t border-gray-300 pt-3 text-xs text-gray-500 print-avoid-break">
          {form.patternCopyright}
        </footer>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-item-type print sections. Each renders the schematic + shaping schedule.
// ---------------------------------------------------------------------------

type PrintProps<F = DesignerFormSnapshot> = {
  form: F;
  gauge: { stitchesPer4in: number; rowsPer4in: number };
};

/**
 * Publishing-mode cover page. Renders title, subtitle, designer name,
 * summary, and copyright on its own first page (page-break-after) so
 * the rest of the document starts on page 2 in PDF / print output.
 *
 * Falls back to the source title (project name / pattern name) when
 * `patternTitle` isn't set, since otherwise an unfilled-out cover would
 * read literally as "Sweater" — fine for a knitting copy but not for a
 * sellable publishing copy.
 */
function PublishingCover({
  form,
  sourceTitle,
}: {
  form: DesignerFormSnapshot;
  sourceTitle: string | null;
}) {
  const title = form.patternTitle?.trim() || sourceTitle || itemTitle(form.itemType);
  return (
    <section
      className="print-page-break flex min-h-[80vh] flex-col items-center justify-center gap-4 border-b border-gray-300 px-6 py-12 text-center print-avoid-break"
      style={{ pageBreakAfter: 'always' }}
    >
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-gray-500">
        {itemTitle(form.itemType)}
      </p>
      <h1 className="text-5xl font-bold leading-tight text-gray-900 dark:text-gray-100">
        {title}
      </h1>
      {form.patternSubtitle?.trim() && (
        <p className="max-w-xl text-lg text-gray-700 dark:text-gray-300">{form.patternSubtitle}</p>
      )}
      {form.patternDesignerName?.trim() && (
        <p className="mt-4 text-base text-gray-800 dark:text-gray-200">
          Designed by <strong>{form.patternDesignerName}</strong>
        </p>
      )}
      {form.patternSummary?.trim() && (
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-800 dark:text-gray-200">
          {form.patternSummary}
        </p>
      )}
      <div className="mt-auto pt-12 text-xs text-gray-500">
        {form.patternCopyright?.trim() || (
          <>
            Generated{' '}
            {formatDate(new Date(), {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}{' '}
            with Rowly Designer
          </>
        )}
      </div>
    </section>
  );
}

function StepList({ steps }: { steps: BodyBlockOutput['steps'] }) {
  return (
    <ol className="space-y-3 print-avoid-break">
      {steps.map((step, i) => (
        <li key={i} className="print-avoid-break">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">{i + 1}. {step.label}</span>
            <span className="text-xs text-gray-500">
              {step.startStitches === 0
                ? `${step.endStitches} sts`
                : step.endStitches === 0
                  ? `${step.startStitches} sts`
                  : `${step.startStitches} → ${step.endStitches} sts`}
              {step.rows > 1 && <> · {step.rows} rows</>}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">{step.instruction}</p>
        </li>
      ))}
    </ol>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 print-avoid-break">
      <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </section>
  );
}

function YardageCard({ yardage, form, area }: { yardage: YardageRange; form?: DesignerFormSnapshot; area?: number }) {
  // When the draft has both a chart and a palette, split the total
  // across the colors actually painted so the materials list reads as
  // a real shopping list rather than one mystery number.
  const breakdown =
    form && area && form.chart && form.colors.length > 0
      ? estimatePerColorYardage(
          area,
          { stitchesPer4in: (form.gaugeStitches as number) || 0, rowsPer4in: (form.gaugeRows as number) || 0 },
          form.chart,
          form.colors,
        )
      : null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm print-avoid-break">
      <p className="font-semibold text-amber-900">Estimated yardage: {formatYardage(yardage)}</p>
      {breakdown && breakdown.rows.length > 1 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-900">
          {breakdown.rows.map((row) => (
            <li key={row.hex} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 flex-shrink-0 rounded border border-amber-300"
                style={{ backgroundColor: row.hex }}
                aria-hidden="true"
              />
              <span className="font-medium">{displayLabel(row)}</span>
              <span className="text-amber-700">·</span>
              <span>{formatYardage(row.yardage)}</span>
              <span className="text-amber-700">·</span>
              <span className="text-amber-700">{displayPercent(row.fraction)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-amber-800">
        Rough range based on finished area and gauge. Cables use more, lace uses less. Add 10–15% for stranded
        colorwork (floats). Buy a bit extra for swatching and weaving in ends.
      </p>
    </div>
  );
}

/**
 * Renders the chart's written instructions per the snapshot's
 * `chartInstructionMode`:
 *   - shape-only      → nothing (the chart still appears separately)
 *   - with-chart-ref  → a one-line "Work Chart for N rows/rounds." reference
 *   - with-chart-text → a numbered row-by-row list (Row 1 (RS): k2, p2, ...)
 *
 * Mirrors the live preview in the Designer's ChartInstructionsPanel — same
 * engine, same output, so what knitters see in the editor matches the
 * print-view deliverable.
 */
function ChartInstructionsSection({ form }: { form: DesignerFormSnapshot }) {
  const mode = form.chartInstructionMode ?? 'with-chart-text';
  const craft = form.craft ?? 'knit';
  const palette = useChartSymbols(craft);
  const chart = form.chart;

  if (!chart || mode === 'shape-only') return null;

  if (mode === 'with-chart-ref') {
    return (
      <Section title="Chart — instructions">
        <p className="text-sm text-gray-800 dark:text-gray-200">
          Work Chart for {chart.height} {chart.workedInRound ? 'rounds' : 'rows'}.
        </p>
      </Section>
    );
  }

  if (palette.isLoading) {
    return (
      <Section title="Chart — instructions">
        <p className="text-sm text-gray-500">Loading stitch templates…</p>
      </Section>
    );
  }
  if (palette.isError || !palette.data) {
    return (
      <Section title="Chart — instructions">
        <p className="text-sm text-red-600">Couldn't load stitch templates.</p>
      </Section>
    );
  }

  const symbols = [...palette.data.system, ...palette.data.custom];
  const rows = buildChartInstructions({ chart, symbols });

  return (
    <Section title="Chart — instructions">
      <ol className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.rowNumber} className="print-avoid-break">
            <span className="font-mono font-semibold">{r.prefix}</span>{' '}
            <span>{r.isEmpty ? '(empty row)' : r.body}</span>
            {r.warnings.length > 0 && (
              <span className="ml-2 text-xs text-amber-700">⚠ {r.warnings.join('; ')}</span>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * Auto-generated glossary of every stitch symbol actually used in the
 * chart. Joins `collectChartSymbols(form.chart)` against the cached
 * `chart_symbol_templates` palette and renders one row per stitch:
 *   icon | symbol key | abbrev | name | RS | WS
 *
 * WS column is omitted entirely when the chart is worked in the round
 * (no WS rows exist). Stitches without a template still render so the
 * knitter sees the bare symbol id (helps debug missing seeds / typos).
 */
function ChartGlossarySection({ form }: { form: DesignerFormSnapshot }) {
  const chart = form.chart;
  const craft = form.craft ?? 'knit';
  const palette = useChartSymbols(craft);

  if (!chart) return null;
  const used = collectChartSymbols(chart);
  if (used.length === 0) return null;

  if (palette.isLoading) {
    return (
      <Section title="Chart — glossary">
        <p className="text-sm text-gray-500">Loading stitch templates…</p>
      </Section>
    );
  }
  if (palette.isError || !palette.data) {
    return (
      <Section title="Chart — glossary">
        <p className="text-sm text-red-600">Couldn't load stitch templates.</p>
      </Section>
    );
  }

  const bySymbol = new Map(
    [...palette.data.system, ...palette.data.custom].map((t) => [t.symbol, t]),
  );
  const showWs = !chart.workedInRound;

  return (
    <Section title="Chart — glossary">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-300 text-left text-xs uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:text-gray-400">
            <th className="w-10 py-1 pr-2">Icon</th>
            <th className="w-16 py-1 pr-2">Symbol</th>
            <th className="w-20 py-1 pr-2">Abbrev</th>
            <th className="py-1 pr-2">Name</th>
            <th className="py-1 pr-2">RS</th>
            {showWs && <th className="py-1 pr-2">WS</th>}
          </tr>
        </thead>
        <tbody>
          {used.map((symbol) => {
            const t = bySymbol.get(symbol);
            return (
              <tr
                key={symbol}
                className="border-b border-gray-200 align-top print-avoid-break dark:border-gray-700"
              >
                <td className="py-1 pr-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center">
                    <StitchIcon id={symbol} />
                  </span>
                </td>
                <td className="py-1 pr-2 font-mono text-xs">{symbol}</td>
                <td className="py-1 pr-2 font-mono text-xs">{t?.abbreviation ?? symbol}</td>
                <td className="py-1 pr-2">{t?.name ?? <em className="text-gray-400">unknown</em>}</td>
                <td className="py-1 pr-2 font-mono text-xs">{t?.rs_instruction ?? '—'}</td>
                {showWs && (
                  <td className="py-1 pr-2 font-mono text-xs">{t?.ws_instruction ?? '—'}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

function SweaterPrint({ form, gauge }: PrintProps) {
  const bodyInput: BodyBlockInput = {
    gauge,
    chestCircumference: toInches(form.chestCircumference as number, form.unit),
    easeAtChest: toInches(form.easeAtChest as number, form.unit),
    totalLength: toInches(form.totalLength as number, form.unit),
    hemDepth: toInches(form.hemDepth as number, form.unit),
    waist: form.useWaistShaping
      ? {
          waistCircumference: toInches(form.waistCircumference as number, form.unit),
          easeAtWaist: toInches(form.easeAtWaist as number, form.unit),
          waistHeightFromHem: toInches(form.waistHeightFromHem as number, form.unit),
        }
      : undefined,
    armhole: form.useArmhole
      ? {
          armholeDepth: toInches(form.armholeDepth as number, form.unit),
          shoulderWidth: toInches(form.shoulderWidth as number, form.unit),
        }
      : undefined,
    neckline:
      form.useArmhole && form.panelType === 'front'
        ? {
            necklineDepth: toInches(form.necklineDepth as number, form.unit),
            neckOpeningWidth: toInches(form.neckOpeningWidth as number, form.unit),
          }
        : undefined,
  };
  const body = computeBodyBlock(bodyInput);

  const sleeveInput: SleeveInput = {
    gauge,
    cuffCircumference: toInches(form.cuffCircumference as number, form.unit),
    easeAtCuff: toInches(form.easeAtCuff as number, form.unit),
    bicepCircumference: toInches(form.bicepCircumference as number, form.unit),
    easeAtBicep: toInches(form.easeAtBicep as number, form.unit),
    cuffToUnderarmLength: toInches(form.cuffToUnderarmLength as number, form.unit),
    cuffDepth: toInches(form.cuffDepth as number, form.unit),
    cap:
      form.useArmhole && body.armholeInitialBindOffPerSide !== null
        ? {
            matchingArmholeDepth: toInches(form.armholeDepth as number, form.unit),
            matchingArmholeInitialBindOff: body.armholeInitialBindOffPerSide,
          }
        : undefined,
  };
  const sleeve = computeSleeve(sleeveInput);

  const area = finishedAreaSqIn({ body, sleeve }) ?? 0;
  const yardage = estimateYardageFromArea(area, gauge);

  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Chest: {formatLength(body.finishedChest, form.unit)} (cast-on {body.castOnStitches} sts)</li>
          <li>Total length: {formatLength(body.finishedLength, form.unit)}</li>
          {body.finishedWaist !== null && <li>Waist: {formatLength(body.finishedWaist, form.unit)}</li>}
          <li>Sleeve: {formatLength(sleeve.finishedTotalLength, form.unit)} ({sleeve.bicepStitches} sts at bicep)</li>
          <li>Cuff: {formatLength(sleeve.finishedCuff, form.unit)}</li>
        </ul>
      </Section>

      <Section title="Yarn">
        <YardageCard yardage={yardage} form={form} area={area} />
      </Section>

      <Section title="Body — schematic">
        <BodySchematic input={bodyInput} output={body} unit={form.unit} chart={form.chart} />
      </Section>
      <Section title="Body — instructions">
        <StepList steps={body.steps} />
      </Section>

      <div className="print-page-break">
        <Section title="Sleeve — schematic">
          <SleeveSchematic input={sleeveInput} output={sleeve} unit={form.unit} chart={form.chart} />
        </Section>
        <Section title="Sleeve — instructions">
          <StepList steps={sleeve.steps} />
        </Section>
      </div>
    </>
  );
}

function HatPrint({ form, gauge }: PrintProps) {
  const input: HatInput = {
    gauge,
    headCircumference: toInches(form.headCircumference as number, form.unit),
    negativeEaseAtBrim: toInches(form.negativeEaseAtBrim as number, form.unit),
    totalHeight: toInches(form.hatTotalHeight as number, form.unit),
    brimDepth: toInches(form.hatBrimDepth as number, form.unit),
    crownHeight: toInches(form.hatCrownHeight as number, form.unit),
  };
  const out = computeHat(input);
  const area = finishedAreaSqIn({ hat: out }) ?? 0;
  const yardage = estimateYardageFromArea(area, gauge);
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Circumference: {formatLength(out.finishedCircumference, form.unit)} ({out.castOnStitches} sts)</li>
          <li>Total height: {formatLength(out.finishedHeight, form.unit)}</li>
        </ul>
      </Section>
      <Section title="Yarn">
        <YardageCard yardage={yardage} form={form} area={area} />
      </Section>
      <Section title="Schematic">
        <HatSchematic output={out} unit={form.unit} chart={form.chart} />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function ScarfPrint({ form, gauge }: PrintProps) {
  const input: ScarfInput = {
    gauge,
    width: toInches(form.scarfWidth as number, form.unit),
    length: toInches(form.scarfLength as number, form.unit),
    fringeLength: toInches(form.scarfFringeLength as number, form.unit),
  };
  const out = computeScarf(input);
  const area = finishedAreaSqIn({ scarf: out }) ?? 0;
  const yardage = estimateYardageFromArea(area, gauge);
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Width: {formatLength(out.finishedWidth, form.unit)} ({out.castOnStitches} sts)</li>
          <li>Length: {formatLength(out.finishedLength, form.unit)} ({out.totalRows} rows)</li>
          {out.fringeLength > 0 && <li>Fringe: {formatLength(out.fringeLength, form.unit)} per side</li>}
        </ul>
      </Section>
      <Section title="Yarn">
        <YardageCard yardage={yardage} form={form} area={area} />
      </Section>
      <Section title="Schematic">
        <RectSchematic
          label="Scarf"
          accent="purple"
          widthInches={out.finishedWidth}
          lengthInches={out.finishedLength}
          castOnStitches={out.castOnStitches}
          fringeInches={out.fringeLength}
          unit={form.unit}
          chart={form.chart}
        />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function BlanketPrint({ form, gauge }: PrintProps) {
  const input: BlanketInput = {
    gauge,
    width: toInches(form.blanketWidth as number, form.unit),
    length: toInches(form.blanketLength as number, form.unit),
    borderDepth: toInches(form.blanketBorderDepth as number, form.unit),
  };
  const out = computeBlanket(input);
  const area = finishedAreaSqIn({ blanket: out }) ?? 0;
  const yardage = estimateYardageFromArea(area, gauge);
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Width: {formatLength(out.finishedWidth, form.unit)} ({out.castOnStitches} sts)</li>
          <li>Length: {formatLength(out.finishedLength, form.unit)} ({out.totalRows} rows)</li>
          {out.borderStitchesPerSide > 0 && (
            <li>Border: {out.borderStitchesPerSide} sts each side</li>
          )}
        </ul>
      </Section>
      <Section title="Yarn">
        <YardageCard yardage={yardage} form={form} area={area} />
      </Section>
      <Section title="Schematic">
        <RectSchematic
          label="Blanket"
          accent="green"
          widthInches={out.finishedWidth}
          lengthInches={out.finishedLength}
          castOnStitches={out.castOnStitches}
          borderInches={typeof form.blanketBorderDepth === 'number' ? form.blanketBorderDepth : 0}
          unit={form.unit}
          chart={form.chart}
        />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function ShawlPrint({ form, gauge }: PrintProps) {
  const input: ShawlInput = {
    gauge,
    wingspan: toInches(form.shawlWingspan as number, form.unit),
    initialCastOn: form.shawlInitialCastOn as number,
  };
  const out = computeShawl(input);
  const area = finishedAreaSqIn({ shawl: out }) ?? 0;
  const yardage = estimateYardageFromArea(area, gauge);
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Wingspan: {formatLength(out.finishedWingspan, form.unit)} ({out.finalStitches} sts)</li>
          <li>Depth at center spine: {formatLength(out.finishedDepth, form.unit)}</li>
        </ul>
      </Section>
      <Section title="Yarn">
        <YardageCard yardage={yardage} form={form} area={area} />
      </Section>
      <Section title="Schematic">
        <ShawlSchematic output={out} unit={form.unit} chart={form.chart} />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function MittensPrint({ form, gauge }: PrintProps) {
  const input: MittenInput = {
    gauge,
    handCircumference: toInches(form.handCircumference as number, form.unit),
    negativeEaseAtCuff: toInches(form.negativeEaseAtMittenCuff as number, form.unit),
    thumbCircumference: toInches(form.thumbCircumference as number, form.unit),
    cuffDepth: toInches(form.mittenCuffDepth as number, form.unit),
    cuffToThumbLength: toInches(form.cuffToThumbLength as number, form.unit),
    thumbGussetLength: toInches(form.thumbGussetLength as number, form.unit),
    thumbToTipLength: toInches(form.thumbToTipLength as number, form.unit),
    thumbLength: toInches(form.thumbLength as number, form.unit),
  };
  const out = computeMittens(input);
  const area = finishedAreaSqIn({ mittens: out }) ?? 0;
  const yardage = estimateYardageFromArea(area, gauge);
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Hand: {formatLength(out.finishedHandCircumference, form.unit)} ({out.handStitches} sts)</li>
          <li>Thumb: {formatLength(out.finishedThumbCircumference, form.unit)} ({out.thumbStitches} sts)</li>
          <li>Total length: {formatLength(out.finishedLength, form.unit)}</li>
        </ul>
      </Section>
      <Section title="Yarn (pair)">
        <YardageCard yardage={yardage} form={form} area={area} />
      </Section>
      <Section title="Schematic">
        <MittenSchematic output={out} unit={form.unit} chart={form.chart} />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function SocksPrint({ form, gauge }: PrintProps) {
  const input: SockInput = {
    gauge,
    ankleCircumference: toInches(form.ankleCircumference as number, form.unit),
    negativeEaseAtCuff: toInches(form.negativeEaseAtSockCuff as number, form.unit),
    footCircumference: toInches(form.footCircumference as number, form.unit),
    cuffDepth: toInches(form.sockCuffDepth as number, form.unit),
    legLength: toInches(form.legLength as number, form.unit),
    footLength: toInches(form.footLength as number, form.unit),
  };
  const out = computeSocks(input);
  const area = finishedAreaSqIn({ socks: out }) ?? 0;
  const yardage = estimateYardageFromArea(area, gauge);
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>Ankle: {formatLength(out.finishedAnkleCircumference, form.unit)} ({out.castOnStitches} sts)</li>
          <li>Foot: {formatLength(out.finishedFootCircumference, form.unit)}</li>
          <li>Total length: {formatLength(out.finishedTotalLength, form.unit)}</li>
        </ul>
      </Section>
      <Section title="Yarn (pair)">
        <YardageCard yardage={yardage} form={form} area={area} />
      </Section>
      <Section title="Schematic">
        <SockSchematic output={out} unit={form.unit} chart={form.chart} />
      </Section>
      <Section title="Instructions">
        <StepList steps={out.steps} />
      </Section>
    </>
  );
}

function CustomDraftPrint({ form, gauge }: PrintProps) {
  const draft = form.customDraft ?? DEFAULT_CUSTOM_DRAFT;
  const out = computeCustomDraft({ draft, gauge });
  const area = finishedAreaSqIn({ customDraft: out }) ?? 0;
  const yardage = estimateYardageFromArea(area, gauge);
  return (
    <>
      <Section title="Finished measurements">
        <ul className="text-sm space-y-1">
          <li>
            Cast on: {out.startingStitches} sts ({formatLength(out.startingWidthInches, form.unit)} wide)
          </li>
          <li>
            Total: {out.totalRows} rows ({formatLength(out.totalHeightInches, form.unit)} tall)
          </li>
          <li>
            Final stitches at top: {out.finalStitches}
          </li>
          <li>
            {draft.craftMode === 'machine' ? 'Machine knitting' : 'Hand knitting'} · {out.sections.length} section{out.sections.length === 1 ? '' : 's'}
          </li>
        </ul>
      </Section>
      <Section title="Yarn">
        <YardageCard yardage={yardage} form={form} area={area} />
      </Section>
      <Section title="Schematic">
        <CustomDraftSchematic output={out} unit={form.unit} chart={form.chart} />
      </Section>
      <Section title="Instructions">
        <ol className="text-sm space-y-3 list-none p-0">
          {out.sections.map((section) => (
            <li key={section.id} className="border-t pt-3">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">
                  {section.index + 1}. {section.name}
                </span>
                <span className="text-xs text-gray-500">
                  Rows {section.startRow}–{section.endRow} · {section.rows} {section.rows === 1 ? 'row' : 'rows'}
                </span>
              </div>
              <p className="mt-1 text-gray-800 dark:text-gray-200">{section.instruction}</p>
              <p className="mt-1 text-xs text-gray-500">
                Starts at {section.startStitches} sts ({formatLength(section.startWidthInches, form.unit)}). Ends at {section.endStitches} sts ({formatLength(section.endWidthInches, form.unit)}). Height {formatLength(section.heightInches, form.unit)}.
              </p>
              {section.note && (
                <p className="mt-1 text-sm italic text-gray-700 dark:text-gray-300">Note: {section.note}</p>
              )}
            </li>
          ))}
        </ol>
        {out.warnings.length > 0 && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <strong className="text-amber-900">Check shaping:</strong>
            <ul className="ml-5 mt-1 list-disc">
              {out.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  );
}
