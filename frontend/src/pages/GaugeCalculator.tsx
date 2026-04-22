import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiAlertTriangle,
  FiArrowUp,
  FiArrowDown,
  FiMinus,
} from 'react-icons/fi';
import {
  compareGauge,
  predictFinishedDimension,
  type GaugeInput,
  type GaugeStatus,
  type NeedleChange,
} from '../utils/gaugeMath';

type NumField = number | '';

interface FormGauge {
  stitches: NumField;
  rows: NumField;
  measurement: NumField;
  unit: 'in' | 'cm';
}

const DEFAULT_TARGET: FormGauge = { stitches: 20, rows: 28, measurement: 4, unit: 'in' };
const DEFAULT_ACTUAL: FormGauge = { stitches: '', rows: '', measurement: 4, unit: 'in' };

function isComplete(g: FormGauge): boolean {
  return (
    typeof g.stitches === 'number' &&
    g.stitches > 0 &&
    typeof g.rows === 'number' &&
    g.rows > 0 &&
    typeof g.measurement === 'number' &&
    g.measurement > 0
  );
}

function toGauge(g: FormGauge): GaugeInput {
  return {
    stitches: g.stitches as number,
    rows: g.rows as number,
    measurement: g.measurement as number,
    unit: g.unit,
  };
}

const statusColor: Record<GaugeStatus, string> = {
  'on-gauge': 'bg-green-50 border-green-200 text-green-800',
  'too-tight': 'bg-yellow-50 border-yellow-200 text-yellow-800',
  'too-loose': 'bg-yellow-50 border-yellow-200 text-yellow-800',
  mixed: 'bg-blue-50 border-blue-200 text-blue-800',
};

const statusIcon: Record<GaugeStatus, React.ElementType> = {
  'on-gauge': FiCheckCircle,
  'too-tight': FiAlertTriangle,
  'too-loose': FiAlertTriangle,
  mixed: FiMinus,
};

const needleIcon: Record<NeedleChange, React.ElementType> = {
  stay: FiMinus,
  'size-up': FiArrowUp,
  'size-down': FiArrowDown,
};

const needleLabel: Record<NeedleChange, string> = {
  stay: 'Keep current needle',
  'size-up': 'Try one size up',
  'size-down': 'Try one size down',
};

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  label: string;
  value: NumField;
  onChange: (v: NumField) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <input
        type="number"
        value={value === '' ? '' : String(value)}
        step={step}
        min={min}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') {
            onChange('');
          } else {
            const parsed = parseFloat(v);
            onChange(Number.isFinite(parsed) ? parsed : '');
          }
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
    </label>
  );
}

function GaugeForm({
  title,
  gauge,
  onChange,
}: {
  title: string;
  gauge: FormGauge;
  onChange: (next: FormGauge) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
      <legend className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</legend>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="Stitches"
          value={gauge.stitches}
          onChange={(v) => onChange({ ...gauge, stitches: v })}
        />
        <NumberInput
          label="Rows"
          value={gauge.rows}
          onChange={(v) => onChange({ ...gauge, rows: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="Over"
          value={gauge.measurement}
          onChange={(v) => onChange({ ...gauge, measurement: v })}
          step={0.5}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Unit
          </span>
          <select
            value={gauge.unit}
            onChange={(e) => onChange({ ...gauge, unit: e.target.value as 'in' | 'cm' })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="in">inches</option>
            <option value="cm">cm</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}

export default function GaugeCalculator() {
  const [target, setTarget] = useState<FormGauge>(DEFAULT_TARGET);
  const [actual, setActual] = useState<FormGauge>(DEFAULT_ACTUAL);
  const [patternWidth, setPatternWidth] = useState<NumField>('');
  const [patternHeight, setPatternHeight] = useState<NumField>('');

  const ready = isComplete(target) && isComplete(actual);
  const result = useMemo(() => {
    if (!ready) return null;
    return compareGauge(toGauge(target), toGauge(actual));
  }, [ready, target, actual]);

  const widthPrediction =
    result && typeof patternWidth === 'number' && patternWidth > 0
      ? predictFinishedDimension(patternWidth, result.widthMultiplier)
      : null;
  const heightPrediction =
    result && typeof patternHeight === 'number' && patternHeight > 0
      ? predictFinishedDimension(patternHeight, result.heightMultiplier)
      : null;

  const StatusIcon = result ? statusIcon[result.status] : FiMinus;
  const NeedleIcon = result ? needleIcon[result.needleChange] : FiMinus;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link
          to="/calculators"
          className="inline-flex items-center text-purple-600 hover:text-purple-700"
        >
          <FiArrowLeft className="mr-2 h-4 w-4" />
          Back to Calculators
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
          Gauge Calculator
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Your smart gauge helper. Enter the pattern&apos;s target gauge and your swatch
          measurements — we&apos;ll call the needle change, row/stitch drift, and finished-dimension
          delta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <GaugeForm title="Pattern target" gauge={target} onChange={setTarget} />
        <GaugeForm title="Your swatch" gauge={actual} onChange={setActual} />
      </div>

      {!ready ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm italic text-gray-500">
          Enter both gauges to see the verdict.
        </p>
      ) : result ? (
        <>
          <section className={`flex items-start gap-4 rounded-lg border p-4 md:p-6 ${statusColor[result.status]}`}>
            <StatusIcon className="h-10 w-10 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-semibold capitalize">
                {result.status === 'on-gauge'
                  ? 'On gauge!'
                  : result.status === 'too-tight'
                    ? 'Swatch is too tight'
                    : result.status === 'too-loose'
                      ? 'Swatch is too loose'
                      : 'Row gauge drift'}
              </h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{result.message}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
                Stitch gauge
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {result.actualPer4in.stitches} <span className="text-sm font-normal text-gray-500">/ 4 in</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Target: {result.targetPer4in.stitches} / 4 in
                {result.stitchPercentDiff !== 0 ? (
                  <> &middot; {result.stitchPercentDiff > 0 ? '+' : ''}{result.stitchPercentDiff}%</>
                ) : null}
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
                Row gauge
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {result.actualPer4in.rows} <span className="text-sm font-normal text-gray-500">/ 4 in</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Target: {result.targetPer4in.rows} / 4 in
                {result.rowPercentDiff !== 0 ? (
                  <> &middot; {result.rowPercentDiff > 0 ? '+' : ''}{result.rowPercentDiff}%</>
                ) : null}
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
                Needle recommendation
              </h3>
              <p className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                <NeedleIcon className="h-5 w-5" />
                {needleLabel[result.needleChange]}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Re-swatch after switching needles to confirm.
              </p>
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Finished-dimension check
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Enter a pattern dimension to see what size you&apos;d actually get if you
              knit with your current gauge.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <div>
                <NumberInput
                  label={`Pattern width (${target.unit})`}
                  value={patternWidth}
                  onChange={setPatternWidth}
                  step={0.5}
                />
                {widthPrediction !== null ? (
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    At your gauge →{' '}
                    <strong className="text-purple-600">
                      {widthPrediction} {target.unit}
                    </strong>
                  </p>
                ) : null}
              </div>
              <div>
                <NumberInput
                  label={`Pattern length (${target.unit})`}
                  value={patternHeight}
                  onChange={setPatternHeight}
                  step={0.5}
                />
                {heightPrediction !== null ? (
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    At your gauge →{' '}
                    <strong className="text-purple-600">
                      {heightPrediction} {target.unit}
                    </strong>
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
