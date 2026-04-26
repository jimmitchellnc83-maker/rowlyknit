import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FiX } from 'react-icons/fi';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useCreateCustomSymbol, useUpdateCustomSymbol } from '../../hooks/useChartSymbols';
import { STITCH_LIBRARY, StitchIcon, getStitchSvg } from '../../data/stitchSvgLibrary';
import type { ChartSymbolTemplate, Craft } from '../../types/chartSymbol';

interface CustomStitchModalProps {
  craft: Craft;
  /** When set, the modal is in edit mode for this user-custom stitch. */
  initial?: ChartSymbolTemplate;
  onClose: () => void;
  onSaved?: (stitch: ChartSymbolTemplate) => void;
}

const CATEGORY_OPTIONS = [
  'basic',
  'increase',
  'decrease',
  'cable',
  'twisted',
  'special',
  'colorwork',
  'placeholder',
];

/**
 * Author / edit a user-custom stitch. The user picks one of the curated SVG
 * icons (`STITCH_LIBRARY`) and overlays their own abbreviation, instructions,
 * and cell span. The picked icon's `key` becomes the canonical `symbol` —
 * this is fine because (symbol, user_id) is unique, so a custom stitch can
 * reuse a system symbol's icon and the rendering stays consistent.
 */
export default function CustomStitchModal({ craft, initial, onClose, onSaved }: CustomStitchModalProps) {
  const create = useCreateCustomSymbol();
  const update = useUpdateCustomSymbol();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useFocusTrap(dialogRef, true, nameRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [iconKey, setIconKey] = useState<string>(initial?.symbol ?? 'star');
  const [name, setName] = useState<string>(initial?.name ?? '');
  const [abbreviation, setAbbreviation] = useState<string>(initial?.abbreviation ?? '');
  const [category, setCategory] = useState<string>(initial?.category ?? 'special');
  const [rsInstruction, setRsInstruction] = useState<string>(initial?.rs_instruction ?? '');
  const [wsInstruction, setWsInstruction] = useState<string>(initial?.ws_instruction ?? '');
  const [description, setDescription] = useState<string>(initial?.description ?? '');
  const [cellSpan, setCellSpan] = useState<number>(initial?.cell_span ?? 1);

  // When the icon changes, prefill cell span from the icon's natural width
  // (only if the user hasn't manually overridden it for this session).
  const lastAutoSpanRef = useRef<number>(initial?.cell_span ?? 1);
  useEffect(() => {
    const stitch = getStitchSvg(iconKey);
    if (!stitch) return;
    if (cellSpan === lastAutoSpanRef.current) {
      lastAutoSpanRef.current = stitch.cellSpan;
      setCellSpan(stitch.cellSpan);
    }
  }, [iconKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleIcons = useMemo(
    () => STITCH_LIBRARY.filter((s) => s.craft === craft || s.craft === 'both'),
    [craft],
  );

  const grouped = useMemo(() => {
    const out: Record<string, typeof visibleIcons> = {};
    for (const ic of visibleIcons) {
      if (!out[ic.category]) out[ic.category] = [];
      out[ic.category].push(ic);
    }
    return out;
  }, [visibleIcons]);

  const isEdit = Boolean(initial);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Give your stitch a name');
      return;
    }
    try {
      const payload = {
        symbol: iconKey,
        name: name.trim(),
        abbreviation: abbreviation.trim() || null,
        category,
        description: description.trim() || null,
        rs_instruction: rsInstruction.trim() || null,
        ws_instruction: wsInstruction.trim() || null,
        cell_span: cellSpan,
        craft,
      };
      const saved = isEdit && initial
        ? await update.mutateAsync({ id: initial.id, input: payload })
        : await create.mutateAsync(payload);
      toast.success(isEdit ? 'Stitch updated' : 'Custom stitch saved');
      onSaved?.(saved);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not save stitch');
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-stitch-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800"
      >
        <form onSubmit={submit}>
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
            <h2 id="custom-stitch-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isEdit ? 'Edit custom stitch' : 'New custom stitch'}{' '}
              <span className="text-xs font-normal text-gray-500">({craft})</span>
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name<span className="text-red-500"> *</span>
                </span>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="e.g. Brioche left-leaning increase"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Abbreviation
                </span>
                <input
                  type="text"
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value)}
                  maxLength={20}
                  placeholder="e.g. brkyobrk"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c[0].toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cells wide (1–8)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={cellSpan}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || '1', 10);
                      if (Number.isFinite(v)) setCellSpan(Math.max(1, Math.min(8, v)));
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  RS instruction
                </span>
                <input
                  type="text"
                  value={rsInstruction}
                  onChange={(e) => setRsInstruction(e.target.value)}
                  placeholder="e.g. brk1, yo, brk1"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  WS instruction
                </span>
                <input
                  type="text"
                  value={wsInstruction}
                  onChange={(e) => setWsInstruction(e.target.value)}
                  placeholder="e.g. sl1yo, brp1, sl1yo"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes (optional)
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Choose a symbol icon
              </p>
              <div className="mb-2 flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900/30 dark:bg-purple-900/20">
                <div className="flex h-12 items-center justify-center text-gray-700 dark:text-gray-200">
                  <StitchIcon id={iconKey} size={40} stroke="currentColor" />
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  <div className="font-medium">{getStitchSvg(iconKey)?.label ?? iconKey}</div>
                  <div>Icon key: <code>{iconKey}</code></div>
                  <div>Span: {getStitchSvg(iconKey)?.cellSpan ?? 1} {getStitchSvg(iconKey)?.cellSpan === 1 ? 'cell' : 'cells'}</div>
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                {Object.entries(grouped).map(([cat, icons]) => (
                  <div key={cat} className="mb-3 last:mb-0">
                    <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {cat}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {icons.map((ic) => {
                        const active = ic.key === iconKey;
                        return (
                          <button
                            key={ic.key}
                            type="button"
                            onClick={() => setIconKey(ic.key)}
                            title={`${ic.label}${ic.cellSpan > 1 ? ` (${ic.cellSpan}-cell)` : ''}`}
                            className={`flex h-12 items-center justify-center rounded border px-1 transition ${
                              active
                                ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-400 dark:bg-purple-900/30'
                                : 'border-gray-300 bg-white hover:border-purple-300 dark:border-gray-600 dark:bg-gray-800'
                            }`}
                            style={{ minWidth: 28 * ic.cellSpan + 16 }}
                            aria-pressed={active}
                          >
                            <span className="text-gray-700 dark:text-gray-200">
                              <StitchIcon id={ic.key} size={28} stroke="currentColor" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-70"
            >
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save stitch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
