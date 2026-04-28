/**
 * Canonical pattern export — PR 7 of the Designer rebuild.
 *
 * Pure transformation from a `CanonicalPattern` to a normalized
 * "printable" structure that downstream renderers can pipe through
 * any output format (Markdown, PDF, HTML, plain text). Centralized
 * here so the chart-only / text-only / combined export targets
 * share one source of truth instead of building three near-duplicate
 * renderers.
 *
 * What this does NOT do:
 *  - Render the chart cells visually. That requires the canonical
 *    chart-rendering layer + the existing pdf-lib pipeline; this
 *    module emits a `chartReference` placeholder per section that
 *    a future renderer can hydrate.
 *  - Resolve canonical chart legend symbols against the pattern
 *    legend. Use `applyLegendOverrides` from `patternSymbolOverlay.ts`
 *    on the symbol palette before passing it in.
 *
 * The intended consumer is `pages/PatternPrintView.tsx` (extended in
 * a follow-up PR) and `backend/src/services/patternExportService.ts`
 * (when it learns to read canonical rows).
 */

import type { CanonicalPattern, PatternSection } from '../types/pattern';
import type { TerminologyDialect } from './techniqueRules';
import { resolveDialectAbbreviation } from './techniqueRules';

export type ExportFormat = 'chart-only' | 'text-only' | 'combined';

export interface ExportOptions {
  format: ExportFormat;
  /** US/UK abbreviation dialect for crochet patterns. Ignored for knit. */
  dialect?: TerminologyDialect;
  /** Include section notes in the printable output. */
  includeNotes?: boolean;
  /** Include the materials list. */
  includeMaterials?: boolean;
}

export interface PrintableSection {
  id: string;
  name: string;
  kind: PatternSection['kind'];
  sortOrder: number;
  /** "Sweater body", "Hat", etc. — humanized version of `kind`. */
  humanKind: string;
  notes: string | null;
  /** Per-section parameter pairs ("Chest: 38 in"). Pulled verbatim
   *  from `parameters` excluding leading-underscore internals. */
  parameterRows: Array<{ key: string; value: string }>;
  chartReference: ChartReference | null;
}

export interface ChartReference {
  chartId: string;
  repeatMode: string;
  offsetSummary: string | null;
  layer: number;
}

export interface PrintableLegendEntry {
  symbol: string;
  /** Display name after override resolution. */
  name: string;
  /** Display abbreviation after override + dialect resolution. */
  abbreviation: string;
}

export interface PrintablePattern {
  id: string;
  name: string;
  craft: 'knit' | 'crochet';
  technique: string;
  /** Format chosen by the caller; included so renderers know what to
   *  drop ("text-only" suppresses chart cells, etc.). */
  format: ExportFormat;
  dialect: TerminologyDialect;
  gauge: string;
  notes: string | null;
  sections: PrintableSection[];
  legend: PrintableLegendEntry[];
  materials: Array<{ id: string; name: string; colorHex: string | null }>;
}

const HUMAN_KINDS: Record<PatternSection['kind'], string> = {
  'sweater-body': 'Sweater body',
  'sweater-sleeve': 'Sleeve',
  hat: 'Hat',
  scarf: 'Scarf',
  blanket: 'Blanket',
  shawl: 'Shawl',
  mittens: 'Mittens',
  socks: 'Socks',
  'custom-draft-section': 'Custom section',
};

const formatGauge = (g: CanonicalPattern['gaugeProfile']): string => {
  const tool = g.toolSize ? ` (${g.toolSize})` : '';
  return `${g.stitches} sts × ${g.rows} rows over ${g.measurement} ${g.unit}${tool}`;
};

const isInternalKey = (key: string): boolean => key.startsWith('_');

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.map(formatValue).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const buildParameterRows = (
  section: PatternSection,
  format: ExportFormat,
): PrintableSection['parameterRows'] => {
  // text-only mode strips parameters that wouldn't read well in
  // narrative writing (chart geometry, internal markers).
  const rows: PrintableSection['parameterRows'] = [];
  for (const [key, value] of Object.entries(section.parameters)) {
    if (isInternalKey(key)) continue;
    if (format === 'chart-only') continue;
    const formatted = formatValue(value);
    if (formatted === '') continue;
    rows.push({ key, value: formatted });
  }
  return rows;
};

