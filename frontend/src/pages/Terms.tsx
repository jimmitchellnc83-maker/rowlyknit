import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Terms of Service. Update `lastUpdated` whenever the substantive text
 * changes (not for typo / formatting tweaks).
 */
export default function Terms() {
  const lastUpdated = '2026-05-01';

  return (
    <LegalShell title="Terms of Service" lastUpdated={lastUpdated}>
      <p>
        Welcome to Rowly. By creating an account or using rowlyknit.com and related
        services (the &ldquo;Service&rdquo;), you agree to these Terms. If you don&rsquo;t
        agree, don&rsquo;t use the Service.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>
          You must be at least 13 years old to use Rowly. Accounts known or suspected
          to belong to children under 13 will be removed.
        </li>
        <li>
          You are responsible for keeping your password confidential and for all
          activity under your account. Tell us immediately if you suspect unauthorized
          access.
        </li>
        <li>
          Provide accurate information when you sign up. One account per person.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        The projects, patterns, designs, photos, yarn records, and other data you
        upload or create are yours. You grant Rowly a limited license to store,
        process, and display that content solely to operate the Service for you (for
        example, saving your stash so you can view it on another device).
      </p>
      <p>
        You keep all intellectual property rights in content you create. If you
        publish a design via a future sharing or marketplace feature, we&rsquo;ll
        present the specific terms at that time.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Upload or share unlawful, abusive, or infringing content.</li>
        <li>
          Attempt to access another user&rsquo;s data or reverse-engineer the Service.
        </li>
        <li>
          Use the Service to send spam, scrape at scale, or bypass rate limits.
        </li>
        <li>
          Impersonate anyone or misrepresent your affiliation with any person or
          organization.
        </li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        Rowly integrates with optional third-party services you choose to connect
        (currently Ravelry; future integrations may include others). When you connect
        a third-party service, its own terms and privacy policy apply in addition to
        these Terms. You can disconnect at any time from your profile.
      </p>

      <h2>Availability</h2>
      <p>
        We aim for high uptime but don&rsquo;t guarantee it. The Service is provided
        &ldquo;as is&rdquo; during early access; we may change, pause, or remove
        features as we iterate. If the Service is down, your data remains safe on our
        servers and will be available again when we restore it.
      </p>

      <h2>Pricing</h2>
      <p>
        Rowly is free during early access. If we introduce paid tiers, we&rsquo;ll
        give notice and the opportunity to choose whether to upgrade; we won&rsquo;t
        silently charge an existing free account.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account at any time. We may suspend or terminate accounts
        that violate these Terms or present a safety/legal risk, with notice when
        practicable. On account deletion, your content is removed from the running
        Service within 30 days; backup copies are overwritten on their normal
        rotation.
      </p>

      <h2>Disclaimers &amp; liability</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind.
        To the fullest extent permitted by law, Rowly is not liable for lost profits,
        lost knitting time, or indirect, incidental, or consequential damages.
        Nothing in these Terms limits liability for fraud, willful misconduct, or
        anything that can&rsquo;t be limited by law.
      </p>

      <h2>Governing law &amp; disputes</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which Rowly is
        operated, without regard to conflict-of-laws rules. Disputes are handled in
        the courts of that jurisdiction unless applicable consumer-protection law
        says otherwise.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms. Material changes will be announced by email and
        reflected by an updated &ldquo;Last updated&rdquo; date above. Continued use
        after changes means acceptance.
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
