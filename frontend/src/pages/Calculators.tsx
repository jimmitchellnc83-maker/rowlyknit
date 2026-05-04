import { Link } from 'react-router-dom';
import { FiGrid, FiChevronRight, FiLock } from 'react-icons/fi';
import { useAuthStore } from '../stores/authStore';
import { useSeo } from '../hooks/useSeo';

interface CalculatorLink {
  title: string;
  description: string;
  href: string;
  // True when the calculator works without an account (pure math).
  publicAvailable: boolean;
}

const CALCULATORS: CalculatorLink[] = [
  {
    title: 'Knitting Gauge Calculator',
    description:
      "Check your swatch against the pattern's target gauge. See whether to size up or down, and how your finished piece will drift at your current gauge.",
    href: '/calculators/gauge',
    publicAvailable: true,
  },
  {
    title: 'Yarn Substitution Calculator',
    description:
      "Describe the yarn a pattern calls for and rank your stash by how well each option matches on weight, fiber, and yardage.",
    href: '/calculators/yarn-sub',
    publicAvailable: false,
  },
  {
    title: 'Knitting Size Calculator',
    description:
      'Enter a chest or bust measurement and a fit style; get a recommended size across women, men, children, and baby sizing schemes. Works for gifts or your own projects.',
    // Canonical Size Calculator route (renamed from /calculators/gift-size
    // during the Auth + Launch Polish Sprint 2026-05-04). The old slug
    // still works as an alias for backwards compatibility.
    href: '/calculators/size',
    publicAvailable: true,
  },
];

export default function Calculators() {
  const { isAuthenticated } = useAuthStore();
  useSeo({
    title: 'Free Knitting Calculators — Gauge, Yarn Substitution, Sizing | Rowly',
    description:
      'Free knitting calculators: check your gauge swatch, find size recommendations, substitute yarn. No account needed for gauge or sizing.',
    canonicalPath: '/calculators',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Free Knitting Calculators',
        url: 'https://rowlyknit.com/calculators',
        description:
          'Free knitting calculators for gauge, sizing, and yarn substitution.',
        hasPart: CALCULATORS.map((c) => ({
          '@type': 'WebApplication',
          name: c.title,
          url: `https://rowlyknit.com${c.href}`,
          description: c.description,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        })),
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
        ],
      },
    ],
  });

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          Free Knitting Calculators
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Knitting math, done for you. Check your gauge before you cast on, find the right
          size for any recipient, and substitute yarn confidently. Most are free to use
          without signing up.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {CALCULATORS.map((c) => {
          const requiresAccount = !c.publicAvailable && !isAuthenticated;
          const targetHref = requiresAccount ? '/register' : c.href;
          return (
            <Link key={c.href} to={targetHref} className="block group">
              <div className="flex h-full items-start gap-4 rounded-lg bg-white p-4 shadow transition hover:shadow-lg dark:bg-gray-800 md:p-6">
                <FiGrid className="h-8 w-8 flex-shrink-0 text-purple-600" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {c.title}
                    </h2>
                    {requiresAccount ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        <FiLock className="h-3 w-3" />
                        Sign up
                      </span>
                    ) : (
                      <FiChevronRight className="h-5 w-5 text-gray-400 transition group-hover:text-purple-600" />
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{c.description}</p>
                  {requiresAccount ? (
                    <p className="mt-2 text-xs text-purple-700 dark:text-purple-300">
                      Free account — needs your stash to compare yarns.
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {!isAuthenticated ? (
        <section className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-800 dark:bg-purple-900/20 md:p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Want more than calculators?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-700 dark:text-gray-300">
            Rowly is the workspace for hand knitters — track your projects row-by-row, organize
            your yarn stash, store patterns, and design your own garments.
          </p>
          {/* CTA copy: paid-app trial language. The calculators
              themselves stay open without an account. */}
          <Link
            to="/register"
            className="mt-4 inline-block rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Try Rowly
          </Link>
        </section>
      ) : null}
    </div>
  );
}
