import { Link } from 'react-router-dom';
import {
  FiTool,
  FiGrid,
  FiMic,
  FiCheckCircle,
  FiBookOpen,
  FiLayers,
  FiArrowRight,
  FiCheckSquare,
  FiPackage,
  FiTrendingUp,
} from 'react-icons/fi';
import ThemeToggle from '../components/ThemeToggle';
import { PUBLIC_TOOL_LIST } from '../lib/publicTools';

// Plain-language one-liners for the landing-page card grid. We don't
// reuse PublicTool.description verbatim because the homepage benefit copy
// is shorter and more outcome-focused than the meta description used for
// search results.
const TOOL_BENEFIT_COPY: Record<string, string> = {
  gauge: 'Check your swatch before you cast on. See if you need to size up or down.',
  size: 'Pick the right finished size from a chest measurement and a fit style.',
  yardage: 'Estimate yarn for a project — by garment, size, and weight. Includes skein count.',
  'row-repeat': 'How many full repeats fit between markers? Also tells you the remainder.',
  shaping: 'Spread increases or decreases evenly across a section. No spreadsheet needed.',
};

/**
 * Public landing page shown at / for unauthenticated visitors. The app
 * is gated behind auth, so this is the first surface a new visitor sees
 * on share links, search results, and typed-URL traffic. Keep it tight,
 * feature-focused, and fast to scan — the goal is to get the visitor to
 * click "Create your account" or "Log in".
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white text-gray-900 dark:from-gray-900 dark:via-purple-950 dark:to-gray-900 dark:text-gray-100">
      {/* Skip link — keyboard users land here first and can jump past nav */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-purple-700 focus:shadow dark:focus:bg-gray-900 dark:focus:text-purple-300"
      >
        Skip to main content
      </a>

      {/* Top nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          to="/"
          className="text-2xl font-bold text-purple-600 dark:text-purple-400"
          aria-label="Rowly — home"
        >
          Rowly
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/calculators"
            className="px-2 py-2 text-sm font-medium text-gray-700 hover:text-purple-700 hover:bg-purple-50 rounded-lg dark:text-gray-200 dark:hover:text-purple-300 dark:hover:bg-purple-900/30 sm:px-3"
          >
            Tools
          </Link>
          <Link
            to="/help/glossary"
            className="hidden px-3 py-2 text-sm font-medium text-gray-700 hover:text-purple-700 hover:bg-purple-50 rounded-lg dark:text-gray-200 dark:hover:text-purple-300 dark:hover:bg-purple-900/30 md:inline"
          >
            Glossary
          </Link>
          <ThemeToggle />
          <Link
            to="/login"
            className="hidden px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg dark:text-purple-300 dark:hover:bg-purple-900/30 sm:inline-flex sm:px-4"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="px-3 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition sm:px-4"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <main id="main">
      {/* Hero */}
      <section aria-labelledby="hero-heading" className="mx-auto max-w-5xl px-6 pt-10 pb-16 text-center sm:pt-16">
        <span className="inline-block px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full dark:text-purple-200 dark:bg-purple-900/40">
          For hand knitters who care about the craft
        </span>
        <h1 id="hero-heading" className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight">
          Run your knitting projects{' '}
          <span className="text-purple-600 dark:text-purple-400">without losing your place.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
          Track rows, manage complex pieces, plan with your stash, and actually finish what
          you cast on — all in one workspace built for makers.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/calculators"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-lg shadow-purple-600/20"
          >
            Try free knitting tools <FiArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Start your next project
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Use the tools free. Save results to Rowly when you're ready to track a project.
        </p>
      </section>

      {/* Three pillars — what Rowly helps you do */}
      <section aria-labelledby="pillars-heading" className="mx-auto max-w-6xl px-6 pb-20">
        <h2 id="pillars-heading" className="sr-only">
          How Rowly helps you knit
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Pillar
            icon={<FiCheckSquare className="h-6 w-6" />}
            title="Run the project"
            body="Make Mode locks onto your active row. Counters, Guided Pieces for multi-panel patterns, PDF and chart row markers, notes and checklists — everything works together so you never lose your place."
          />
          <Pillar
            id="pillar-plan"
            icon={<FiPackage className="h-6 w-6" />}
            title="Plan with what you own"
            body="Start with the calculators — gauge, gift size, yarn substitution, project cost. Then feasibility checks against your real stash and tools, recipient profiles, project history — so you decide with numbers, not guesses."
          />
          <Pillar
            icon={<FiTrendingUp className="h-6 w-6" />}
            title="Grow into advanced workflows"
            body="Guided Pieces for full garments with shaping. Parametric designer with live schematics and cast-on math. Pattern imports via OCR, barcode, or Ravelry. Rowly grows with you as projects get bigger."
          />
        </div>
      </section>

      {/* Public tools section — discovery path from landing → /calculators.
          Each card links directly to its individual route so search bots
          and visitors both see explicit internal links instead of an
          opaque "Browse" CTA. */}
      <section
        id="public-tools"
        aria-labelledby="public-tools-heading"
        className="mx-auto max-w-6xl px-6 pb-20 scroll-mt-24"
      >
        <div className="text-center">
          <h2 id="public-tools-heading" className="text-2xl sm:text-3xl font-bold">
            Try free knitting and crochet tools
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Use the tools free. Save results to Rowly when you're ready to track a project.
          </p>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PUBLIC_TOOL_LIST.map((tool) => (
            <li key={tool.id}>
              <Link
                to={tool.route}
                data-testid={`landing-tool-${tool.id}`}
                className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 transition hover:border-purple-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-800/50 dark:hover:border-purple-700"
              >
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <FiGrid className="h-5 w-5" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {tool.title}
                  </h3>
                </div>
                <p className="mt-2 flex-1 text-sm text-gray-600 dark:text-gray-300">
                  {TOOL_BENEFIT_COPY[tool.id] ?? tool.description}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-700 group-hover:text-purple-800 dark:text-purple-300 dark:group-hover:text-purple-200">
                  Use tool <FiArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8 text-center">
          <Link
            to="/calculators"
            className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-200"
          >
            See all calculators <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Feature highlights — secondary grid with the concrete differentiators */}
      <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-6 pb-20">
        <h2 id="features-heading" className="text-center text-2xl sm:text-3xl font-bold">What makes knitters stay</h2>
        <p className="text-center mt-2 text-gray-600 dark:text-gray-400">
          Every feature shaped around how knitting actually works.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<FiGrid className="h-5 w-5" />}
            title="Chart-linked counter"
            body="Your row counter highlights the active row on your chart as you knit. No more finger-scrolling to find where you were."
          />
          <Feature
            icon={<FiBookOpen className="h-5 w-5" />}
            title="PDF row marker"
            body="Open any PDF pattern and Rowly marks the active row, steps on Space, remembers where you were — for every page."
          />
          <Feature
            icon={<FiMic className="h-5 w-5" />}
            title="Voice control"
            body="Say 'next' / 'back' / 'add three' while your hands stay on the needles. Works across counters, charts, and PDFs."
          />
          <Feature
            icon={<FiLayers className="h-5 w-5" />}
            title="Yarn stash that sees everything"
            body="Scan a label with OCR, photograph a barcode, log dye lots. The designer pulls colors from your real yarn."
          />
          <Feature
            icon={<FiCheckCircle className="h-5 w-5" />}
            title="Pattern feasibility"
            body="Before you start: does this pattern fit the yarn you own? Rowly tells you, in plain English, with substitute suggestions."
          />
          <Feature
            icon={<FiTool className="h-5 w-5" />}
            title="Works offline, syncs live"
            body="Installable PWA with WebSocket sync across phone, tablet, and laptop. Knit on the couch — the counter updates everywhere."
          />
        </div>
      </section>

      {/* Closing CTA */}
      <section aria-labelledby="closing-cta-heading" className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-10 dark:border-purple-900/40 dark:bg-purple-900/20">
          <h2 id="closing-cta-heading" className="text-2xl sm:text-3xl font-bold">Start knitting with Rowly</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-300">
            Early access is open. Bring a project in progress — or start a new one in five
            minutes.
          </p>
          <Link
            to="/register"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 text-base font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Create your free account <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-gray-500 dark:text-gray-400 sm:flex-row">
          <span>© {new Date().getFullYear()} Rowly</span>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/privacy" className="hover:text-gray-700 dark:hover:text-gray-200">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-gray-700 dark:hover:text-gray-200">
              Terms
            </Link>
            <a
              href="mailto:hello@rowlyknit.com"
              className="hover:text-gray-700 dark:hover:text-gray-200"
            >
              hello@rowlyknit.com
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Pillar({
  id,
  icon,
  title,
  body,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      id={id}
      className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800/50"
    >
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
        {icon}
      </div>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-gray-600 dark:text-gray-300">{body}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/50">
      <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
        {icon}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{body}</p>
    </div>
  );
}
