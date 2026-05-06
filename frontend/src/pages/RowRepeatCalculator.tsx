/**
 * Row / Round Repeat Calculator — public tool page.
 * Sprint 1 Public Tools Conversion.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { computeRowRepeat } from '../utils/rowRepeatMath';
import { useSeo } from '../hooks/useSeo';
import { trackEvent } from '../lib/analytics';
import SaveToRowlyCTA from '../components/calculators/SaveToRowlyCTA';
import type { ToolResult, RowRepeatResult } from '../lib/toolResult';
import { PUBLIC_TOOLS } from '../lib/publicTools';
import PublicAdSection from '../components/ads/PublicAdSection';

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What is a row repeat?',
    a: 'A row repeat is a vertical stitch pattern unit — usually four to twelve rows — that\'s worked over and over to build texture. The calculator tells you how many full repeats fit between two markers and what to do with the leftover rows.',
  },
  {
    q: 'How do I handle a partial repeat?',
    a: 'Three options: (1) extend the section by working the full repeat (adds rows / length), (2) truncate by ending mid-repeat at a logical row, or (3) work plain stockinette / garter for the remainder. The calculator surfaces the remainder so you can pick.',
  },
  {
    q: "Does this work for circular knitting (rounds)?",
    a: 'Yes — "row" and "round" are interchangeable here. The math is identical: total rounds available, rounds per repeat, full repeats, remainder.',
  },
];

export default function RowRepeatCalculator() {
  useSeo({
    title: 'Row & Round Repeat Calculator — Rowly',
    description:
      'Work out how many pattern repeats fit between two markers. Free knitting calculator for row + round repeats.',
    canonicalPath: '/calculators/row-repeat',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Row & Round Repeat Calculator',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web',
        url: 'https://rowlyknit.com/calculators/row-repeat',
        description:
          'Calculates how many full pattern repeats fit between two markers and the remainder.',
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

  const [totalRows, setTotalRows] = useState<number | ''>(60);
  const [rowsPerRepeat, setRowsPerRepeat] = useState<number | ''>(8);

  const result = useMemo(() => {
    if (typeof totalRows !== 'number' || typeof rowsPerRepeat !== 'number') return null;
    return computeRowRepeat({ totalRowsAvailable: totalRows, rowsPerRepeat });
  }, [totalRows, rowsPerRepeat]);

  useEffect(() => {
    trackEvent('public_tool_viewed', { toolId: 'row-repeat' });
  }, []);
  const trackedRef = useRef(false);
  useEffect(() => {
    if (result && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent('public_tool_used', { toolId: 'row-repeat' });
      trackEvent('public_tool_result_generated', { toolId: 'row-repeat' });
    }
  }, [result]);

  const toolResult: ToolResult | null = useMemo(() => {
    if (!result) return null;
    const repeatOut: RowRepeatResult = {
      totalRowsAvailable: result.totalRowsAvailable,
      rowsPerRepeat: result.rowsPerRepeat,
      fullRepeats: result.fullRepeats,
      remainderRows: result.remainderRows,
      fitsCleanly: result.fitsCleanly,
      endsAtRow: result.endsAtRow,
    };
    const summary = result.fitsCleanly
      ? `${result.fullRepeats} full repeats fit cleanly into ${result.totalRowsAvailable} rows.`
      : `${result.fullRepeats} full repeats use ${result.endsAtRow} rows; ${result.remainderRows} rows remain.`;
    return {
      toolId: 'row-repeat',
      toolVersion: '1',
      inputs: { totalRows: result.totalRowsAvailable, rowsPerRepeat: result.rowsPerRepeat },
      result: repeatOut,
      humanSummary: summary,
      recommendedSaveTargets: PUBLIC_TOOLS['row-repeat'].saveTargets,
      createdAt: new Date().toISOString(),
    };
  }, [result]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link to="/calculators" className="inline-flex items-center text-purple-600 hover:text-purple-700">
          <FiArrowLeft className="mr-2 h-4 w-4" />
          Back to Calculators
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          Row &amp; Round Repeat Calculator
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Tell the calculator how many rows or rounds you have to work in, and how many
          rows make one repeat — it&apos;ll tell you how many full repeats fit and what
          to do with the leftover.
        </p>
      </div>

      <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total rows / rounds available
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
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rows / rounds per repeat
            </span>
            <input
              type="number"
              value={rowsPerRepeat === '' ? '' : rowsPerRepeat}
              onChange={(e) =>
                setRowsPerRepeat(e.target.value === '' ? '' : Number(e.target.value))
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
              <FiRefreshCw className="h-6 w-6 text-purple-700 dark:text-purple-100" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {result.fullRepeats} full repeat{result.fullRepeats === 1 ? '' : 's'}
              </h2>
              {result.fitsCleanly ? (
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  Fits cleanly — {result.totalRowsAvailable} rows = exactly{' '}
                  <strong>{result.fullRepeats}</strong> × {result.rowsPerRepeat}-row repeat.
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  Uses <strong>{result.endsAtRow} rows</strong> ({result.fullRepeats} full
                  repeats × {result.rowsPerRepeat}). Remainder:{' '}
                  <strong>{result.remainderRows} row{result.remainderRows === 1 ? '' : 's'}</strong>{' '}
                  — work plain or extend by{' '}
                  <strong>{result.rowsPerRepeat - result.remainderRows}</strong> rows for one
                  more full repeat.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm italic text-gray-500">
          Enter total rows + rows per repeat to see the result.
        </p>
      )}

      {toolResult ? (
        <section className="flex flex-col items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Send this repeat to Make Mode
            </h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Save the repeat plan as a Make Mode reminder on a project. Sign up
              or start a 30-day trial — your result is preserved through sign-in.
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
            <Link to="/calculators/shaping" className="hover:underline">
              Increase / decrease spacing calculator
            </Link>{' '}
            <span className="text-gray-600 dark:text-gray-400">
              — spread shaping rows evenly across a section.
            </span>
          </li>
          <li>
            <Link to="/calculators/gauge" className="hover:underline">
              Knitting gauge calculator
            </Link>
          </li>
          <li>
            <Link to="/calculators" className="hover:underline">
              All knitting calculators
            </Link>
          </li>
        </ul>
      </section>
      <PublicAdSection slot="rowly-row-repeat" testId="public-ad-row-repeat" />
    </div>
  );
}
