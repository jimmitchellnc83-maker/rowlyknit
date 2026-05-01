import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FiSearch, FiX, FiArrowLeft } from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';

type Craft = 'knit' | 'crochet' | 'tunisian' | 'loom-knit';

interface Abbreviation {
  id: string;
  abbreviation: string;
  expansion: string;
  description: string | null;
  craft: Craft;
  category: string;
}

interface CategoryCount {
  category: string;
  count: number;
}

const CRAFT_LABELS: Record<Craft, string> = {
  knit: 'Knit',
  crochet: 'Crochet',
  tunisian: 'Tunisian',
  'loom-knit': 'Loom knit',
};

const CRAFT_ORDER: Craft[] = ['knit', 'crochet', 'tunisian', 'loom-knit'];

const CATEGORY_LABELS: Record<string, string> = {
  stitch: 'Stitches',
  increase: 'Increases',
  decrease: 'Decreases',
  instruction: 'Instructions',
  color: 'Color',
  materials: 'Materials',
  notation: 'Notation',
  post: 'Post stitches',
  special: 'Special stitches',
};

const formatCategory = (cat: string): string =>
  CATEGORY_LABELS[cat] ??
  cat.replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());

const isCraft = (value: string | null): value is Craft =>
  value !== null && (CRAFT_ORDER as string[]).includes(value);

