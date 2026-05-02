import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiUsers, FiCheck, FiSave } from 'react-icons/fi';
import {
  recommendSizes,
  SCHEME_LABELS,
  type FitStyle,
  type MeasurementUnit,
  type SizeRecommendation,
  type SizeScheme,
} from '../utils/giftSizeMath';
import {
  EASE_TIERS,
  EASE_TIER_INCHES,
  EASE_TIER_LABELS,
  EASE_TIER_VERBOSE_LABELS,
} from '../utils/easeTiers';
import { useSeo } from '../hooks/useSeo';
import { safeReturnTo } from '../lib/safeReturnTo';
import { useAuthStore } from '../stores/authStore';
import { useMeasurementPrefs } from '../hooks/useMeasurementPrefs';
import { trackEvent } from '../lib/analytics';
import SaveCalcToProjectModal, { type CalculatorMemoPayload } from '../components/calculators/SaveCalcToProjectModal';

type NumField = number | '';

const SCHEME_ORDER: SizeScheme[] = ['women', 'men', 'child', 'baby'];

// Single source of truth — rendered as a <dl> AND emitted as FAQPage
// JSON-LD so Google can pull these into the rich FAQ accordion in SERPs.
const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How do I size a sweater for someone I can't measure?",
    a: 'Estimate their chest measurement from a similar-sized garment in their closet (lay it flat, measure across the chest just below the armholes, then double). Pick a fit style that matches what they normally wear. The calculator handles the rest.',
  },
  {
    q: "What's the difference between close, classic, and oversized?",
    a: 'Fit style controls ease — how much bigger the finished garment is than the body. Very close is negative (stretches over the body), close is zero, classic is +2 in, loose is +4 in, and oversized is +6 in or more. Pick the same style as a sweater they already wear and like.',
  },
  {
    q: 'Can I use this for hats, baby clothes, or other knitted gifts?',
    a: 'The calculator targets sweaters and pullovers (chest-based sizing). For hats, the right reference is head circumference, not chest — most pattern designers list it in the size chart. Baby sweaters use chest-based sizing too, and the baby scheme is included.',
  },
  {
    q: 'Why does the recommendation differ between schemes?',
    a: "Different sizing systems use different chest-range bands. A 38 in chest might be a Women's M but a Men's S — patterns published in different schemes are calibrated to different reference bodies. Pick the scheme your pattern uses.",
  },
];

/** Sizing-table cell. Scheme bands (CYC standards etc.) are stored in
 *  inches by industry convention; the value below the label keeps them
 *  in inches so designers can match a published pattern's chart at a
 *  glance. The pattern itself shows finished + body chest in the user's
 *  selected unit elsewhere on the page. */
function RangeCell({ label, minChest, maxChest }: { label: string; minChest: number; maxChest: number }) {
  return (
    <div>
      <div className="font-medium text-gray-900 dark:text-gray-100">{label}</div>
      <div className="text-xs text-gray-500">{minChest}–{maxChest} in</div>
    </div>
  );
}

function SchemeCard({ rec }: { rec: SizeRecommendation }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {SCHEME_LABELS[rec.scheme]}
        </h3>
        {rec.recommended ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            <FiCheck className="h-3.5 w-3.5" />
            {rec.recommended.label}
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            Out of range
          </span>
        )}
      </div>
      {rec.recommended ? (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300">{rec.reason}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            {rec.smaller ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Size down</dt>
                <dd className="mt-1">
                  <RangeCell
                    label={rec.smaller.label}
                    minChest={rec.smaller.minChest}
                    maxChest={rec.smaller.maxChest}
                  />
                </dd>
              </div>
            ) : (
              <div />
            )}
            <div className="rounded-lg border border-green-200 bg-green-50 p-2">
              <dt className="text-xs uppercase tracking-wide text-green-700">Recommended</dt>
              <dd className="mt-1">
                <RangeCell
                  label={rec.recommended.label}
                  minChest={rec.recommended.minChest}
                  maxChest={rec.recommended.maxChest}
                />
              </dd>
            </div>
            {rec.larger ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Size up</dt>
                <dd className="mt-1">
                  <RangeCell
                    label={rec.larger.label}
                    minChest={rec.larger.minChest}
                    maxChest={rec.larger.maxChest}
                  />
                </dd>
              </div>
            ) : (
              <div />
            )}
          </dl>
        </>
      ) : (
        <p className="text-sm italic text-gray-500">{rec.reason}</p>
      )}
    </div>
  );
}

