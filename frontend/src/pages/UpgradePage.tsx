/**
 * Upgrade / trial landing page — Sprint 1 placeholder.
 *
 * The "Start your 30-day trial" CTA on the public-tool save flow lands
 * here. Sprint 2 (Lemon Squeezy) wires the real checkout button in this
 * spot. Until then this page is honest about the state:
 *   - The trial is coming; no signup-to-checkout flow exists yet.
 *   - Public tools remain free regardless.
 *   - Owner / staff accounts already work today.
 *
 * Indexed (the link is reachable from public calc CTAs, so robots
 * shouldn't disallow it). No JSON-LD product schema yet — Sprint 2
 * adds that with real pricing.
 */

import { Link } from 'react-router-dom';
import { FiArrowLeft, FiClock } from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';

export default function UpgradePage() {
  useSeo({
    title: 'Rowly Maker — 30-day trial coming soon',
    description:
      'Rowly Maker is the paid workspace that turns calculator results into project plans, gauge logs, and shaping reminders. 30-day trial coming soon.',
    canonicalPath: '/upgrade',
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/calculators"
          className="inline-flex items-center text-purple-600 hover:text-purple-700"
        >
          <FiArrowLeft className="mr-2 h-4 w-4" />
          Back to Calculators
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          Rowly Maker — coming soon
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Rowly Maker is the paid workspace that catches every gauge, size, yardage, and
          shaping result you calculate and pins it to a project, pattern, or your stash —
          so future-you doesn&apos;t have to re-do the math.
        </p>
      </div>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20 md:p-8">
        <div className="flex items-start gap-3">
          <FiClock className="h-6 w-6 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              30-day trial wiring in progress
            </h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              The public calculators (gauge, size, yardage, row repeat, increase /
              decrease spacing) stay free forever. The paid workspace — saving results,
              row-by-row tracking, pattern library, yarn stash — opens for trials in the
              next release. We&apos;ll email you when it&apos;s live.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 md:p-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          What&apos;s in Rowly Maker
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc ml-5">
          <li>Save calculator results to projects, patterns, yarn stash, or Make Mode reminders.</li>
          <li>Row-by-row counter that sticks across devices.</li>
          <li>Pattern library + PDF workspace with annotations and crops.</li>
          <li>Stash inventory that tracks what each project consumes.</li>
          <li>Make Mode for hands-free progress on a project.</li>
          <li>Pattern Designer + chart library.</li>
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800/40 md:p-6">
        <p>
          Want a heads-up when the trial opens?{' '}
          <Link to="/register" className="text-purple-700 hover:underline dark:text-purple-400">
            Create your account now
          </Link>{' '}
          — we&apos;ll email you the moment it&apos;s ready.
        </p>
      </section>
    </div>
  );
}
