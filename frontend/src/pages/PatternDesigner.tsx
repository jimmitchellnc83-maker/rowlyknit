import { useEffect, useMemo, useState } from 'react';
import { FiTool, FiInfo } from 'react-icons/fi';
import {
  computeBodyBlock,
  toInches,
  type BodyBlockInput,
  type MeasurementUnit,
} from '../utils/designerMath';
import BodySchematic from '../components/designer/BodySchematic';

type NumField = number | '';

interface DesignerForm {
  unit: MeasurementUnit;
  gaugeStitches: NumField;
  gaugeRows: NumField;
  gaugeMeasurement: NumField;
  chestCircumference: NumField;
  easeAtChest: NumField;
  totalLength: NumField;
  hemDepth: NumField;
  useWaistShaping: boolean;
  waistCircumference: NumField;
  easeAtWaist: NumField;
  waistHeightFromHem: NumField;
}

const DEFAULT_FORM: DesignerForm = {
  unit: 'in',
  gaugeStitches: 20,
  gaugeRows: 28,
  gaugeMeasurement: 4,
  chestCircumference: 36,
  easeAtChest: 4,
  totalLength: 24,
  hemDepth: 2,
  useWaistShaping: false,
  waistCircumference: 30,
  easeAtWaist: 2,
  waistHeightFromHem: 8,
};

const LS_KEY = 'rowly:designer:body-block:current';

function readSavedForm(): DesignerForm {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_FORM;
    const parsed = JSON.parse(raw) as Partial<DesignerForm>;
    return { ...DEFAULT_FORM, ...parsed };
  } catch {
    return DEFAULT_FORM;
  }
}

function isNumber(n: NumField): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isFormComplete(f: DesignerForm): boolean {
  if (!isNumber(f.gaugeStitches) || !isNumber(f.gaugeRows) || !isNumber(f.gaugeMeasurement))
    return false;
  if (
    !isNumber(f.chestCircumference) ||
    !isNumber(f.totalLength) ||
    !isNumber(f.hemDepth)
  )
    return false;
  // easeAtChest can be 0 or negative — require the field, not a positive number.
  if (f.easeAtChest === '' || !Number.isFinite(f.easeAtChest)) return false;
  if (f.useWaistShaping) {
    if (!isNumber(f.waistCircumference) || !isNumber(f.waistHeightFromHem)) return false;
    if (f.easeAtWaist === '' || !Number.isFinite(f.easeAtWaist)) return false;
  }
  return true;
}