export default function GiftSizeCalculator() {
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  useSeo({
    title: 'Knitting Size Calculator — Find the Right Sweater Size | Rowly',
    description:
      'Free knitting size calculator. Enter a chest measurement and a fit style; get a recommended size across women, men, children, and baby schemes.',
    canonicalPath: '/calculators/gift-size',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Knitting Size Calculator',
        url: 'https://rowlyknit.com/calculators/gift-size',
        description:
          'Enter a chest or bust measurement and a fit style; get a recommended size across women, men, children, and baby schemes.',
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
          { '@type': 'ListItem', position: 3, name: 'Size Calculator', item: 'https://rowlyknit.com/calculators/gift-size' },
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
  // Default the input unit + chest from the user's profile pref. The dropdown
  // still works — a knitter may want to type in the unit a pattern uses even
  // if their profile says otherwise. mm folds to cm.
  const initialUnit: MeasurementUnit = prefs.lengthDisplayUnit === 'cm' || prefs.lengthDisplayUnit === 'mm' ? 'cm' : 'in';
  const [bodyChest, setBodyChest] = useState<NumField>(initialUnit === 'cm' ? 91 : 36);
  const [unit, setUnit] = useState<MeasurementUnit>(initialUnit);
  const [fit, setFit] = useState<FitStyle>('classic');
  const [useCustomEase, setUseCustomEase] = useState(false);
  const [customEaseIn, setCustomEaseIn] = useState<NumField>(2);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const ready = typeof bodyChest === 'number' && bodyChest > 0;
  const result = useMemo(() => {
    if (!ready) return null;
    return recommendSizes({
      bodyChest: bodyChest as number,
      unit,
      fit,
      customEaseIn: useCustomEase && typeof customEaseIn === 'number' ? customEaseIn : null,
    });
  }, [ready, bodyChest, unit, fit, useCustomEase, customEaseIn]);

  const trackedRef = useRef(false);
  useEffect(() => {
    if (result && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent('Calculator Used', { calculator: 'gift-size', fit });
    }
  }, [result, fit]);

  // Convert an inches-stored value to the user-selected unit for display.
  // Math runs in inches end-to-end; this is purely a presentation step.
  const toUnit = (inches: number): number =>
    unit === 'cm' ? Math.round(inches * 2.54 * 10) / 10 : inches;
  const formatLen = (inches: number): string => `${toUnit(inches)} ${unit}`;
  const signedFormatLen = (inches: number): string => {
    const v = toUnit(inches);
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v} ${unit}`;
  };

  const memoPayload: CalculatorMemoPayload | null = useMemo(() => {
    if (!result) return null;
    const recs = result.recommendations
      .map((r) => `${SCHEME_LABELS[r.scheme]}: ${r.recommended ? r.recommended.label : 'out of range'}`)
      .join(' · ');
    return {
      calculator: 'gift_size',
      inputs: {
        body_chest: formatLen(result.bodyChestIn),
        unit,
        fit_style: useCustomEase ? `custom (${signedFormatLen(result.easeIn)} ease)` : `${fit} (${EASE_TIER_VERBOSE_LABELS[fit]})`,
      },
      outputs: {
        finished_chest: formatLen(result.finishedChestIn),
        ease: signedFormatLen(result.easeIn),
        recommendations: recs,
      },
      summary: `Recommended sizes for a ${formatLen(result.bodyChestIn)} chest with ${signedFormatLen(result.easeIn)} ease (finished chest ${formatLen(result.finishedChestIn)}).`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, unit, fit, useCustomEase]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link
          to={returnTo ?? '/calculators'}
          className="inline-flex items-center text-purple-600 hover:text-purple-700"
        >
          <FiArrowLeft className="mr-2 h-4 w-4" />
          {returnTo ? 'Back' : 'Back to Calculators'}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          Knitting Size Calculator
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Enter a chest or bust measurement and pick a fit style — the calculator recommends a
          size across common pattern schemes (women, men, children, baby) and shows how the
          finished garment will measure. Useful when you&apos;re knitting for a gift recipient
          you can&apos;t measure, sizing up for a child who&apos;ll grow into the piece, or
          just deciding between two pattern sizes.
        </p>
      </div>

      <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Body chest / bust
            </span>
            <input
              type="number"
              value={bodyChest === '' ? '' : String(bodyChest)}
              step={0.5}
              min={0}
              onChange={(e) => {
                const v = e.target.value;
                setBodyChest(v === '' ? '' : parseFloat(v) || '');
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Unit
            </span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as MeasurementUnit)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="in">inches</option>
              <option value="cm">centimeters</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Fit style
            </span>
            <select
              value={fit}
              disabled={useCustomEase}
              onChange={(e) => setFit(e.target.value as FitStyle)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {EASE_TIERS.map((f) => (
                <option key={f} value={f}>
                  {EASE_TIER_VERBOSE_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/50 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={useCustomEase}
              onChange={(e) => setUseCustomEase(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Custom ease
          </label>
          {useCustomEase ? (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="number"
                // The math expects inches. When the user is in cm mode we
                // show the value in cm but persist the canonical inches
                // form in state so swapping units doesn't lose precision.
                value={
                  customEaseIn === ''
                    ? ''
                    : String(unit === 'cm' ? Math.round(customEaseIn * 2.54 * 10) / 10 : customEaseIn)
                }
                step={0.5}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    setCustomEaseIn('');
                    return;
                  }
                  const parsed = parseFloat(v);
                  if (!Number.isFinite(parsed)) {
                    setCustomEaseIn(0);
                    return;
                  }
                  setCustomEaseIn(unit === 'cm' ? Math.round((parsed / 2.54) * 10) / 10 : parsed);
                }}
                className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <span className="text-gray-600 dark:text-gray-400">{unit} (positive = loose, negative = body-hugging)</span>
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Preset: {EASE_TIER_LABELS[fit].toLowerCase()} → {signedFormatLen(EASE_TIER_INCHES[fit])} of ease
            </p>
          )}
        </div>
      </section>

      {result ? (
        <>
          <section className="rounded-lg border border-purple-200 bg-purple-50 p-4 md:p-6">
            <div className="flex items-center gap-3">
              <FiUsers className="h-8 w-8 flex-shrink-0 text-purple-600" />
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-purple-700">
                  Target finished chest
                </p>
                <p className="text-3xl font-bold text-purple-900">{formatLen(result.finishedChestIn)}</p>
                <p className="mt-1 text-sm text-purple-700">
                  Body {formatLen(result.bodyChestIn)} {signedFormatLen(result.easeIn)} ease
                </p>
              </div>
            </div>
          </section>

          {unit === 'cm' && (
            <p className="text-xs italic text-gray-500 dark:text-gray-400">
              Tables below stay in inches (the size standard most patterns use). Your inputs and
              result use cm.
            </p>
          )}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {SCHEME_ORDER.map((scheme) => {
              const rec = result.recommendations.find((x) => x.scheme === scheme);
              if (!rec) return null;
              return <SchemeCard key={scheme} rec={rec} />;
            })}
          </section>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm italic text-gray-500">
          Enter a chest/bust measurement to see size recommendations.
        </p>
      )}

      {isAuthenticated && memoPayload ? (
        <section className="flex flex-col items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Save this size recommendation to a project
            </h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Pins it under that project&apos;s structured notes so you&apos;ve got the math when you cast on.
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
            Track who you&apos;re knitting for
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-700 dark:text-gray-300">
            Save recipients with their measurements, gift history, and preferences in Rowly so
            you never have to ask &quot;what size again?&quot; mid-project. Free in early access.
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
            <Link to="/calculators/gauge" className="hover:underline">
              Knitting gauge calculator
            </Link>{' '}
            <span className="text-gray-600 dark:text-gray-400">
              — check whether your swatch matches the pattern.
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
          title="Size recommendation"
          onClose={() => setShowSaveModal(false)}
        />
      ) : null}
    </div>
  );
}
