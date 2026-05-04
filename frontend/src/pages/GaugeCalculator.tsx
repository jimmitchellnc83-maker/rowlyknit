import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiAlertTriangle,
  FiArrowUp,
  FiArrowDown,
  FiMinus,
  FiSave,
} from 'react-icons/fi';
import {
  compareGauge,
  predictFinishedDimension,
  type GaugeInput,
  type GaugeStatus,
  type NeedleChange,
} from '../utils/gaugeMath';
import { useSeo } from '../hooks/useSeo';
import { useAuthStore } from '../stores/authStore';
import { useMeasurementPrefs } from '../hooks/useMeasurementPrefs';
import { trackEvent } from '../lib/analytics';
import SaveCalcToProjectModal, { type CalculatorMemoPayload } from '../components/calculators/SaveCalcToProjectModal';

type NumField = number | '';

interface FormGauge {
  stitches: NumField;
  rows: NumField;
  measurement: NumField;
  unit: 'in' | 'cm';
}

const DEFAULT_TARGET: FormGauge = { stitches: 20, rows: 28, measurement: 4, unit: 'in' };
const DEFAULT_ACTUAL: FormGauge = { stitches: '', rows: '', measurement: 4, unit: 'in' };

// Single source of truth — rendered as a <dl> AND emitted as FAQPage
// JSON-LD so Google can pull these into the rich FAQ accordion in SERPs.
const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What is gauge in knitting?',
    a: "Gauge is how many stitches and rows fit in a fixed area — usually a 4 in (10 cm) square. It's set by your yarn, needles, and tension. Two knitters using the same pattern can produce wildly different sizes if their gauges don't match.",
  },
  {
    q: 'How do I measure gauge?',
    a: "Knit a swatch at least 6 in (15 cm) wide, in the same stitch pattern as the project. Block it the way you'll wash the finished piece. Lay it flat, then count stitches and rows across a 4 in section in the middle — avoid the edges, they distort.",
  },
  {
    q: "What if I'm off-gauge?",
    a: 'Too many stitches per inch = swatch is tight, go up a needle size. Too few = swatch is loose, go down. If only the row gauge is off, you can usually live with it for flat shapes (just track length by inches, not rows). For shaped pieces — sweater yokes, hat decreases — match both.',
  },
  {
    q: 'Should I block my swatch first?',
    a: "Yes. Most yarns relax or grow when wet, sometimes by 5–10%. Measuring an unblocked swatch gives you a number that won't match the finished garment. Wash and lay flat to dry exactly as you'll launder it.",
  },
];

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
  useSeo({
    title: 'Knitting Gauge Calculator — Free Swatch Checker | Rowly',
    description:
      "Free knitting gauge calculator. Enter your pattern's target and your swatch measurements to see whether you're on-gauge and how much your finished piece will drift.",
    canonicalPath: '/calculators/gauge',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Knitting Gauge Calculator',
        url: 'https://rowlyknit.com/calculators/gauge',
        description:
          "Compare your knitted swatch against a pattern's target gauge. See whether you're on-gauge and how the finished piece will drift.",
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: {
          '@type': 'Organization',
          name: 'Rowly',
          url: 'https://rowlyknit.com/',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://rowlyknit.com/' },
          { '@type': 'ListItem', position: 2, name: 'Calculators', item: 'https://rowlyknit.com/calculators' },
          { '@type': 'ListItem', position: 3, name: 'Gauge Calculator', item: 'https://rowlyknit.com/calculators/gauge' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  });

  const { isAuthenticated } = useAuthStore();
  const { prefs } = useMeasurementPrefs();
  // Initial unit comes from the user's profile pref. Each gauge form keeps its
  // own dropdown so a US pattern target (in inches) and a metric-measured
  // swatch (in cm) can coexist; we only set the default. mm folds to cm.
  const initialUnit: 'in' | 'cm' = prefs.lengthDisplayUnit === 'cm' || prefs.lengthDisplayUnit === 'mm' ? 'cm' : 'in';
  const initialMeasurement = initialUnit === 'cm' ? 10 : 4;
  const [target, setTarget] = useState<FormGauge>({
    ...DEFAULT_TARGET,
    unit: initialUnit,
    measurement: initialMeasurement,
  });
  const [actual, setActual] = useState<FormGauge>({
    ...DEFAULT_ACTUAL,
    unit: initialUnit,
    measurement: initialMeasurement,
  });
  const [patternWidth, setPatternWidth] = useState<NumField>('');
  const [patternHeight, setPatternHeight] = useState<NumField>('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  const ready = isComplete(target) && isComplete(actual);
  const result = useMemo(() => {
    if (!ready) return null;
    return compareGauge(toGauge(target), toGauge(actual));
  }, [ready, target, actual]);

  // Fire one Plausible event the first time a result computes in a session.
  // Lets us see how many anonymous visitors actually use the calculator.
  const trackedRef = useRef(false);
  useEffect(() => {
    if (result && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent('Calculator Used', { calculator: 'gauge', status: result.status });
    }
  }, [result]);

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

  const memoPayload: CalculatorMemoPayload | null = useMemo(() => {
    if (!result) return null;
    const targetMeasure = `${target.measurement} ${target.unit}`;
    const actualMeasure = `${actual.measurement} ${actual.unit}`;
    const summaryStatus =
      result.status === 'on-gauge'
        ? 'On gauge'
        : result.status === 'too-tight'
          ? 'Swatch too tight'
          : result.status === 'too-loose'
            ? 'Swatch too loose'
            : 'Mixed gauge';
    return {
      calculator: 'gauge',
      inputs: {
        pattern_target: `${target.stitches} sts × ${target.rows} rows over ${targetMeasure}`,
        your_swatch: `${actual.stitches} sts × ${actual.rows} rows over ${actualMeasure}`,
        pattern_width: typeof patternWidth === 'number' ? `${patternWidth} ${target.unit}` : '—',
        pattern_length: typeof patternHeight === 'number' ? `${patternHeight} ${target.unit}` : '—',
      },
      outputs: {
        status: summaryStatus,
        stitch_diff_pct: `${result.stitchPercentDiff > 0 ? '+' : ''}${result.stitchPercentDiff}%`,
        row_diff_pct: `${result.rowPercentDiff > 0 ? '+' : ''}${result.rowPercentDiff}%`,
        needle_recommendation: needleLabel[result.needleChange],
        predicted_width:
          widthPrediction !== null ? `${widthPrediction} ${target.unit}` : '—',
        predicted_length:
          heightPrediction !== null ? `${heightPrediction} ${target.unit}` : '—',
      },
      summary: `Gauge check: ${summaryStatus}. ${result.message}`,
    };
  }, [result, target, actual, patternWidth, patternHeight, widthPrediction, heightPrediction]);

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
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          Knitting Gauge Calculator
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Knit a swatch, enter the numbers below, and see whether your gauge matches the
          pattern. If you&apos;re off, the calculator tells you whether to size your needles
          up or down — and how much your finished piece will drift if you knit anyway.
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

      {isAuthenticated && memoPayload ? (
        <section className="flex flex-col items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Save this calculation to a project
            </h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Captures your gauge inputs and recommendation under that project&apos;s structured notes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <FiSave className="h-4 w-4" />
            Save to project
          </button>
        </section>
      ) : null}

      {!isAuthenticated ? (
        <section className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-800 dark:bg-purple-900/20 md:p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Save your gauge to a project
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-700 dark:text-gray-300">
            Rowly stores your gauge with each project, so the row counter knows exactly when
            you&apos;ve hit a target dimension. Free while we&apos;re in early access — no
            credit card.
          </p>
          <Link
            to="/register"
            className="mt-4 inline-block rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Sign up free
          </Link>
        </section>
      ) : null}

      <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 md:p-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Frequently asked questions
        </h2>
        <dl className="mt-4 space-y-5">
          {FAQS.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-medium text-gray-900 dark:text-gray-100">{q}</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800/40 md:p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Related knitting calculators
        </h2>
        <ul className="mt-2 space-y-1 text-purple-700 dark:text-purple-400">
          <li>
            <Link to="/calculators/size" className="hover:underline">
              Knitting size calculator
            </Link>{' '}
            <span className="text-gray-600 dark:text-gray-400">
              — pick the right finished size for any recipient.
            </span>
          </li>
          <li>
            <Link to="/calculators" className="hover:underline">
              All knitting calculators
            </Link>{' '}
            <span className="text-gray-600 dark:text-gray-400">— gauge, sizing, yarn substitution.</span>
          </li>
        </ul>
      </section>

      {memoPayload ? (
        <SaveCalcToProjectModal
          open={showSaveModal}
          payload={memoPayload}
          title="Gauge calculation"
          onClose={() => setShowSaveModal(false)}
        />
      ) : null}
    </div>
  );
}
