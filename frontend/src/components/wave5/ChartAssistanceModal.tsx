import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { FiCheck, FiGrid, FiX, FiZap } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { sourceFileBytesUrl, type PatternCrop } from '../../lib/sourceFiles';
import {
  confirmMagicMarkerMatches,
  getChartAlignment,
  listChartSymbolPalette,
  recordMagicMarkerSample,
  setChartAlignment,
  type ChartAlignment,
  type MatchCandidate,
} from '../../lib/wave5';
import type { ChartSymbolTemplate } from '../../types/chartSymbol';
import { dHashRegion, hammingDistance } from './dHash';
import '../../lib/pdfjsWorker';

interface Props {
  sourceFileId: string;
  crop: PatternCrop;
  onClose: () => void;
}

/**
 * Wave 5 chart assistance — opens a crop in a modal with grid alignment
 * + sample tagging + match preview. Single-component implementation so
 * users see the full visible chart-assistance UI the PRD requires
 * without bouncing through five screens.
 *
 * Workflow:
 *  1. Pick crop → modal opens
 *  2. If no alignment yet, user enters cells across/down (defaults to
 *     using the entire crop as the grid bbox). Save → backend persists.
 *  3. Grid lines overlay on the rendered PDF page.
 *  4. Tap a cell → prompt for symbol → backend records sample +
 *     client-side dHash so future matches use the visual fingerprint.
 *  5. "Find similar" runs the most recent sample's hash against every
 *     other recorded sample on this alignment and highlights matches.
 */
