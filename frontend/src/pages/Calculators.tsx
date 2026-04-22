import { Link } from 'react-router-dom';
import { FiGrid, FiChevronRight } from 'react-icons/fi';

interface CalculatorLink {
  title: string;
  description: string;
  href: string;
  available: boolean;
}

const CALCULATORS: CalculatorLink[] = [
  {
    title: 'Gauge Calculator',
    description:
      "Check your swatch against the pattern's target gauge. See whether to size up or down, and how your finished piece will drift at your current gauge.",
    href: '/calculators/gauge',
    available: true,
  },
  {
    title: 'Yarn Substitution Calculator',
    description:
      "Find yarns in your stash (or the Ravelry database) that would work as a substitute for a pattern's suggested yarn — by weight, fiber, and yardage.",
    href: '/calculators/yarn-sub',
    available: false,
  },
  {
    title: 'Gift Size Calculator',
    description:
      'Convert body measurements and ease into a recommended size across common pattern sizing schemes.',
    href: '/calculators/gift-size',
    available: false,
  },
];

export default function Calculators() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
          Calculators
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Knitting math, done for you. Pick a tool below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {CALCULATORS.map((c) => {
          const card = (
            <div
              className={`flex items-start gap-4 rounded-lg bg-white p-4 shadow transition dark:bg-gray-800 md:p-6 ${
                c.available ? 'hover:shadow-lg' : 'cursor-not-allowed opacity-60'
              }`}
            >
              <FiGrid className="h-8 w-8 flex-shrink-0 text-purple-600" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {c.title}
                  </h2>
                  {c.available ? (
                    <FiChevronRight className="h-5 w-5 text-gray-400" />
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{c.description}</p>
              </div>
            </div>
          );
          return c.available ? (
            <Link key={c.href} to={c.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={c.href}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
