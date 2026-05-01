import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Privacy Policy — covers the data the app actually collects. Update
 * `lastUpdated` whenever the substantive text changes.
 */
export default function Privacy() {
  const lastUpdated = '2026-05-01';

  return (
    <LegalShell title="Privacy Policy" lastUpdated={lastUpdated}>
      <p>
        This Privacy Policy describes how Rowly (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects,
        uses, and shares information when you use rowlyknit.com and related services
        (the &ldquo;Service&rdquo;).
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> your email address, display name, and
          hashed password. We never store your password in plaintext.
        </li>
        <li>
          <strong>Your knitting data:</strong> projects, patterns, yarn stash entries,
          counters, photos, recipients, notes, and any designs you create in the
          Pattern Designer. You control this data and can export or delete it at any
          time (contact <a href="mailto:hello@rowlyknit.com">hello@rowlyknit.com</a>).
        </li>
        <li>
          <strong>Usage information:</strong> basic server logs (IP address, request
          paths, error reports) used to keep the service running and diagnose issues.
          Error reports are routed through Sentry with sensitive fields redacted.
        </li>
        <li>
          <strong>OAuth-connected services:</strong> if you choose to connect Ravelry,
          we store an encrypted access token so the Service can read your
          Ravelry projects, stash, bookmarks, and favorites on your behalf. You can
          disconnect at any time from your profile.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To provide the features you request (projects, patterns, stash, designer).</li>
        <li>To send account-related email (welcome, email verification, password reset).</li>
        <li>To keep the service secure (rate limiting, abuse detection).</li>
        <li>To diagnose and fix errors through aggregated logs and error reports.</li>
      </ul>

      <h2>Sharing</h2>
      <p>We do not sell your personal information. We share information only with:</p>
      <ul>
        <li>
          <strong>Service providers</strong> that help us operate (e.g. hosting,
          transactional email, error monitoring). They are bound by confidentiality
          and may only process your data on our behalf.
        </li>
        <li>
          <strong>Ravelry</strong> when you explicitly connect and request an import or
          export. We use the OAuth scopes you grant; revoking access in Ravelry or in
          your Rowly profile stops the connection.
        </li>
        <li>
          <strong>Law enforcement</strong> when required by valid legal process.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can access, export, correct, or delete your Rowly data at any time. For
        requests not yet available in the product UI, email{' '}
        <a href="mailto:hello@rowlyknit.com">hello@rowlyknit.com</a> and we will respond
        within 30 days. Residents of the EU/UK (GDPR) and California (CCPA) have
        additional rights; contact us to exercise them.
      </p>

      <h2>Cookies</h2>
      <p>
        Rowly uses strictly-necessary cookies for authentication and CSRF protection.
        We do not currently use third-party advertising or tracking cookies. If that
        changes we will update this page and surface an in-product notice before any
        new tracking is enabled.
      </p>

      <h2>Security</h2>
      <p>
        Data is transmitted over HTTPS. Passwords are hashed with bcrypt. Ravelry
        tokens and other third-party credentials are encrypted at rest. No security
        system is perfect — if you suspect a security issue, please email{' '}
        <a href="mailto:hello@rowlyknit.com">hello@rowlyknit.com</a>.
      </p>

      <h2>Children</h2>
      <p>
        Rowly is not directed to children under 13 and we do not knowingly collect
        information from them. If you believe a child has provided information,
        contact us and we will delete it.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. When we do, we will update the &ldquo;Last
        updated&rdquo; date at the top and, for material changes, notify registered
        users by email.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:hello@rowlyknit.com">hello@rowlyknit.com</a>.
      </p>
    </LegalShell>
  );
}

function LegalShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link to="/" className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          Rowly
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login" className="text-sm text-purple-700 dark:text-purple-300 hover:underline">
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <article
          className="
            mt-8 space-y-4 text-gray-700 dark:text-gray-300
            [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:text-gray-900 dark:[&>h1]:text-gray-100
            [&>h2]:mt-8 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:text-gray-900 dark:[&>h2]:text-gray-100
            [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6
            [&_a]:text-purple-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-purple-700 dark:[&_a]:text-purple-300
            [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100
          "
        >
          <h1>{title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: {lastUpdated}</p>
          {children}
        </article>

        <div className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <Link to="/" className="hover:text-gray-700 dark:hover:text-gray-200">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