function buildInput(f: DesignerForm): BodyBlockInput {
  // Normalize gauge to stitches/rows per 4 inches.
  const measurementIn = toInches(f.gaugeMeasurement as number, f.unit);
  const stitchesPer4in = ((f.gaugeStitches as number) / measurementIn) * 4;
  const rowsPer4in = ((f.gaugeRows as number) / measurementIn) * 4;

  return {
    gauge: { stitchesPer4in, rowsPer4in },
    chestCircumference: toInches(f.chestCircumference as number, f.unit),
    easeAtChest: toInches(f.easeAtChest as number, f.unit),
    totalLength: toInches(f.totalLength as number, f.unit),
    hemDepth: toInches(f.hemDepth as number, f.unit),
    waist: f.useWaistShaping
      ? {
          waistCircumference: toInches(f.waistCircumference as number, f.unit),
          easeAtWaist: toInches(f.easeAtWaist as number, f.unit),
          waistHeightFromHem: toInches(f.waistHeightFromHem as number, f.unit),
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Small primitives
// ---------------------------------------------------------------------------

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  suffix,
}: {
  label: string;
  value: NumField;
  onChange: (v: NumField) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {suffix ? <span className="ml-1 text-xs text-gray-400">({suffix})</span> : null}
      </span>
      <input
        type="number"
        value={value === '' ? '' : String(value)}
        step={step}
        min={min}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') return onChange('');
          const parsed = parseFloat(v);
          onChange(Number.isFinite(parsed) ? parsed : '');
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function PatternDesigner() {
  const [form, setForm] = useState<DesignerForm>(() => readSavedForm());

  // Persist on every change — cheap and spares users losing work across reloads.
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(form));
    } catch {
      /* localStorage unavailable; not worth surfacing */
    }
  }, [form]);

  const ready = isFormComplete(form);
  const output = useMemo(() => {
    if (!ready) return null;
    try {
      return computeBodyBlock(buildInput(form));
    } catch (e) {
      console.error('[Designer] compute error:', e);
      return null;
    }
  }, [form, ready]);

  const update = <K extends keyof DesignerForm>(key: K, value: DesignerForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const unitLabel = form.unit === 'in' ? 'in' : 'cm';

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FiTool className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
            Pattern Designer
          </h1>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-purple-700">
            Beta
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
          Draft a garment from body measurements and your swatch gauge. v1 handles a single body
          block (torso front or back) with optional waist shaping. Sleeves, yoke, and neckline come
          in follow-up releases. Drafts are saved locally to this browser.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-5">
        {/* Inputs */}
        <div className="space-y-4 lg:col-span-2">
          {/* Unit */}
          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Units</h2>
            <div className="flex gap-2">
              {(['in', 'cm'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => update('unit', u)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.unit === u
                      ? 'border-purple-600 bg-purple-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {u === 'in' ? 'Inches' : 'Centimeters'}
                </button>
              ))}
            </div>
          </section>

          {/* Gauge */}
          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Gauge</h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Stitches"
                value={form.gaugeStitches}
                onChange={(v) => update('gaugeStitches', v)}
              />
              <NumberInput
                label="Rows"
                value={form.gaugeRows}
                onChange={(v) => update('gaugeRows', v)}
              />
            </div>
            <div className="mt-3">
              <NumberInput
                label="Over"
                value={form.gaugeMeasurement}
                onChange={(v) => update('gaugeMeasurement', v)}
                step={0.5}
                suffix={unitLabel}
              />
            </div>
          </section>

          {/* Body block */}
          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Body block
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Chest / bust circumference"
                value={form.chestCircumference}
                onChange={(v) => update('chestCircumference', v)}
                step={0.5}
                suffix={unitLabel}
              />
              <NumberInput
                label="Ease at chest"
                value={form.easeAtChest}
                onChange={(v) => update('easeAtChest', v)}
                step={0.5}
                suffix={unitLabel}
              />
              <NumberInput
                label="Total length"
                value={form.totalLength}
                onChange={(v) => update('totalLength', v)}
                step={0.5}
                suffix={unitLabel}
              />
              <NumberInput
                label="Hem depth"
                value={form.hemDepth}
                onChange={(v) => update('hemDepth', v)}
                step={0.25}
                suffix={unitLabel}
              />
            </div>

            <label className="mt-4 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useWaistShaping}
                onChange={(e) => update('useWaistShaping', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Add waist shaping
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Narrows the body to the waist circumference, then increases back out to the bust.
                </span>
              </span>
            </label>

            {form.useWaistShaping && (
              <div className="mt-4 space-y-3 rounded-lg border border-purple-100 bg-purple-50/50 p-3 dark:border-purple-900/30 dark:bg-purple-900/10">
                <div className="grid grid-cols-2 gap-3">
                  <NumberInput
                    label="Waist circumference"
                    value={form.waistCircumference}
                    onChange={(v) => update('waistCircumference', v)}
                    step={0.5}
                    suffix={unitLabel}
                  />
                  <NumberInput
                    label="Ease at waist"
                    value={form.easeAtWaist}
                    onChange={(v) => update('easeAtWaist', v)}
                    step={0.5}
                    suffix={unitLabel}
                  />
                </div>
                <NumberInput
                  label="Height from cast-on to waist"
                  value={form.waistHeightFromHem}
                  onChange={(v) => update('waistHeightFromHem', v)}
                  step={0.5}
                  suffix={unitLabel}
                />
              </div>
            )}
          </section>
        </div>

        {/* Preview */}
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Schematic
            </h2>
            {output ? (
              <BodySchematic input={buildInput(form)} output={output} />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm italic text-gray-500">
                Fill in gauge and body measurements to see the schematic.
              </div>
            )}
          </section>

          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Shaping schedule
            </h2>
            {output ? (
              <div className="space-y-3">
                {output.steps.map((step, i) => (
                  <article
                    key={i}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {step.label}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {step.startStitches === 0
                          ? `${step.endStitches} sts`
                          : step.endStitches === 0
                            ? `${step.startStitches} sts`
                            : `${step.startStitches} → ${step.endStitches} sts`}
                        {step.rows > 1 && <> · {step.rows} rows</>}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{step.instruction}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-gray-500">No output yet.</p>
            )}
          </section>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-200">
            <FiInfo className="mr-1 inline h-3 w-3" />
            v1 scope: single body panel, symmetric side-seam shaping, no neckline or bust darts.
            Export to PDF and multi-design library are in the follow-up roadmap.
          </div>
        </div>
      </div>
    </div>
  );
}
