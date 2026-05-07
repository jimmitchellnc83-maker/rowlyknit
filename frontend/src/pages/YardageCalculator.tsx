/**
 * Yardage / Skein Estimator — public tool page.
 *
 * Sprint 1 Public Tools Conversion. Free, indexable, no auth required.
 * Result feeds the Save-to-Rowly flow (project memo with templateType
 * `yardage_estimate` or `stash_estimate` depending on destination).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiPackage } from 'react-icons/fi';
import {
  estimateYardage,
  GARMENT_LABELS,
  YARN_WEIGHT_LABELS,
  SIZE_LABELS,
  sizesFor,
  type GarmentType,
  type YarnWeight,
  type Size,
} from '../utils/yardageMath';
import { useSeo } from '../hooks/useSeo';
import { trackEvent } from '../lib/analytics';
import SaveToRowlyCTA from '../components/calculators/SaveToRowlyCTA';
import type { ToolResult, YardageResult } from '../lib/toolResult';
import { PUBLIC_TOOLS } from '../lib/publicTools';
import PublicAdSection from '../components/ads/PublicAdSection';
import { getAdSlotId } from '../components/ads/adsenseSlots';

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'How accurate is a yardage estimate?',
    a: 'Estimates are typically within ±15% — the calculator returns a range so you can buy on the safe side. Stitch pattern, gauge, and tension all affect actual yardage; cables eat more yarn than stockinette, lace less.',
  },
  {
    q: 'Should I buy extra yarn?',
    a: "Yes — pattern designers usually recommend 10–20% extra for swatching, mistakes, and an extra pair of socks. The calculator's high-end number already factors a buffer; round up to the next whole skein.",
  },
  {
    q: 'Why does yarn weight change yardage so much?',
    a: 'Lighter yarns make smaller stitches, so you need more length to cover the same area. Going from worsted to fingering can roughly double the yardage. Going from worsted to bulky can cut it by 25–40%.',
  },
  {
    q: 'Can I substitute a different yarn weight?',
    a: 'Pick a target weight close to the pattern\'s recommendation. Substitutions across more than one weight category usually need gauge re-calibration — use the gauge calculator before casting on.',
  },
];

export default function YardageCalculator() {
  useSeo({
    title: 'Yardage & Skein Estimator — Rowly',
    description:
      'Estimate how many yards (or skeins) of yarn a knitting project will need — by garment type, finished size, and yarn weight. Free, no signup.',
    canonicalPath: '/calculators/yardage',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Yardage & Skein Estimator',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web',
        url: 'https://rowlyknit.com/calculators/yardage',
        description:
          'Estimate how much yarn a knitting project needs by garment type, size, and yarn weight.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
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

  const [garment, setGarment] = useState<GarmentType>('sweater_adult');
  const [yarnWeight, setYarnWeight] = useState<YarnWeight>('worsted');
  const [size, setSize] = useState<Size>('m');
  const [skeinYards, setSkeinYards] = useState<number | ''>(200);

  const availableSizes = useMemo(() => sizesFor(garment), [garment]);

  // If the user changes garment to one that doesn't carry the current
  // size value, snap to the first valid one. Without this the estimator
  // returns null and the user sees the "select size" hint with no
  // visible cue what changed.
  useEffect(() => {
    if (!availableSizes.includes(size)) {
      setSize(availableSizes[0]);
    }
  }, [availableSizes, size]);

  const result = useMemo(() => {
    return estimateYardage({
      garment,
      yarnWeight,
      size,
      skeinYards: typeof skeinYards === 'number' && skeinYards > 0 ? skeinYards : undefined,
    });
  }, [garment, yarnWeight, size, skeinYards]);

  useEffect(() => {
    trackEvent('public_tool_viewed', { toolId: 'yardage', route: '/calculators/yardage' });
  }, []);
  const trackedRef = useRef(false);
  useEffect(() => {
    if (result && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent('public_tool_used', { toolId: 'yardage', route: '/calculators/yardage', garment, yarnWeight, size });
      trackEvent('public_tool_result_generated', { toolId: 'yardage', route: '/calculators/yardage' });
    }
  }, [result, garment, yarnWeight, size]);

  const toolResult: ToolResult | null = useMemo(() => {
    if (!result) return null;
    const yardageOut: YardageResult = {
      garmentType: result.garment,
      yarnWeight: result.yarnWeight,
      size: result.size,
      estimatedYards: result.estimatedYards,
      estimatedMeters: result.estimatedMeters,
      skeinsAt200Yd: result.skeinsAt200Yd,
      rangeLowYards: result.rangeLowYards,
      rangeHighYards: result.rangeHighYards,
    };
    const skeinDescriptor =
      result.skeinsAtCustomYd !== null
        ? `${result.skeinsAtCustomYd} × ${result.skeinYards}-yd skein${result.skeinsAtCustomYd === 1 ? '' : 's'}`
        : `${result.skeinsAt200Yd} × 200-yd skein${result.skeinsAt200Yd === 1 ? '' : 's'}`;
    return {
      toolId: 'yardage',
      toolVersion: '1',
      inputs: { garment, yarnWeight, size, skeinYards },
      result: yardageOut,
      humanSummary: `${GARMENT_LABELS[garment]}, ${SIZE_LABELS[size]}, ${YARN_WEIGHT_LABELS[yarnWeight]} → ~${result.estimatedYards} yd (${result.rangeLowYards}–${result.rangeHighYards}) · ${skeinDescriptor}`,
      recommendedSaveTargets: PUBLIC_TOOLS['yardage'].saveTargets,
      createdAt: new Date().toISOString(),
    };
  }, [result, garment, yarnWeight, size, skeinYards]);

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
          Yarn Yardage &amp; Skein Estimator
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Pick a garment, size, and yarn weight — get a yardage range and the number of
          skeins to buy. Useful when you&apos;re browsing a stash, checking yarn substitutions,
          or sizing up a stash project before you cast on.
        </p>
      </div>

      <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Garment
            </span>
            <select
              value={garment}
              onChange={(e) => setGarment(e.target.value as GarmentType)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {(Object.keys(GARMENT_LABELS) as GarmentType[]).map((g) => (
                <option key={g} value={g}>
                  {GARMENT_LABELS[g]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Size
            </span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as Size)}
              disabled={availableSizes.length <= 1}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {availableSizes.map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Yarn weight
            </span>
            <select
              value={yarnWeight}
              onChange={(e) => setYarnWeight(e.target.value as YarnWeight)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {(Object.keys(YARN_WEIGHT_LABELS) as YarnWeight[]).map((w) => (
                <option key={w} value={w}>
                  {YARN_WEIGHT_LABELS[w]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 max-w-xs">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Yards per skein (optional)
            </span>
            <input
              type="number"
              value={skeinYards === '' ? '' : skeinYards}
              onChange={(e) =>
                setSkeinYards(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="e.g. 220"
              min={1}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              Defaults to 200 yards if blank.
            </span>
          </label>
        </div>
      </section>

      {result ? (
        <section className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2 rounded-full bg-purple-200 dark:bg-purple-700">
              <FiPackage className="h-6 w-6 text-purple-700 dark:text-purple-100" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                ~{result.estimatedYards} yards (~{result.estimatedMeters} m)
              </h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Range: <strong>{result.rangeLowYards}–{result.rangeHighYards} yards</strong>
              </p>
              <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
                Buy at least{' '}
                <strong>
                  {result.skeinsAtCustomYd !== null
                    ? `${result.skeinsAtCustomYd} skein${result.skeinsAtCustomYd === 1 ? '' : 's'} of ${result.skeinYards}-yd yarn`
                    : `${result.skeinsAt200Yd} skein${result.skeinsAt200Yd === 1 ? '' : 's'} of 200-yd yarn`}
                </strong>{' '}
                — covers the high end of the range with a buffer.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm italic text-gray-500">
          Pick a garment, size, and yarn weight to see the estimate.
        </p>
      )}

      {toolResult ? (
        <section className="flex flex-col items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Save this yarn estimate to your Rowly workspace
            </h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Pin the estimate to a project or as a stash note. Sign up or start a
              30-day trial — your result is preserved through sign-in.
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
            <Link to="/calculators/gauge" className="hover:underline">
              Knitting gauge calculator
            </Link>{' '}
            <span className="text-gray-600 dark:text-gray-400">
              — check whether your swatch matches the pattern.
            </span>
          </li>
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
            </Link>
          </li>
        </ul>
      </section>
      <PublicAdSection slot={getAdSlotId('yardage')} testId="public-ad-yardage" />
    </div>
  );
}
