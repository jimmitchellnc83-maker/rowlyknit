import { useEffect, useMemo, useState } from 'react';
import { FiDroplet, FiX, FiPlus, FiEdit2, FiTrash2, FiLoader } from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  useChartSymbols,
  useDeleteCustomSymbol,
} from '../../hooks/useChartSymbols';
import {
  StitchIcon,
  getCellSpan,
  resolveStitchKey,
} from '../../data/stitchSvgLibrary';
import CustomStitchModal from './CustomStitchModal';
import type { ChartSymbolTemplate, Craft } from '../../types/chartSymbol';
import type { ColorSwatch } from './ColorPalette';
import type { ChartTool, ChartData } from './ChartGrid';

interface StitchPaletteProps {
  tool: ChartTool;
  onChange: (next: ChartTool) => void;
  /** Colors from the shared ColorPalette — show these as "your palette"
   *  above the always-available default yarn colors. */
  paletteColors: ColorSwatch[];
  /** Active craft. Filters the system + custom stitch lists. */
  craft: Craft;
  /** Active chart — drives the "Used in this chart" group. */
  chart: ChartData | null;
}

const DEFAULT_COLORS: { label: string; hex: string }[] = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Cream', hex: '#F5F1E3' },
  { label: 'Oatmeal', hex: '#D9CDB4' },
  { label: 'Charcoal', hex: '#3A3A3A' },
  { label: 'Black', hex: '#111111' },
  { label: 'Navy', hex: '#1E3A5F' },
  { label: 'Denim', hex: '#5A7EA4' },
  { label: 'Sky', hex: '#9EC4E5' },
  { label: 'Sage', hex: '#9BAE8C' },
  { label: 'Forest', hex: '#3E5D3A' },
  { label: 'Mustard', hex: '#D4A441' },
  { label: 'Rust', hex: '#A35134' },
  { label: 'Cranberry', hex: '#7E1B2E' },
  { label: 'Plum', hex: '#4D2E4A' },
  { label: 'Rose', hex: '#C68A8F' },
  { label: 'Pink', hex: '#E8A0B2' },
];

const CATEGORY_LABELS: Record<string, string> = {
  basic: 'Basic',
  decrease: 'Decreases',
  increase: 'Increases',
  cable: 'Cables & twists',
  twisted: 'Twisted',
  special: 'Special',
  colorwork: 'Colorwork',
  placeholder: 'Placeholders',
  edge: 'Edges',
  slip: 'Slipped',
};

const RECENT_LIMIT = 8;
const recentKey = (craft: Craft) => `rowly:designer:recent_stitches:${craft}`;