export default function Glossary() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCraftParam = searchParams.get('craft');
  const initialCraft = isCraft(initialCraftParam) ? initialCraftParam : null;
  const initialSearch = searchParams.get('search') ?? searchParams.get('q') ?? '';
  const initialCategory = searchParams.get('category');
  const initialTerm = searchParams.get('term');

  const [craft, setCraft] = useState<Craft | null>(initialCraft);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [category, setCategory] = useState<string | null>(initialCategory);

  const [rows, setRows] = useState<Abbreviation[] | null>(null);
  const [counts, setCounts] = useState<CategoryCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const highlightedId = useRef<string | null>(null);

  useSeo({
    title: 'Knitting & Crochet Abbreviations Glossary | Rowly',
    description:
      'Searchable glossary of canonical CYC knitting, crochet, Tunisian, and loom-knit abbreviations. Look up k2tog, ssk, sc, dc, and 190+ more pattern shorthand terms.',
    canonicalPath: '/help/glossary',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://rowlyknit.com/' },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Glossary',
            item: 'https://rowlyknit.com/help/glossary',
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Knitting & Crochet Abbreviations Glossary',
        url: 'https://rowlyknit.com/help/glossary',
        description:
          'Canonical CYC knitting, crochet, Tunisian, and loom-knit abbreviations. Search by term or filter by craft.',
        about: {
          '@type': 'Thing',
          name: 'Knitting and crochet pattern abbreviations',
        },
      },
    ],
  });

  // Debounce the search input so we don't fire a request per keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 200);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // Keep URL in sync with active filters so deep-links round-trip.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (craft) next.set('craft', craft);
    else next.delete('craft');
    if (debouncedSearch) next.set('search', debouncedSearch);
    else next.delete('search');
    if (category) next.set('category', category);
    else next.delete('category');
    // Preserve `term` (deep-link target) until the user actually scrolls
    // past it — clearing on every state change would break Back-button.
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [craft, debouncedSearch, category]);

  // Fetch abbreviations whenever the active filters change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, string> = {};
    if (craft) params.craft = craft;
    if (category) params.category = category;
    if (debouncedSearch) params.search = debouncedSearch;

    axios
      .get<{ data: Abbreviation[] }>('/shared/glossary', { params })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 429) {
          setError("You're refreshing this a lot — give it a few seconds and try again.");
        } else {
          setError("Couldn't load the glossary. Try again in a moment.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [craft, category, debouncedSearch]);

  // Fetch category counts whenever the craft filter changes (so the chip
  // counts reflect the active craft).
  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string> = {};
    if (craft) params.craft = craft;
    axios
      .get<{ data: CategoryCount[] }>('/shared/glossary/categories', { params })
      .then((res) => {
        if (!cancelled) setCounts(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setCounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [craft]);

  // Deep-link handler: when ?term=k2tog&craft=knit lands the user, scroll
  // to that entry once it's rendered and flash a highlight ring.
  useEffect(() => {
    if (!initialTerm || !rows || rows.length === 0) return;
    const target = rows.find(
      (r) =>
        r.abbreviation === initialTerm &&
        (initialCraft ? r.craft === initialCraft : true)
    );
    if (!target) return;
    if (highlightedId.current === target.id) return;
    highlightedId.current = target.id;
    const node = document.getElementById(`abbr-${target.id}`);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.classList.add('ring-2', 'ring-purple-500', 'ring-offset-2');
      window.setTimeout(() => {
        node.classList.remove('ring-2', 'ring-purple-500', 'ring-offset-2');
      }, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, initialTerm, initialCraft]);

  // Group rows by craft → category for rendering.
  const grouped = useMemo(() => {
    if (!rows) return null;
    const byCraft = new Map<Craft, Map<string, Abbreviation[]>>();
    for (const row of rows) {
      let craftMap = byCraft.get(row.craft);
      if (!craftMap) {
        craftMap = new Map();
        byCraft.set(row.craft, craftMap);
      }
      const cat = craftMap.get(row.category);
      if (cat) cat.push(row);
      else craftMap.set(row.category, [row]);
    }
    return byCraft;
  }, [rows]);

  const totalRows = rows?.length ?? 0;
  const visibleCrafts = grouped ? CRAFT_ORDER.filter((c) => grouped.has(c)) : [];

  const clearFilters = () => {
    setCraft(null);
    setSearchInput('');
    setCategory(null);
  };

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
          Knitting &amp; Crochet Abbreviations
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Canonical pattern shorthand from the Craft Yarn Council, in one searchable place.
          Knit, crochet, Tunisian, and loom-knit — 195 entries.
        </p>
      </header>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <label className="block">
          <span className="sr-only">Search abbreviations</span>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search — k2tog, ssk, sc, double crochet, decrease..."
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
              >
                <FiX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Craft</span>
          <CraftButton active={craft === null} onClick={() => setCraft(null)} label="All" />
          {CRAFT_ORDER.map((c) => (
            <CraftButton
              key={c}
              active={craft === c}
              onClick={() => setCraft(craft === c ? null : c)}
              label={CRAFT_LABELS[c]}
            />
          ))}
        </div>

        {counts.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</span>
            <CategoryChip
              active={category === null}
              onClick={() => setCategory(null)}
              label="All"
              count={counts.reduce((sum, c) => sum + c.count, 0)}
            />
            {counts.map((c) => (
              <CategoryChip
                key={c.category}
                active={category === c.category}
                onClick={() => setCategory(category === c.category ? null : c.category)}
                label={formatCategory(c.category)}
                count={c.count}
              />
            ))}
          </div>
        ) : null}

        {craft || category || debouncedSearch ? (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-xs font-medium text-purple-700 hover:underline dark:text-purple-400"
          >
            Clear all filters
          </button>
        ) : null}
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        {loading ? (
          <span>Loading...</span>
        ) : (
          <span>
            {totalRows} {totalRows === 1 ? 'entry' : 'entries'}
            {craft ? ` in ${CRAFT_LABELS[craft]}` : ''}
            {category ? ` · ${formatCategory(category)}` : ''}
            {debouncedSearch ? ` · matching "${debouncedSearch}"` : ''}
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {!error && grouped && totalRows === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-400">
          No abbreviations match those filters. Try clearing the search or switching crafts.
        </div>
      ) : null}

      {!error && grouped && totalRows > 0 ? (
        <div className="space-y-10">
          {visibleCrafts.map((c) => {
            const craftMap = grouped.get(c);
            if (!craftMap) return null;
            const orderedCategories = Array.from(craftMap.keys()).sort();
            return (
              <section key={c} aria-labelledby={`craft-${c}`}>
                <h2
                  id={`craft-${c}`}
                  className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100"
                >
                  {CRAFT_LABELS[c]}
                </h2>
                {orderedCategories.map((cat) => (
                  <div key={cat} className="mb-6 last:mb-0">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {formatCategory(cat)}
                    </h3>
                    <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {(craftMap.get(cat) ?? []).map((row) => (
                        <AbbreviationRow key={row.id} row={row} />
                      ))}
                    </dl>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      ) : null}

      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-500">
        Source: Craft Yarn Council of America's{' '}
        <a
          href="https://www.craftyarncouncil.com/standards"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-700 hover:underline dark:text-purple-400"
        >
          www.YarnStandards.com
        </a>
        .
      </footer>
    </div>
  );
}

function CraftButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white'
          : 'rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-purple-400 hover:text-purple-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-purple-400 dark:hover:text-purple-300'
      }
    >
      {label}
    </button>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800 ring-1 ring-purple-400 dark:bg-purple-900/40 dark:text-purple-200'
          : 'rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:border-purple-300 hover:text-purple-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-purple-500'
      }
    >
      {label} <span className="ml-1 text-gray-400">({count})</span>
    </button>
  );
}

function AbbreviationRow({ row }: { row: Abbreviation }) {
  return (
    <div
      id={`abbr-${row.id}`}
      className="flex items-baseline gap-3 rounded-md border border-gray-200 bg-white p-3 transition dark:border-gray-700 dark:bg-gray-800"
    >
      <dt className="min-w-[80px] font-mono text-sm font-semibold text-purple-700 dark:text-purple-300">
        {row.abbreviation}
      </dt>
      <dd className="flex-1 text-sm text-gray-800 dark:text-gray-200">
        <div>{row.expansion}</div>
        {row.description ? (
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{row.description}</div>
        ) : null}
      </dd>
    </div>
  );
}