const buildChartReference = (section: PatternSection): ChartReference | null => {
  const placement = section.chartPlacement;
  if (!placement || !placement.chartId) return null;
  const offsetSummary = placement.offset
    ? `x=${placement.offset.x}, y=${placement.offset.y}`
    : null;
  return {
    chartId: placement.chartId,
    repeatMode: placement.repeatMode ?? 'tile',
    offsetSummary,
    layer: placement.layer ?? 0,
  };
};

const buildLegend = (
  pattern: CanonicalPattern,
  dialect: TerminologyDialect,
): PrintableLegendEntry[] => {
  const overrides = pattern.legend.overrides;
  return Object.values(overrides).map((entry) => {
    const symbolKey = entry.symbol;
    const name = entry.nameOverride ?? symbolKey;
    const abbreviation =
      entry.abbreviationOverride ??
      resolveDialectAbbreviation(symbolKey, pattern.craft, pattern.technique, dialect);
    return { symbol: symbolKey, name, abbreviation };
  });
};

const buildMaterials = (
  pattern: CanonicalPattern,
  format: ExportFormat,
  includeMaterials: boolean,
): PrintablePattern['materials'] => {
  if (!includeMaterials || format === 'chart-only') return [];
  return pattern.materials.map((m) => ({
    id: m.id,
    name: m.name,
    colorHex: m.colorHex ?? null,
  }));
};

/**
 * Convert a canonical Pattern to a printable structure.
 *
 * Pure — never throws on missing optional fields, never mutates the
 * input. Callers pass an `ExportFormat` to control which sections of
 * the output get populated; downstream renderers walk the result.
 */
export function buildPrintablePattern(
  pattern: CanonicalPattern,
  options: ExportOptions,
): PrintablePattern {
  const dialect: TerminologyDialect = options.dialect ?? 'us';

  const sortedSections = [...pattern.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  const sections: PrintableSection[] = sortedSections.map((section) => ({
    id: section.id,
    name: section.name,
    kind: section.kind,
    sortOrder: section.sortOrder,
    humanKind: HUMAN_KINDS[section.kind] ?? section.kind,
    notes: options.includeNotes === false ? null : section.notes ?? null,
    parameterRows: buildParameterRows(section, options.format),
    chartReference: buildChartReference(section),
  }));

  return {
    id: pattern.id,
    name: pattern.name,
    craft: pattern.craft,
    technique: pattern.technique,
    format: options.format,
    dialect,
    gauge: formatGauge(pattern.gaugeProfile),
    notes: pattern.notes,
    sections,
    legend: buildLegend(pattern, dialect),
    materials: buildMaterials(pattern, options.format, options.includeMaterials !== false),
  };
}

/**
 * Render a printable pattern to plain Markdown. Used by the
 * "Copy as Markdown" export target and by Author mode's preview pane.
 * The structured `PrintablePattern` is the canonical intermediate;
 * Markdown is one of several possible renderers.
 */
export function renderPrintableAsMarkdown(p: PrintablePattern): string {
  const lines: string[] = [];
  lines.push(`# ${p.name}`);
  lines.push('');
  lines.push(`**${p.craft === 'knit' ? 'Knit' : 'Crochet'}** — ${p.technique}`);
  lines.push(`Gauge: ${p.gauge}`);
  if (p.dialect === 'uk' && p.craft === 'crochet') {
    lines.push('Terminology: UK');
  }
  if (p.notes) {
    lines.push('');
    lines.push(p.notes);
  }
  if (p.materials.length > 0) {
    lines.push('');
    lines.push('## Materials');
    for (const m of p.materials) {
      const color = m.colorHex ? ` (${m.colorHex})` : '';
      lines.push(`- ${m.name}${color}`);
    }
  }
  if (p.sections.length > 0) {
    lines.push('');
    lines.push('## Sections');
    for (const s of p.sections) {
      lines.push('');
      lines.push(`### ${s.name} — ${s.humanKind}`);
      if (s.parameterRows.length > 0) {
        for (const row of s.parameterRows) {
          lines.push(`- **${row.key}:** ${row.value}`);
        }
      }
      if (s.chartReference && p.format !== 'text-only') {
        lines.push(`- Chart: ${s.chartReference.chartId} (${s.chartReference.repeatMode})`);
      }
      if (s.notes) {
        lines.push('');
        lines.push(s.notes);
      }
    }
  }
  if (p.legend.length > 0 && p.format !== 'text-only') {
    lines.push('');
    lines.push('## Legend');
    for (const entry of p.legend) {
      lines.push(`- **${entry.abbreviation}** — ${entry.name}`);
    }
  }
  return lines.join('\n');
}