function readRecent(craft: Craft): string[] {
  try {
    const raw = localStorage.getItem(recentKey(craft));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(craft: Craft, list: string[]) {
  try {
    localStorage.setItem(recentKey(craft), JSON.stringify(list.slice(0, RECENT_LIMIT)));
  } catch {
    // ignore quota errors
  }
}

interface StitchSelectArgs {
  symbolKey: string;
  cellSpan: number;
}

export default function StitchPalette({ tool, onChange, paletteColors, craft, chart }: StitchPaletteProps) {
  const activeSymbolId = tool.type === 'symbol' ? tool.symbolId : null;
  const activeColor = tool.type === 'color' ? tool.hex : null;
  const isErasing = tool.type === 'erase';

  const palette = useChartSymbols(craft);
  const deleteMutation = useDeleteCustomSymbol();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ChartSymbolTemplate | null>(null);
  const [recent, setRecent] = useState<string[]>(() => readRecent(craft));

  // Reload recents when craft toggles.
  useEffect(() => {
    setRecent(readRecent(craft));
  }, [craft]);

  // Track newly-applied symbols in the recents list.
  useEffect(() => {
    if (tool.type !== 'symbol') return;
    const key = resolveStitchKey(tool.symbolId) ?? tool.symbolId;
    setRecent((prev) => {
      const next = [key, ...prev.filter((s) => s !== key)].slice(0, RECENT_LIMIT);
      writeRecent(craft, next);
      return next;
    });
  }, [tool, craft]);

  const systemRows = useMemo(() => palette.data?.system ?? [], [palette.data]);
  const customRows = useMemo(() => palette.data?.custom ?? [], [palette.data]);

  // Group system stitches by category. The DB-backed list is the source of
  // truth — every system row guarantees a curated SVG icon exists (the
  // library covers all seeded keys).
  const systemGrouped = useMemo(() => {
    const out: Record<string, ChartSymbolTemplate[]> = {};
    for (const row of systemRows) {
      const cat = row.category ?? 'special';
      if (!out[cat]) out[cat] = [];
      out[cat].push(row);
    }
    return out;
  }, [systemRows]);

  // "Used in this chart" — distinct symbol keys present in the active chart.
  const usedKeys = useMemo(() => {
    if (!chart) return [] as string[];
    const seen = new Set<string>();
    for (const cell of chart.cells) {
      if (cell.symbolId) seen.add(resolveStitchKey(cell.symbolId) ?? cell.symbolId);
    }
    return [...seen];
  }, [chart]);

  // Resolve a symbol key into label + cellSpan from either the API rows or
  // the SVG library (so usedKeys can render even if the row was deleted).
  const lookup = useMemo(() => {
    const map = new Map<string, { label: string; cellSpan: number; rs?: string | null }>();
    for (const row of [...systemRows, ...customRows]) {
      map.set(row.symbol, {
        label: row.name,
        cellSpan: row.cell_span ?? 1,
        rs: row.rs_instruction,
      });
    }
    return map;
  }, [systemRows, customRows]);

  const labelFor = (key: string) => lookup.get(key)?.label ?? key;
  const spanFor = (key: string) => lookup.get(key)?.cellSpan ?? getCellSpan(key, 1);

  const apply = ({ symbolKey }: StitchSelectArgs) => {
    onChange({ type: 'symbol', symbolId: symbolKey });
  };

  const renderStitchButton = (symbolKey: string, opts?: { onEdit?: () => void; onDelete?: () => void }) => {
    const span = spanFor(symbolKey);
    const active = activeSymbolId === symbolKey;
    return (
      <div key={symbolKey} className="relative">
        <button
          type="button"
          onClick={() => apply({ symbolKey, cellSpan: span })}
          title={`${labelFor(symbolKey)}${span > 1 ? ` · ${span} cells` : ''}`}
          aria-pressed={active}
          className={`flex h-12 items-center justify-center rounded border px-1.5 transition ${
            active
              ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-400 dark:bg-purple-900/30'
              : 'border-gray-300 bg-white hover:border-purple-300 hover:bg-purple-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
          }`}
          style={{ minWidth: 28 * span + 16 }}
        >
          <span className={active ? 'text-purple-700 dark:text-purple-100' : 'text-gray-700 dark:text-gray-200'}>
            <StitchIcon id={symbolKey} size={28} stroke="currentColor" />
          </span>
        </button>
        {(opts?.onEdit || opts?.onDelete) && (
          <div className="absolute -top-2 -right-2 flex gap-0.5">
            {opts.onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  opts.onEdit?.();
                }}
                aria-label={`Edit ${labelFor(symbolKey)}`}
                className="rounded-full bg-white p-1 text-gray-600 shadow ring-1 ring-gray-300 hover:bg-purple-50 hover:text-purple-700 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600"
              >
                <FiEdit2 className="h-3 w-3" />
              </button>
            )}
            {opts.onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  opts.onDelete?.();
                }}
                aria-label={`Delete ${labelFor(symbolKey)}`}
                className="rounded-full bg-white p-1 text-gray-600 shadow ring-1 ring-gray-300 hover:bg-red-50 hover:text-red-700 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600"
              >
                <FiTrash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const groupHeader = (label: string, count?: number) => (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
      {label}{count !== undefined ? ` · ${count}` : ''}
    </p>
  );

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      {/* Header — title + new-stitch button */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {craft === 'crochet' ? 'Crochet stitches' : 'Knit stitches'}
        </p>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-white px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-200"
        >
          <FiPlus className="h-3 w-3" />
          Custom stitch
        </button>
      </div>

      {palette.isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FiLoader className="h-3 w-3 animate-spin" />
          Loading {craft} palette…
        </div>
      )}
      {palette.isError && (
        <p className="text-xs text-red-600">Couldn't load the stitch palette. Try again later.</p>
      )}

      {/* Used in this chart */}
      {usedKeys.length > 0 && (
        <div>
          {groupHeader('Used in this chart', usedKeys.length)}
          <div className="flex flex-wrap gap-1">
            {usedKeys.map((k) => renderStitchButton(k))}
          </div>
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div>
          {groupHeader('Recent', recent.length)}
          <div className="flex flex-wrap gap-1">
            {recent.map((k) => renderStitchButton(k))}
          </div>
        </div>
      )}

      {/* My stitches */}
      {customRows.length > 0 && (
        <div>
          {groupHeader('My stitches', customRows.length)}
          <div className="flex flex-wrap gap-1">
            {customRows.map((row) =>
              renderStitchButton(row.symbol, {
                onEdit: () => {
                  setEditing(row);
                  setModalOpen(true);
                },
                onDelete: async () => {
                  if (!window.confirm(`Delete custom stitch "${row.name}"?`)) return;
                  try {
                    await deleteMutation.mutateAsync(row.id);
                    toast.success('Custom stitch deleted');
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message || 'Could not delete stitch');
                  }
                },
              }),
            )}
          </div>
        </div>
      )}

      {/* System stitches grouped by category */}
      {Object.keys(systemGrouped)
        .sort((a, b) => systemOrder(a) - systemOrder(b))
        .map((cat) => (
          <div key={cat}>
            {groupHeader(CATEGORY_LABELS[cat] ?? cat, systemGrouped[cat].length)}
            <div className="flex flex-wrap gap-1">
              {systemGrouped[cat].map((row) => renderStitchButton(row.symbol))}
            </div>
          </div>
        ))}

      {/* Empty state — no API rows yet */}
      {!palette.isLoading && !palette.isError && systemRows.length === 0 && customRows.length === 0 && (
        <p className="text-xs text-gray-500">
          No stitches in the palette for {craft}. {customRows.length === 0 && '+ Custom stitch to add one.'}
          {systemRows.length === 0 && ' (System palette didn\'t load — check your connection.)'}
        </p>
      )}

      {/* Color palette + eraser stay below the stitches */}
      <div>
        <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <FiDroplet className="h-3 w-3" />
          Colors
        </p>

        {paletteColors.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Your palette
            </p>
            <div className="flex flex-wrap gap-1">
              {paletteColors.map((c) => {
                const active = activeColor === c.hex;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange({ type: 'color', hex: c.hex })}
                    title={c.label}
                    className={`flex h-10 w-10 items-center justify-center rounded border text-[10px] transition ${
                      active
                        ? 'border-purple-600 ring-2 ring-purple-400'
                        : 'border-gray-300 hover:border-purple-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={c.label}
                    aria-pressed={active}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Defaults
          </p>
          <div className="flex flex-wrap gap-1">
            {DEFAULT_COLORS.map((c) => {
              const active = activeColor === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => onChange({ type: 'color', hex: c.hex })}
                  title={c.label}
                  className={`flex h-10 w-10 items-center justify-center rounded border text-[10px] transition ${
                    active
                      ? 'border-purple-600 ring-2 ring-purple-400'
                      : 'border-gray-300 hover:border-purple-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.label}
                  aria-pressed={active}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => onChange({ type: 'erase' })}
          className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition ${
            isErasing
              ? 'border-red-600 bg-red-50 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:text-red-200'
              : 'border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
          }`}
        >
          <FiX className="h-4 w-4" />
          Erase
        </button>
        <span className="text-xs text-gray-500">
          Click / drag on the grid to paint. Multi-cell stitches paint a run automatically.
        </span>
      </div>

      {modalOpen && (
        <CustomStitchModal
          craft={craft}
          initial={editing ?? undefined}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={(saved) => onChange({ type: 'symbol', symbolId: saved.symbol })}
        />
      )}
    </div>
  );
}

// Order categories so basics come first, then increases/decreases, etc.
function systemOrder(cat: string): number {
  const order = ['basic', 'increase', 'decrease', 'cable', 'twisted', 'special', 'colorwork', 'placeholder', 'edge', 'slip'];
  const i = order.indexOf(cat);
  return i === -1 ? 99 : i;
}
