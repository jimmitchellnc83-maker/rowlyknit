import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiSearch, FiX } from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';
import {
  KNIT911_TOPICS,
  KNIT911_CATEGORIES,
  type Knit911Topic,
} from '../data/knit911';
import PublicAdSection from '../components/ads/PublicAdSection';
import { getAdSlotId } from '../components/ads/adsenseSlots';

export default function Knit911() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category');
  const initialSearch = searchParams.get('q') ?? searchParams.get('search') ?? '';

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState<Knit911Topic['category'] | null>(
    KNIT911_CATEGORIES.find((c) => c.id === initialCategory)?.id ?? null,
  );

  useSeo({
    title: 'Knit911 — Common Knitting Problems & Fixes | Rowly',
    description:
      'Plain-language fixes for the 18 most common knitting problems: dropped stitches, curled edges, gauge mismatches, twisted stitches, and more. Free reference, no account needed.',
    canonicalPath: '/help/knit911',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://rowlyknit.com/' },
          { '@type': 'ListItem', position: 2, name: 'Knit911', item: 'https://rowlyknit.com/help/knit911' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: KNIT911_TOPICS.map((t) => ({
          '@type': 'Question',
          name: t.title,
          acceptedAnswer: {
            '@type': 'Answer',
            text: t.body,
          },
        })),
      },
    ],
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return KNIT911_TOPICS.filter((t) => {
      if (category && t.category !== category) return false;
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        t.summary.toLowerCase().includes(needle) ||
        t.body.toLowerCase().includes(needle)
      );
    });
  }, [search, category]);

  // Keep URL in sync so the page is bookmarkable / linkable.
  useMemo(() => {
    const next = new URLSearchParams(searchParams);
    if (search) next.set('q', search);
    else next.delete('q');
    if (category) next.set('category', category);
    else next.delete('category');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/help"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to Help
        </Link>
      </div>

      <header>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          Knit911
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Plain-language fixes for the {KNIT911_TOPICS.length} most common
          knitting problems — dropped stitches, curled edges, gauge mismatches,
          and the rest of the small panics that derail a project.
        </p>
      </header>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <label className="block">
          <span className="sr-only">Search topics</span>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='e.g. "dropped stitch", "curl", "gauge"'
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
              >
                <FiX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Topic</span>
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={
              category === null
                ? 'rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white'
                : 'rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-purple-400 hover:text-purple-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300'
            }
          >
            All
          </button>
          {KNIT911_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(category === c.id ? null : c.id)}
              className={
                category === c.id
                  ? 'rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white'
                  : 'rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-purple-400 hover:text-purple-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300'
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        {filtered.length} {filtered.length === 1 ? 'topic' : 'topics'}
        {category ? ` in ${KNIT911_CATEGORIES.find((c) => c.id === category)?.label}` : ''}
        {search ? ` matching "${search}"` : ''}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-400">
          No topics match those filters. Try clearing the search.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => (
            <article
              key={t.slug}
              id={t.slug}
              className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t.title}
              </h2>
              <p className="mt-1 text-sm font-medium text-purple-700 dark:text-purple-300">
                {t.summary}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {t.body}
              </p>
            </article>
          ))}
        </div>
      )}

      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-500">
        Inspired by Craft Yarn Council of America's{' '}
        <a
          href="https://www.craftyarncouncil.com/knit911-home.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-700 hover:underline dark:text-purple-400"
        >
          Knit911 troubleshooting index
        </a>
        .
      </footer>

      <PublicAdSection slot={getAdSlotId('knit911')} testId="public-ad-knit911" />
    </div>
  );
}
