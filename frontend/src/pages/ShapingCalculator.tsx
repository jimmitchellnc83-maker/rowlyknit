/**
 * Increase / Decrease Spacing Calculator — public tool page.
 * Sprint 1 Public Tools Conversion.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiTrendingUp } from 'react-icons/fi';
import { computeShapingPlan } from '../utils/shapingMath';
import { useSeo } from '../hooks/useSeo';
import { trackEvent } from '../lib/analytics';
import SaveToRowlyCTA from '../components/calculators/SaveToRowlyCTA';
import type { ToolResult, ShapingResult } from '../lib/toolResult';
import { PUBLIC_TOOLS } from '../lib/publicTools';

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'When would I use this?',
    a: 'Anywhere a knitting pattern says "decrease evenly" or "increase X stitches over Y rows" without specifying intervals — sleeve shaping, hat crowns, sweater waist shaping, raglan yokes. Plug in the start stitches, end stitches, and rows; get the exact every-Nth-row plan.',
  },
  {
    q: "What does 'every 8 rows X times, every 9 rows Y times' mean?",
    a: 'When the math doesn\'t divide evenly, you split the shaping into two intervals. Work the longer interval first (more plain rows between shaping rows), then switch to the shorter interval. This spreads shaping more naturally and matches how most published patterns phrase it.',
  },
  {
    q: 'Does it matter whether I increase on RS or WS rows?',
    a: 'Most patterns shape on RS rows for a cleaner edge — pair an "every 8 rows" plan with RS-only shaping if the pattern allows. The calculator gives you the row interval; the RS / WS choice is yours.',
  },
];

export default function ShapingCalculator() {
  useSeo({
    title: 'Increase / Decrease Spacing Calculator — Rowly',
    description:
      'Spread shaping evenly across a knitting section. Free calculator for sleeve shaping, sweater waists, hat crowns, raglan yokes.',
    canonicalPath: '/calculators/shaping',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Increase / Decrease Spacing Calculator',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web',
        url: 'https://rowlyknit.com/calculators/shaping',
        description:
          'Calculates the every-Nth-row plan to spread increases or decreases evenly.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
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

  const [startStitches, setStartStitches] = useState<number | ''>(80);
  const [endStitches, setEndStitches] = useState<number | ''>(60);
  const [totalRows, setTotalRows] = useState<number | ''>(40);

  const result = useMemo(() => {
    if (
      typeof startStitches !== 'number' ||
      typeof endStitches !== 'number' ||
      typeof totalRows !== 'number'
    )
      return null;
    return computeShapingPlan({ startStitches, endStitches, totalRows });
  }, [startStitches, endStitches, totalRows]);

  useEffect(() => {
    trackEvent('public_tool_viewed', { toolId: 'shaping' });
  }, []);
  const trackedRef = useRef(false);
  useEffect(() => {
    if (result && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent('public_tool_used', { toolId: 'shaping', shapingType: result.shapingType });
      trackEvent('public_tool_result_generated', { toolId: 'shaping' });
    }
  }, [result]);

  const toolResult: ToolResult | null = useMemo(() => {
    if (!result) return null;
    const shapingOut: ShapingResult = {
      startStitches: result.startStitches,
      endStitches: result.endStitches,
      totalRows: result.totalRows,
      shapingType: result.shapingType,
      totalShapingChanges: result.totalShapingChanges,
      instruction: result.instruction,
      intervalA: result.intervalA,
      countA: result.countA,
      intervalB: result.intervalB,
      countB: result.countB,
    };
    return {
      toolId: 'shaping',
      toolVersion: '1',
      inputs: { startStitches, endStitches, totalRows },
      result: shapingOut,
      humanSummary: result.instruction,
      recommendedSaveTargets: PUBLIC_TOOLS['shaping'].saveTargets,
      createdAt: new Date().toISOString(),
    };
  }, [result, startStitches, endStitches, totalRows]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link to="/calculators" className="inline-flex items-center text-purple-600 hover:text-purple-700">
          <FiArrowLeft className="mr-2 h-4 w-4" />
          Back to Calculators
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          Increase / Decrease Spacing Calculator
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Got a section that needs to grow or shrink by N stitches over M rows? The
          calculator gives you the exact &ldquo;every Nth row&rdquo; plan, in the same
          two-interval phrasing pattern designers use.
        </p>
      </div>

      <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Starting stitches
            </span>
            <input
              type="number"
              value={startStitches === '' ? '' : startStitches}
              onChange={(e) =>
                setStartStitches(e.target.value === '' ? '' : Number(e.target.value))
              }
              min={1}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ending stitches
            </span>
            <input
              type="number"
              value={endStitches === '' ? '' : endStitches}
              onChange={(e) =>
                setEndStitches(e.target.value === '' ? '' : Number(e.target.value))
              }
              min={1}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total rows for shaping
            </span>
            <input
              type="number"
              value={totalRows === '' ? '' : totalRows}
              onChange={(e) =>
                setTotalRows(e.target.value === '' ? '' : Number(e.target.value))
              }
              min={1}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
        </div>
      </section>

      {result ? (
        <section className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2 rounded-full bg-purple-200 dark:bg-purple-700">
              <FiTrendingUp className="h-6 w-6 text-purple-700 dark:text-purple-100" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {result.totalShapingChanges} {result.shapingType}
                {result.totalShapingChanges === 1 ? '' : 's'} over {result.totalRows} rows
              </h2>
              <p className="mt-1 text-base text-gray-800 dark:text-gray-200">
                {result.instruction}
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Final stitch count: <strong>{result.endStitches}</strong>
              </p>
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm italic text-gray-500">
          {(typeof startStitches === 'number' && typeof endStitches === 'number' && startStitches === endStitches) ||
          (typeof startStitches === 'number' && typeof endStitches === 'number' && typeof totalRows === 'number' &&
            Math.abs(endStitches - startStitches) > totalRows)
            ? 'Inputs need adjusting — start ≠ end, and changes must fit in the rows available.'
            : 'Enter start stitches, end stitches, and total rows to see the plan.'}
        </p>
      )}

      {toolResult ? (
        <section className="flex flex-col items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Send this shaping plan to Make Mode
            </h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Save the shaping instruction as a Make Mode reminder on a project. Sign
              up or start a 30-day trial — your result is preserved through sign-in.
            </p>
          </div>
          <SaveToRowlyCTA result={toolResult} autoResume />
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
            <Link to="/calculators/row-repeat" className="hover:underline">
              Row &amp; round repeat calculator
            </Link>{' '}
            <span className="text-gray-600 dark:text-gray-400">
              — work out how many pattern repeats fit between markers.
            </span>
          </li>
          <li>
            <Link to="/calculators/size" className="hover:underline">
              Knitting size calculator
            </Link>
          </li>
          <li>
            <Link to="/calculators" className="hover:underline">
              All knitting calculators
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
