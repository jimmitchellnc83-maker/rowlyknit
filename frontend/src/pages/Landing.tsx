import { Link } from 'react-router-dom';
import {
  FiTool,
  FiGrid,
  FiMic,
  FiCheckCircle,
  FiBookOpen,
  FiLayers,
  FiArrowRight,
} from 'react-icons/fi';
import ThemeToggle from '../components/ThemeToggle';

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
      {/* Top nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          Rowly
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg dark:text-purple-300 dark:hover:bg-purple-900/30"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-10 pb-16 text-center sm:pt-16">
        <span className="inline-block px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full dark:text-purple-200 dark:bg-purple-900/40">
          For hand knitters who care about the craft
        </span>
        <h1 className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight">
          Design it. Validate it.{' '}
          <span className="text-purple-600 dark:text-purple-400">Knit it live.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
          Rowly is the one workbench for the whole job — designing your own garment, checking
          it against the yarn you own, and following the pattern row-by-row with voice and
          multi-device sync as you knit.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-lg shadow-purple-600/20"
          >
            Create your account <FiArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            I already have an account
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Free while we're in early access. No credit card.
        </p>
      </section>

      {/* Three pillars — matches our moat-widener story */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          <Pillar
            icon={<FiTool className="h-6 w-6" />}
            title="Design it"
            body="A parametric garment designer built around your gauge. Sweaters, hats, scarves, blankets, shawls, mittens, and socks — all with live schematics, cast-on math, and yardage estimates."
          />
          <Pillar
            icon={<FiCheckCircle className="h-6 w-6" />}
            title="Validate it"
            body="Feasibility checks every pattern against the yarn you actually own. Substitution finder. Color palette drawn from your real stash. No more ordering extra skeins you already have."
          />
          <Pillar
            icon={<FiMic className="h-6 w-6" />}
            title="Knit it live"
            body={'Chart follower and PDF row-marker with voice control and multi-device sync. Say "next" — the counter ticks, the chart row advances, every device catches up.'}
          />
        </div>
      </section>

      {/* Feature highlights — secondary grid with the concrete differentiators */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-center text-2xl sm:text-3xl font-bold">The whole workbench, one app</h2>
        <p className="text-center mt-2 text-gray-600 dark:text-gray-400">
          What makes knitters stay.
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
      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-10 dark:border-purple-900/40 dark:bg-purple-900/20">
          <h2 className="text-2xl sm:text-3xl font-bold">Start knitting with Rowly</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-300">
            Early access is open. Bring a project in progress — or start your first design in
            five minutes.
          </p>
          <Link
            to="/register"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 text-base font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Create your free account <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>© {new Date().getFullYear()} Rowly</span>
          <a
            href="mailto:hello@rowlyknit.com"
            className="hover:text-gray-700 dark:hover:text-gray-200"
          >
            hello@rowlyknit.com
          </a>
        </div>
      </footer>
    </div>
  );
}

function Pillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800/50">
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