export default function ChartAssistanceModal({ sourceFileId, crop, onClose }: Props) {
  const [alignment, setAlignment] = useState<ChartAlignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAlignment, setSavingAlignment] = useState(false);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);

  // Default grid covers the full crop. The user can adjust by editing
  // numeric inputs — full draggable handles are a follow-up.
  const [draftCellsAcross, setDraftCellsAcross] = useState<string>('20');
  const [draftCellsDown, setDraftCellsDown] = useState<string>('20');
  const [draftGridX, setDraftGridX] = useState<string>('0');
  const [draftGridY, setDraftGridY] = useState<string>('0');
  const [draftGridW, setDraftGridW] = useState<string>('1');
  const [draftGridH, setDraftGridH] = useState<string>('1');

  const [samples, setSamples] = useState<
    Array<{ row: number; col: number; symbol: string; hash: string | null }>
  >([]);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [findingMatches, setFindingMatches] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Magic Marker user-controlled sensitivity. Higher = more permissive
  // (returns more candidates). Range matches the underlying dHash space:
  // 0 (identical) → 64 (totally different). 12 is the historical default
  // that worked well for tight chart symbols on a clean PDF; users can
  // loosen for blurry scans or tighten when they're getting noise. The
  // value is the Hamming distance threshold passed to the scan loop.
  const SENSITIVITY_MIN = 4;
  const SENSITIVITY_MAX = 24;
  const [sensitivity, setSensitivity] = useState<number>(12);

  // Per-candidate selection. Default: every newly-found match is
  // selected. The user can deselect false positives in the side panel
  // before applying. Apply writes ONLY selected cells.
  const [selectedMatchKeys, setSelectedMatchKeys] = useState<Set<string>>(
    new Set(),
  );
  const matchKey = (row: number, col: number) => `${row}:${col}`;

  // Symbol picker state (replaces window.prompt). When pendingCell is
  // set, the user has tapped a cell and a picker overlay is shown.
  const [palette, setPalette] = useState<ChartSymbolTemplate[]>([]);
  const [pendingCell, setPendingCell] = useState<{ row: number; col: number } | null>(null);
  const [symbolDraft, setSymbolDraft] = useState<string>('');

  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  /** The PDF column inside the modal — measured live so the rendered
   *  page reflows on resize / orientation change instead of being
   *  frozen at the window-innerWidth value at modal-open time. */
  const pdfColumnRef = useRef<HTMLDivElement | null>(null);
  const [pdfColumnWidth, setPdfColumnWidth] = useState<number>(720);

  useEffect(() => {
    let cancelled = false;
    listChartSymbolPalette()
      .then((p) => {
        if (cancelled) return;
        setPalette([...p.system, ...p.custom]);
      })
      .catch(() => {
        // No palette is OK — picker degrades to free-form input.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = pdfColumnRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setPdfColumnWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setPdfColumnWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * Rendered PDF page width derived from the live PDF column. Subtract
   * the column's px-3 padding (24px each side) and clamp so the chart
   * stays legible: never below 320 (small phone), never above 720
   * (chart symbols start to look fuzzy past that on a desktop).
   */
  const targetWidth = useMemo(() => {
    const usable = pdfColumnWidth - 24;
    if (!Number.isFinite(usable) || usable <= 0) return 720;
    return Math.max(320, Math.min(usable, 720));
  }, [pdfColumnWidth]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getChartAlignment(sourceFileId, crop.id)
      .then((a) => {
        if (cancelled) return;
        setAlignment(a);
        if (a) {
          setDraftCellsAcross(String(a.cellsAcross));
          setDraftCellsDown(String(a.cellsDown));
          setDraftGridX(String(a.gridX));
          setDraftGridY(String(a.gridY));
          setDraftGridW(String(a.gridWidth));
          setDraftGridH(String(a.gridHeight));
        }
      })
      .catch(() => {
        // 404 / network issue: leave alignment null so the setup form
        // shows. Don't toast — that's noisy when an unaligned crop is
        // the expected first-open state.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceFileId, crop.id]);

  function getPageCanvas(): HTMLCanvasElement | null {
    return pageContainerRef.current?.querySelector('canvas') ?? null;
  }

  function cropToPagePixels(): {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null {
    if (!pageSize) return null;
    return {
      x: crop.cropX * pageSize.w,
      y: crop.cropY * pageSize.h,
      w: crop.cropWidth * pageSize.w,
      h: crop.cropHeight * pageSize.h,
    };
  }

  async function handleSaveAlignment() {
    const cellsAcross = Number(draftCellsAcross);
    const cellsDown = Number(draftCellsDown);
    const gridX = Number(draftGridX);
    const gridY = Number(draftGridY);
    const gridWidth = Number(draftGridW);
    const gridHeight = Number(draftGridH);

    if (!Number.isInteger(cellsAcross) || cellsAcross < 1 || !Number.isInteger(cellsDown) || cellsDown < 1) {
      toast.error('Cells across/down must be positive integers.');
      return;
    }
    if (gridX < 0 || gridX > 1 || gridY < 0 || gridY > 1 || gridWidth <= 0 || gridWidth > 1 || gridHeight <= 0 || gridHeight > 1) {
      toast.error('Grid coordinates must be within 0..1.');
      return;
    }
    if (gridX + gridWidth > 1.000001 || gridY + gridHeight > 1.000001) {
      toast.error('Grid rectangle must stay inside the crop.');
      return;
    }

    setSavingAlignment(true);
    try {
      const saved = await setChartAlignment(sourceFileId, crop.id, {
        gridX,
        gridY,
        gridWidth,
        gridHeight,
        cellsAcross,
        cellsDown,
      });
      setAlignment(saved);
      toast.success('Chart grid saved.');
    } catch {
      toast.error('Could not save grid. Check the values.');
    } finally {
      setSavingAlignment(false);
    }
  }

  function handleCellTap(row: number, col: number) {
    if (!alignment) return;
    setPendingCell({ row, col });
    setSymbolDraft('');
  }

  async function commitSymbol(symbol: string) {
    if (!alignment || !pendingCell) return;
    const trimmed = symbol.trim();
    if (!trimmed || trimmed.length > 32) {
      toast.error('Symbol must be 1–32 characters.');
      return;
    }

    const { row, col } = pendingCell;
    let hash: string | null = null;
    const cropPx = cropToPagePixels();
    const canvas = getPageCanvas();
    if (cropPx && canvas) {
      const cellW = (cropPx.w * alignment.gridWidth) / alignment.cellsAcross;
      const cellH = (cropPx.h * alignment.gridHeight) / alignment.cellsDown;
      const cellX = cropPx.x + cropPx.w * alignment.gridX + col * cellW;
      const cellY = cropPx.y + cropPx.h * alignment.gridY + row * cellH;
      try {
        hash = dHashRegion(canvas, cellX, cellY, cellW, cellH);
      } catch {
        hash = null;
      }
    }

    try {
      await recordMagicMarkerSample(sourceFileId, crop.id, {
        chartAlignmentId: alignment.id,
        symbol: trimmed,
        gridRow: row,
        gridCol: col,
        imageHash: hash,
      });
      setSamples((prev) => [...prev, { row, col, symbol: trimmed, hash }]);
      if (hash) setLastHash(hash);
      toast.success(`Tagged ${trimmed} at (${row + 1}, ${col + 1}).`);
      setPendingCell(null);
      setSymbolDraft('');
    } catch {
      toast.error('Could not save sample.');
    }
  }

  /**
   * Chart-wide scan: render every cell of the alignment, hash it from
   * the rendered PDF canvas, compare to the seed hash, return the cells
   * within max Hamming distance that aren't already a sample (so the
   * find pass doesn't recommend cells the user has explicitly tagged).
   *
   * This is what "find similar" should always have done — pre-2026-05
   * the path only re-queried the samples table, which produced zero
   * useful matches because the samples table is exactly the cells the
   * user has already tagged by hand.
   */
  async function handleFindSimilar() {
    if (!alignment || !lastHash) return;
    const cropPx = cropToPagePixels();
    const canvas = getPageCanvas();
    if (!cropPx || !canvas) {
      toast.error('PDF page not ready yet — try again in a second.');
      return;
    }

    const seedSymbol = samples[samples.length - 1]?.symbol;
    if (!seedSymbol) {
      toast.error('Tag at least one cell before searching for similar ones.');
      return;
    }

    setFindingMatches(true);
    try {
      const cellW = (cropPx.w * alignment.gridWidth) / alignment.cellsAcross;
      const cellH = (cropPx.h * alignment.gridHeight) / alignment.cellsDown;
      const sampledKeys = new Set(samples.map((s) => matchKey(s.row, s.col)));
      const candidates: MatchCandidate[] = [];

      for (let row = 0; row < alignment.cellsDown; row++) {
        for (let col = 0; col < alignment.cellsAcross; col++) {
          if (sampledKeys.has(matchKey(row, col))) continue;
          const cellX = cropPx.x + cropPx.w * alignment.gridX + col * cellW;
          const cellY = cropPx.y + cropPx.h * alignment.gridY + row * cellH;
          let hash: string;
          try {
            hash = dHashRegion(canvas, cellX, cellY, cellW, cellH);
          } catch {
            continue;
          }
          let distance: number;
          try {
            distance = hammingDistance(hash, lastHash);
          } catch {
            continue;
          }
          if (distance <= sensitivity) {
            candidates.push({
              sampleId: '',
              symbol: seedSymbol,
              gridRow: row,
              gridCol: col,
              distance,
            });
          }
        }
      }

      candidates.sort((a, b) => a.distance - b.distance);
      setMatches(candidates);
      // Default: every freshly-found candidate is selected. The user can
      // deselect individual cells before Apply.
      setSelectedMatchKeys(
        new Set(candidates.map((c) => matchKey(c.gridRow, c.gridCol))),
      );
      toast.info(
        candidates.length === 0
          ? 'No matches found.'
          : `${candidates.length} candidate${candidates.length === 1 ? '' : 's'} found across the chart.`,
      );
    } catch {
      toast.error('Match scan failed.');
    } finally {
      setFindingMatches(false);
    }
  }

  function toggleMatchSelection(row: number, col: number) {
    setSelectedMatchKeys((prev) => {
      const next = new Set(prev);
      const key = matchKey(row, col);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleApplyMatches() {
    if (!crop.chartId || matches.length === 0) return;
    // All matches share the symbol of the seed sample (the last one
    // recorded). Use that symbol when writing into the canonical chart.
    const symbol = samples[samples.length - 1]?.symbol;
    if (!symbol) {
      toast.error('No seed sample to apply.');
      return;
    }

    // Apply only the user-selected subset. Filtering happens here so
    // toggle-state stays a UI concern; the persistence call only sees
    // the cells the user has explicitly opted into.
    const selected = matches.filter((m) =>
      selectedMatchKeys.has(matchKey(m.gridRow, m.gridCol)),
    );
    if (selected.length === 0) {
      toast.error('Select at least one match before applying.');
      return;
    }

    setConfirming(true);
    try {
      const result = await confirmMagicMarkerMatches(sourceFileId, crop.id, {
        chartId: crop.chartId,
        symbol,
        cells: selected.map((m) => ({ row: m.gridRow, col: m.gridCol })),
      });
      toast.success(
        `Wrote ${result.updatedCells} cell${result.updatedCells === 1 ? '' : 's'} of "${symbol}" into the chart.`,
      );
      // Clear the local matches + selection to reflect that they're
      // committed; the user can re-find to keep iterating.
      setMatches([]);
      setSelectedMatchKeys(new Set());
    } catch {
      toast.error('Could not apply matches to the chart.');
    } finally {
      setConfirming(false);
    }
  }

  // Compute pixel rect of the chart grid inside the rendered page so the
  // overlay sits exactly over the crop's grid region.
  const gridPx = (() => {
    if (!alignment || !pageSize) return null;
    const cropPx = cropToPagePixels();
    if (!cropPx) return null;
    return {
      x: cropPx.x + cropPx.w * alignment.gridX,
      y: cropPx.y + cropPx.h * alignment.gridY,
      w: cropPx.w * alignment.gridWidth,
      h: cropPx.h * alignment.gridHeight,
    };
  })();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <FiGrid className="h-4 w-4 text-blue-500" /> Chart assistance
            </h4>
            <p className="text-xs text-gray-500">
              {crop.label ? crop.label : `Crop on page ${crop.pageNumber}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chart assistance"
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 sm:p-4">
          {/* PDF page + overlays. ResizeObserver on this column drives
              the PDF render width so a phone, a 50/50 split tablet, and
              a 27" monitor all see appropriately sized chart cells. */}
          <div
            ref={pdfColumnRef}
            className="md:col-span-2 bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-auto"
          >
            <Document
              file={sourceFileBytesUrl(sourceFileId)}
              loading={<p className="text-sm text-gray-500 p-4">Loading…</p>}
              error={<p className="text-sm text-red-600 p-4">Could not load source file.</p>}
            >
              <div ref={pageContainerRef} className="relative inline-block">
                <Page
                  pageNumber={crop.pageNumber}
                  width={targetWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  onRenderSuccess={(page) => setPageSize({ w: page.width, h: page.height })}
                />
                {pageSize && cropToPagePixels() && (
                  <div
                    className="absolute border-2 border-amber-400 pointer-events-none"
                    style={{
                      left: `${cropToPagePixels()!.x}px`,
                      top: `${cropToPagePixels()!.y}px`,
                      width: `${cropToPagePixels()!.w}px`,
                      height: `${cropToPagePixels()!.h}px`,
                    }}
                  />
                )}
                {alignment && gridPx && (
                  <GridOverlay
                    pxRect={gridPx}
                    cellsAcross={alignment.cellsAcross}
                    cellsDown={alignment.cellsDown}
                    samples={samples}
                    matches={matches}
                    selectedMatchKeys={selectedMatchKeys}
                    onCellClick={handleCellTap}
                    onMatchToggle={toggleMatchSelection}
                  />
                )}
              </div>
            </Document>
          </div>

          {/* Side panel — alignment form + sample list + actions */}
          <aside className="space-y-4 text-sm">
            {loading ? (
              <p className="text-xs text-gray-500">Loading alignment…</p>
            ) : (
              <>
                <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    {alignment ? 'Edit grid' : 'Set up grid'}
                  </h5>

                  <div className="grid grid-cols-2 gap-2">
                    <CellsControl
                      label="Cells across"
                      value={draftCellsAcross}
                      onChange={setDraftCellsAcross}
                    />
                    <CellsControl
                      label="Cells down"
                      value={draftCellsDown}
                      onChange={setDraftCellsDown}
                    />
                  </div>

                  <div className="mt-3 rounded border border-gray-200 dark:border-gray-700 p-2">
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">
                      Nudge grid origin
                    </p>
                    <NudgePad
                      onNudge={(dx, dy) => {
                        const step = 0.005;
                        setDraftGridX((v) => clampDelta(v, dx * step));
                        setDraftGridY((v) => clampDelta(v, dy * step));
                      }}
                      onResize={(dw, dh) => {
                        const step = 0.005;
                        setDraftGridW((v) => clampDelta(v, dw * step));
                        setDraftGridH((v) => clampDelta(v, dh * step));
                      }}
                    />
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] text-gray-500">
                      Numeric coords (advanced)
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <NumericField label="Grid x" value={draftGridX} onChange={setDraftGridX} step={0.01} />
                      <NumericField label="Grid y" value={draftGridY} onChange={setDraftGridY} step={0.01} />
                      <NumericField label="Grid w" value={draftGridW} onChange={setDraftGridW} step={0.01} />
                      <NumericField label="Grid h" value={draftGridH} onChange={setDraftGridH} step={0.01} />
                    </div>
                  </details>

                  <button
                    type="button"
                    onClick={handleSaveAlignment}
                    disabled={savingAlignment}
                    className="mt-3 w-full rounded bg-blue-600 px-3 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingAlignment ? 'Saving…' : alignment ? 'Update grid' : 'Save grid'}
                  </button>
                </div>

                {alignment && pendingCell && (
                  <SymbolPicker
                    palette={palette}
                    value={symbolDraft}
                    onChange={setSymbolDraft}
                    onCommit={(sym) => commitSymbol(sym)}
                    onCancel={() => {
                      setPendingCell(null);
                      setSymbolDraft('');
                    }}
                    cellLabel={`row ${pendingCell.row + 1}, col ${pendingCell.col + 1}`}
                  />
                )}

                {alignment && (
                  <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                      Magic Marker
                    </h5>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                      Tap a grid cell on the chart to tag it with a symbol. Tagged samples become reference fingerprints.
                    </p>
                    <ul className="space-y-1 max-h-32 overflow-y-auto text-xs">
                      {samples.length === 0 && (
                        <li className="text-gray-400">No samples yet.</li>
                      )}
                      {samples.map((s, i) => (
                        <li key={i} className="flex justify-between">
                          <span className="font-mono text-gray-700 dark:text-gray-200">{s.symbol}</span>
                          <span className="text-gray-500">
                            ({s.row + 1}, {s.col + 1}){s.hash ? '' : ' · no hash'}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Sensitivity control. Slider value = max Hamming
                         distance allowed in the chart-wide scan. Lower
                         is stricter; higher returns more candidates. */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="magic-marker-sensitivity"
                          className="text-[11px] text-gray-500 uppercase tracking-wide"
                        >
                          Sensitivity (d≤{sensitivity})
                        </label>
                        <span className="text-[10px] text-gray-400">
                          {sensitivity <= 8 ? 'Strict' : sensitivity >= 18 ? 'Loose' : 'Balanced'}
                        </span>
                      </div>
                      <input
                        id="magic-marker-sensitivity"
                        type="range"
                        min={SENSITIVITY_MIN}
                        max={SENSITIVITY_MAX}
                        step={1}
                        value={sensitivity}
                        onChange={(e) => setSensitivity(Number(e.target.value))}
                        className="w-full"
                        aria-label="Magic Marker sensitivity"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>Strict</span>
                        <span>Loose</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleFindSimilar}
                      disabled={!lastHash || findingMatches}
                      className="mt-3 w-full rounded bg-purple-600 px-3 py-2 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <FiZap className="h-4 w-4" />
                      {findingMatches
                        ? 'Searching…'
                        : matches.length > 0
                        ? 'Refine with new sensitivity'
                        : 'Find similar to last sample'}
                    </button>

                    {matches.length > 0 && (
                      <>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-[11px] text-gray-500 flex items-center gap-1">
                            <FiCheck className="h-3 w-3 text-green-600" />
                            {selectedMatchKeys.size}/{matches.length} selected
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedMatchKeys(
                                  new Set(
                                    matches.map((m) =>
                                      matchKey(m.gridRow, m.gridCol),
                                    ),
                                  ),
                                )
                              }
                              className="text-[10px] text-blue-600 hover:underline"
                              aria-label="Select all matches"
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedMatchKeys(new Set())}
                              className="text-[10px] text-blue-600 hover:underline"
                              aria-label="Deselect all matches"
                            >
                              None
                            </button>
                          </div>
                        </div>

                        <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                          {matches.map((m) => {
                            const key = matchKey(m.gridRow, m.gridCol);
                            const checked = selectedMatchKeys.has(key);
                            return (
                              <li key={key} className="flex items-center px-2 py-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    toggleMatchSelection(m.gridRow, m.gridCol)
                                  }
                                  aria-label={`Toggle match at row ${m.gridRow + 1}, col ${m.gridCol + 1}`}
                                  className="mr-2"
                                />
                                <span className="flex-1 text-gray-700 dark:text-gray-200">
                                  ({m.gridRow + 1}, {m.gridCol + 1})
                                </span>
                                <span className="text-gray-500 font-mono">
                                  d={m.distance}
                                </span>
                              </li>
                            );
                          })}
                        </ul>

                        <button
                          type="button"
                          onClick={handleApplyMatches}
                          disabled={
                            !crop.chartId || confirming || selectedMatchKeys.size === 0
                          }
                          title={
                            crop.chartId
                              ? 'Write the selected cells into the chart\'s canonical grid'
                              : 'Link this crop to a chart first to apply matches.'
                          }
                          className="mt-2 w-full rounded bg-green-600 px-3 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {confirming
                            ? 'Applying…'
                            : `Apply ${selectedMatchKeys.size} selected to chart`}
                        </button>
                        {!crop.chartId && (
                          <p className="mt-1 text-[10px] text-gray-500 italic">
                            Link this crop to a chart to push matches into the canonical grid.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function clampDelta(current: string, delta: number): string {
  const n = Number(current);
  if (!Number.isFinite(n)) return current;
  const next = Math.max(0, Math.min(1, n + delta));
  return next.toFixed(3);
}

function CellsControl(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const n = Math.max(1, Math.round(Number(props.value) || 1));
  const step = (delta: number) =>
    props.onChange(String(Math.max(1, n + delta)));
  return (
    <div className="text-xs">
      <span className="block text-gray-500 mb-1">{props.label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease ${props.label}`}
          onClick={() => step(-1)}
          className="min-h-[36px] min-w-[36px] rounded border border-gray-300 dark:border-gray-700 px-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          step={1}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="flex-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="button"
          aria-label={`Increase ${props.label}`}
          onClick={() => step(1)}
          className="min-h-[36px] min-w-[36px] rounded border border-gray-300 dark:border-gray-700 px-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          +
        </button>
      </div>
    </div>
  );
}

function NudgePad(props: {
  onNudge: (dx: number, dy: number) => void;
  onResize: (dw: number, dh: number) => void;
}) {
  const btn =
    'min-h-[36px] min-w-[36px] rounded border border-gray-300 dark:border-gray-700 px-2 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800';
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <p className="text-[10px] text-gray-500 mb-1">Move</p>
        <div className="grid grid-cols-3 gap-1">
          <span />
          <button type="button" aria-label="Move up" className={btn} onClick={() => props.onNudge(0, -1)}>↑</button>
          <span />
          <button type="button" aria-label="Move left" className={btn} onClick={() => props.onNudge(-1, 0)}>←</button>
          <span className="flex items-center justify-center text-[10px] text-gray-400">orig</span>
          <button type="button" aria-label="Move right" className={btn} onClick={() => props.onNudge(1, 0)}>→</button>
          <span />
          <button type="button" aria-label="Move down" className={btn} onClick={() => props.onNudge(0, 1)}>↓</button>
          <span />
        </div>
      </div>
      <div>
        <p className="text-[10px] text-gray-500 mb-1">Resize</p>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" aria-label="Narrower" className={btn} onClick={() => props.onResize(-1, 0)}>− W</button>
          <button type="button" aria-label="Wider" className={btn} onClick={() => props.onResize(1, 0)}>+ W</button>
          <button type="button" aria-label="Shorter" className={btn} onClick={() => props.onResize(0, -1)}>− H</button>
          <button type="button" aria-label="Taller" className={btn} onClick={() => props.onResize(0, 1)}>+ H</button>
        </div>
      </div>
    </div>
  );
}

function NumericField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
}) {
  return (
    <label className="text-xs">
      <span className="block text-gray-500">{props.label}</span>
      <input
        type="number"
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm dark:bg-gray-800 dark:text-gray-100"
      />
    </label>
  );
}

function GridOverlay(props: {
  pxRect: { x: number; y: number; w: number; h: number };
  cellsAcross: number;
  cellsDown: number;
  samples: Array<{ row: number; col: number; symbol: string }>;
  matches: MatchCandidate[];
  selectedMatchKeys: Set<string>;
  onCellClick: (row: number, col: number) => void;
  onMatchToggle: (row: number, col: number) => void;
}) {
  const {
    pxRect,
    cellsAcross,
    cellsDown,
    samples,
    matches,
    selectedMatchKeys,
    onCellClick,
    onMatchToggle,
  } = props;
  const cellW = pxRect.w / cellsAcross;
  const cellH = pxRect.h / cellsDown;
  const sampleKey = (r: number, c: number) => `${r}:${c}`;
  const sampledByCell = new Map(samples.map((s) => [sampleKey(s.row, s.col), s]));
  const matchedByCell = new Map(matches.map((m) => [sampleKey(m.gridRow, m.gridCol), m]));

  return (
    <div
      className="absolute"
      style={{
        left: `${pxRect.x}px`,
        top: `${pxRect.y}px`,
        width: `${pxRect.w}px`,
        height: `${pxRect.h}px`,
      }}
    >
      {Array.from({ length: cellsDown }).map((_, row) => (
        <div key={row} className="flex">
          {Array.from({ length: cellsAcross }).map((__, col) => {
            const key = sampleKey(row, col);
            const sampled = sampledByCell.get(key);
            const matched = matchedByCell.get(key);
            const isSelectedMatch = matched && selectedMatchKeys.has(key);
            const baseBorder = 'border border-blue-400/40';
            // Three states: sampled (amber), selected match (purple),
            // deselected match (grey, dashed border so the user can see
            // which cells they've turned off).
            let accent = '';
            let borderOverride = '';
            if (sampled) {
              accent = 'bg-amber-400/40';
            } else if (matched && isSelectedMatch) {
              accent = 'bg-purple-400/40';
            } else if (matched && !isSelectedMatch) {
              accent = 'bg-gray-400/20';
              borderOverride = 'border border-dashed border-gray-400';
            }
            const handleClick = () => {
              // Tap a sample-eligible cell tags it. Tap a match cell to
              // toggle its inclusion in Apply. Sampled cells fall back
              // to the tag flow (re-tag).
              if (matched) onMatchToggle(row, col);
              else onCellClick(row, col);
            };
            return (
              <button
                key={col}
                type="button"
                onClick={handleClick}
                title={
                  sampled
                    ? `Sample: ${sampled.symbol}`
                    : matched
                    ? `Match: ${matched.symbol} (d=${matched.distance}) — tap to ${isSelectedMatch ? 'deselect' : 'select'}`
                    : `Tap to tag (row ${row + 1}, col ${col + 1})`
                }
                className={`${borderOverride || baseBorder} ${accent} hover:bg-blue-400/30 transition-colors`}
                style={{ width: `${cellW}px`, height: `${cellH}px` }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SymbolPicker(props: {
  palette: ChartSymbolTemplate[];
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  onCancel: () => void;
  cellLabel: string;
}) {
  const { palette, value, onChange, onCommit, onCancel, cellLabel } = props;

  // Filter palette by what the user has typed. If empty input, show
  // first 12 entries; otherwise filter by symbol substring (case-insens).
  const filtered = useMemo(() => {
    const v = value.trim().toLowerCase();
    if (!v) return palette.slice(0, 12);
    return palette
      .filter(
        (s) =>
          s.symbol.toLowerCase().includes(v) ||
          (s.name ?? '').toLowerCase().includes(v) ||
          (s.abbreviation ?? '').toLowerCase().includes(v),
      )
      .slice(0, 12);
  }, [palette, value]);

  return (
    <div className="rounded border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
          Tag {cellLabel}
        </h5>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="text-blue-700 dark:text-blue-300 hover:text-blue-900 text-xs"
        >
          Cancel
        </button>
      </div>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            e.preventDefault();
            onCommit(value);
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Type a symbol (k, p, yo) or pick below"
        maxLength={32}
        className="w-full rounded border border-blue-300 dark:border-blue-700 px-2 py-1 text-sm dark:bg-gray-900 dark:text-gray-100"
      />
      {palette.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {filtered.length === 0 ? (
            <span className="text-[11px] text-blue-700 dark:text-blue-300">
              No matches — press Enter to use "{value.trim()}" anyway.
            </span>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onCommit(s.symbol)}
                title={s.name ?? s.symbol}
                className="rounded bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 px-2 py-1 text-xs hover:bg-blue-100 dark:hover:bg-blue-900/40 font-mono"
              >
                {s.symbol}
              </button>
            ))
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => onCommit(value)}
        disabled={!value.trim()}
        className="mt-2 w-full rounded bg-blue-600 px-3 py-1.5 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
