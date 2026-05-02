import { Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiBookmark,
  FiMic,
  FiLink,
  FiGrid,
  FiCloudOff,
  FiFileText,
  FiShare2,
  FiLayers,
  FiBookOpen,
  FiChevronRight,
} from 'react-icons/fi';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: HelpSection[] = [
  { id: 'magic-markers', title: 'Magic Markers', icon: FiBookmark },
  { id: 'voice-commands', title: 'Voice Commands', icon: FiMic },
  { id: 'ravelry', title: 'Ravelry OAuth + Sync', icon: FiLink },
  { id: 'chart-direction', title: 'Chart Direction', icon: FiGrid },
  { id: 'offline-sync', title: 'Offline Sync', icon: FiCloudOff },
  { id: 'structured-memos', title: 'Structured Memos', icon: FiFileText },
  { id: 'chart-sharing', title: 'Chart Sharing', icon: FiShare2 },
  { id: 'pattern-collation', title: 'Pattern Collation', icon: FiLayers },
];

export default function Help() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <FiArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Help &amp; How-To</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          The short-and-plain version of Rowly's less-obvious features. For each one: what it is, how to turn it on, and
          the gotchas you'll hit.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          to="/help/glossary"
          className="group flex items-center gap-4 rounded-lg border border-purple-200 bg-purple-50 p-4 transition hover:border-purple-400 hover:shadow dark:border-purple-700 dark:bg-purple-900/20"
        >
          <FiBookOpen className="h-8 w-8 flex-shrink-0 text-purple-600 dark:text-purple-300" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Stitch Abbreviations</h2>
              <FiChevronRight className="h-5 w-5 text-gray-400 transition group-hover:text-purple-600" />
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              195 canonical CYC abbreviations across knit, crochet, Tunisian, loom-knit.
            </p>
          </div>
        </Link>

        <Link
          to="/help/knit911"
          className="group flex items-center gap-4 rounded-lg border border-purple-200 bg-purple-50 p-4 transition hover:border-purple-400 hover:shadow dark:border-purple-700 dark:bg-purple-900/20"
        >
          <FiBookOpen className="h-8 w-8 flex-shrink-0 text-purple-600 dark:text-purple-300" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Knit911</h2>
              <FiChevronRight className="h-5 w-5 text-gray-400 transition group-hover:text-purple-600" />
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              18 plain-language fixes for the most common knitting problems.
            </p>
          </div>
        </Link>
      </div>

      <nav aria-label="Help sections" className="mb-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Jump to</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {SECTIONS.map(({ id, title, icon: Icon }) => (
            <li key={id}>
              <a href={`#${id}`} className="flex items-center gap-2 text-purple-700 dark:text-purple-400 hover:underline">
                <Icon className="h-4 w-4" />
                {title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-10">
        <section id="magic-markers" className="scroll-mt-8">
          <SectionHeader icon={FiBookmark} title="Magic Markers" />
          <p>
            Magic Markers are rule-based reminders attached to a project. Instead of tying a note to a static row number,
            you pick a trigger and Rowly surfaces the marker when the trigger fires during your knitting session.
          </p>
          <h3 className="mt-4 font-semibold">Setting one up</h3>
          <ol className="list-decimal pl-6 space-y-1">
            <li>Open a project and scroll to the Magic Markers section.</li>
            <li>Click <em>New Marker</em> and give it a title, note text, and priority.</li>
            <li>Pick a trigger type (see below).</li>
            <li>Optionally link it to a counter — the marker will fire based on that counter's value.</li>
            <li>Save. Active markers appear as banners in Make Mode when their trigger condition is true.</li>
          </ol>
          <h3 className="mt-4 font-semibold">Trigger types</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Row range</strong> — fires while you're on rows N–M. Optionally repeats every K rows inside the range.</li>
            <li><strong>Counter value</strong> — compares a counter against a number (<code>equals</code>, <code>greater than</code>, <code>less than</code>, or <code>multiple of</code>).</li>
            <li><strong>Row interval</strong> — fires every N rows, no range limit.</li>
            <li><strong>Stitch count</strong> — fires when a stitch counter hits a target value.</li>
            <li><strong>Time based</strong> — fires every N minutes of active session time.</li>
          </ul>
          <h3 className="mt-4 font-semibold">Gotchas</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Markers only evaluate while a session is active. Starting a session &ldquo;wakes&rdquo; them.</li>
            <li>Counter-based triggers need a counter linked at creation time. If you delete the counter, the marker stays but stops firing.</li>
            <li>You can snooze a marker from the banner. Snoozed markers come back once the snooze timestamp passes.</li>
          </ul>
        </section>

        <section id="voice-commands" className="scroll-mt-8">
          <SectionHeader icon={FiMic} title="Voice Commands" />
          <p>
            Counter cards have a microphone button. Tap it once to start listening; tap again to stop. Rowly will adjust
            the counter when it hears a word from the command vocabulary.
          </p>
          <h3 className="mt-4 font-semibold">Vocabulary</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Increment</strong>: <em>next, plus, add, up, increment, forward, more, another, mark, tick, count, advance, go</em></li>
            <li><strong>Decrement</strong>: <em>back, minus, undo, down, decrement, previous, oops, mistake, return, rewind, last</em></li>
            <li><strong>Reset</strong>: <em>reset, clear, restart, zero</em></li>
          </ul>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Rowly also checks up to 3 alternate transcriptions per utterance, so close-sounding words (&ldquo;neck&rdquo; for
            &ldquo;next&rdquo;, &ldquo;bag&rdquo; for &ldquo;back&rdquo;) still match.
          </p>
          <h3 className="mt-4 font-semibold">Browser requirements</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Uses the Web Speech API (<code>SpeechRecognition</code> / <code>webkitSpeechRecognition</code>).</li>
            <li>Works in Chrome, Edge, and other Chromium browsers. Safari supports it too.</li>
            <li>Firefox does not currently ship the API — the mic button will show an error.</li>
            <li>Requires HTTPS (or <code>localhost</code>). Mixed-content pages will be blocked.</li>
          </ul>
          <h3 className="mt-4 font-semibold">Permissions</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>First use prompts for microphone access. If you deny it, revoke the block in your browser's site settings to re-enable.</li>
            <li>Some OSes also require a system-level mic permission (macOS: System Settings → Privacy → Microphone).</li>
          </ul>
          <h3 className="mt-4 font-semibold">Settings</h3>
          <p>
            Voice preferences live under <strong>Profile → Voice</strong>. You can:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Speak the counter value</strong> — when enabled, Rowly reads the new count
              out loud (&ldquo;sixteen&rdquo;) after every voice command, so you can keep your
              eyes on your stitches.
            </li>
            <li>
              <strong>Auto-stop after silence</strong> — the mic shuts off after a chosen idle
              period (default 2 min) to save battery. Tap the mic icon to resume.
            </li>
            <li>
              <strong>Recognition language</strong> — the default vocabulary is English. Non-English
              support depends on your browser's speech engine.
            </li>
          </ul>
        </section>

        <section id="ravelry" className="scroll-mt-8">
          <SectionHeader icon={FiLink} title="Ravelry OAuth + Sync" />
          <p>
            Rowly talks to Ravelry through OAuth 2.0. Your Ravelry password never touches Rowly; we store a token on our
            server tied to your account.
          </p>
          <h3 className="mt-4 font-semibold">Connecting</h3>
          <ol className="list-decimal pl-6 space-y-1">
            <li>Go to <Link className="text-purple-700 hover:underline" to="/profile">Profile</Link> and find the Integrations section.</li>
            <li>Click <em>Connect Ravelry</em>. You'll be redirected to Ravelry to approve.</li>
            <li>After approval, Ravelry sends you back to Rowly and the token is stored.</li>
            <li>Once connected, you'll see <em>Search Ravelry</em> buttons on the Patterns list and Yarn Stash, and a <em>Ravelry Favorites</em> import.</li>
          </ol>
          <h3 className="mt-4 font-semibold">Sync behavior</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Today:</strong> read-only import. You pull patterns, yarn, and favorites into Rowly.</li>
            <li><strong>Not yet:</strong> bidirectional sync (pushing Rowly edits back to Ravelry). That's a planned Phase 6 feature.</li>
            <li>Importing a yarn creates a new row in your stash with the Ravelry metadata prefilled. You can edit everything after import.</li>
          </ul>
          <h3 className="mt-4 font-semibold">Disconnecting</h3>
          <p>
            On the Profile page you can revoke Rowly's token. After that, Ravelry-only features go quiet — nothing you imported
            gets deleted.
          </p>
        </section>

        <section id="chart-direction" className="scroll-mt-8">
          <SectionHeader icon={FiGrid} title="Chart Direction" />
          <p>
            Knitting charts aren't always read the same way. Rowly supports three patterns so that the chart viewer tracks
            where your needles actually are.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Right-to-left (standard flat knitting)</strong> — every row reads right-to-left, from the bottom up.
              This matches most published charts.
            </li>
            <li>
              <strong>Boustrophedon (back-and-forth)</strong> — odd rows read right-to-left, even rows read left-to-right.
              This is how charts are read on pieces worked flat when you turn after each row, so the chart symbols match the
              fabric as it appears.
            </li>
            <li>
              <strong>Center-out</strong> — progress radiates from the chart center. Used for top-down raglans, hats worked
              in the round, doilies, and similar circular-growth pieces. Rowly highlights the current ring rather than a row.
            </li>
          </ul>
          <p className="mt-2">
            You set the direction on the chart itself when uploading / creating it. Change it later in the chart's settings.
          </p>
        </section>

        <section id="offline-sync" className="scroll-mt-8">
          <SectionHeader icon={FiCloudOff} title="Offline Sync" />
          <p>
            Rowly is a PWA. Once you've loaded a project online, its data, pattern files, and counter state are cached
            locally, so you can keep knitting on a plane, in a basement, or wherever WiFi gives up.
          </p>
          <h3 className="mt-4 font-semibold">What happens when you go offline</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>You'll see an offline banner at the top of the app.</li>
            <li>Counter increments, session time, notes, and memos are stored in a local queue.</li>
            <li>Photo uploads wait in the queue — they do not upload until you're back online.</li>
          </ul>
          <h3 className="mt-4 font-semibold">When you're back online</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>The queue replays to the server. A small spinner in the top right shows sync progress.</li>
            <li>If the server has a newer version of the same field (e.g. you edited the project from another device),
              Rowly flags a <em>conflict</em>.</li>
          </ul>
          <h3 className="mt-4 font-semibold">How conflicts resolve</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>The Conflict Resolver panel appears with &ldquo;keep local&rdquo; / &ldquo;keep server&rdquo; / &ldquo;merge&rdquo; choices.</li>
            <li>For counter values and timers, &ldquo;merge&rdquo; takes the larger number (assumes forward progress).</li>
            <li>For free-text fields (notes, descriptions), you pick one side — there is no automatic text merge.</li>
            <li>You can resolve one conflict at a time or use &ldquo;Resolve all&rdquo; with a single choice.</li>
          </ul>
        </section>

        <section id="structured-memos" className="scroll-mt-8">
          <SectionHeader icon={FiFileText} title="Structured Memos" />
          <p>
            Structured Memos live on the Notes tab of a project. They're fill-in templates, so the same kind of information
            ends up in the same fields and you can compare across projects later.
          </p>
          <h3 className="mt-4 font-semibold">Templates</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Gauge Swatch</strong> — swatch width/height (inches), stitch and row count, washed vs unwashed, notes
              on blocking. Feeds into size calculations later.
            </li>
            <li>
              <strong>Modifications</strong> — what you changed from the published pattern (length, stitch count, needle
              size), and why. Good for reproducing a fit on your next sweater.
            </li>
            <li>
              <strong>Finishing</strong> — blocking dimensions, seaming method, weaving-in decisions, button/zipper notes.
            </li>
            <li>
              <strong>Gift / Recipient</strong> — measurements, preferences, allergies, deadline. Tie to a row in Recipients
              so the notes travel with the gift history.
            </li>
          </ul>
          <p className="mt-2">
            Each memo is saved into the project's notes list. They don't replace Audio or Handwritten notes — they sit alongside them.
          </p>
        </section>

        <section id="chart-sharing" className="scroll-mt-8">
          <SectionHeader icon={FiShare2} title="Chart Sharing" />
          <p>
            You can generate a public link to any chart so a knitting friend or test knitter can view the chart without a
            Rowly account.
          </p>
          <h3 className="mt-4 font-semibold">Behavior</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>The link is read-only. Viewers see the chart, your legend, and any notes attached — they cannot edit anything.</li>
            <li>Viewers don't see your other charts, projects, or account data. The link carries only the single chart.</li>
            <li>Revoking the link invalidates it immediately. Anyone visiting afterward sees a &ldquo;no longer available&rdquo; page.</li>
            <li>If the source chart is updated, the public link reflects the update automatically on the next load.</li>
          </ul>
          <p className="mt-2">
            Generate / revoke the link from the chart's settings panel.
          </p>
        </section>

        <section id="pattern-collation" className="scroll-mt-8">
          <SectionHeader icon={FiLayers} title="Pattern Collation" />
          <p>
            Pattern Collation merges multiple PDF files into a single printable pattern. Handy when a designer ships
            pattern + chart + schematic as separate files and you'd rather print one bundle.
          </p>
          <h3 className="mt-4 font-semibold">When to use it</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Designer sent a main PDF and a separate chart PDF — bundle them.</li>
            <li>You want to drop the size pages you don't need before printing.</li>
            <li>You have errata from the designer — merge it in as an appendix.</li>
          </ul>
          <h3 className="mt-4 font-semibold">How to collate</h3>
          <ol className="list-decimal pl-6 space-y-1">
            <li>On the Patterns list, open the &ldquo;…&rdquo; overflow menu in the header and choose <em>Merge PDFs</em>.</li>
            <li>Select the pattern PDFs you want to combine.</li>
            <li>Reorder pages if needed, then confirm.</li>
            <li>The merged PDF is attached back to the pattern (or downloadable).</li>
          </ol>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Collation runs in your browser — your files don't leave your device unless you choose to save the result to Rowly.
          </p>
        </section>
      </div>

      <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
        Missing a topic? Ping the Rowly owner — this page will grow.
      </footer>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
      <Icon className="h-5 w-5 text-purple-600" />
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
    </div>
  );
}
