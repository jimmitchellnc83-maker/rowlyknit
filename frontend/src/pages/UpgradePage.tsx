/**
 * Upgrade — Rowly Maker plan page.
 *
 * Wired to the billing surface added in the Lemon Squeezy Billing Prep
 * sprint. Three states the page can render:
 *
 *   1. Not logged in — pricing visible, "Start trial" CTA bounces to
 *      register/login then comes back here.
 *
 *   2. Logged in, billing NOT yet provisioned — pricing visible but
 *      both checkout buttons replaced with "Billing is coming soon"
 *      copy. Owner / pre-launch users see a small note that they
 *      already have full access.
 *
 *   3. Logged in, billing ready — buttons hit
 *      `POST /api/billing/checkout/{plan}` and `window.location =
 *      response.checkoutUrl`. Already-entitled users see a confirmation
 *      and a "Manage billing" button instead.
 *
 * Pricing is hard-coded in copy (not in the backend response) because
 * the variant IDs live in env and the prices are baked into the
 * Lemon Squeezy variants — copy here just has to match them. If the
 * owner changes the prices in LS, this file is the only spot to
 * update.
 *
 * GO-LIVE CHECKLIST — pricing drift risk:
 *   The `$12/mo` and `$80/yr` literals below MUST match the variant
 *   prices configured in the Lemon Squeezy dashboard. If they ever
 *   diverge a customer would see one price on the page and a
 *   different one at checkout. Two ways to mitigate:
 *     - Manual: every time the owner changes a price in LS, also
 *       update the strings in PRICING_MONTHLY/PRICING_ANNUAL below
 *       (the only canonical strings) and ship a deploy.
 *     - Automated: add a startup ping that fetches each variant via
 *       the LS API and asserts the `unit_price` matches what we
 *       advertise. Out of scope for this PR; track in the launch
 *       backlog.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiClock, FiExternalLink, FiLoader } from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';
import { useAuthStore } from '../stores/authStore';
import { canUsePaidWorkspace } from '../lib/entitlement';
import {
  BillingError,
  BillingStatus,
  fetchBillingStatus,
  fetchPortalUrl,
  humanStatusLabel,
  startCheckout,
} from '../lib/billing';
import { trackEvent } from '../lib/analytics';
import { PRICING_USD } from '../lib/pricing';

const PRICE_MONTHLY_LABEL = `$${PRICING_USD.monthly}`;
const PRICE_ANNUAL_LABEL = `$${PRICING_USD.annual}`;
const ANNUAL_SAVINGS_LABEL = `$${PRICING_USD.monthly * 12 - PRICING_USD.annual}`;

const FEATURES = [
  'Save calculator results to projects, patterns, yarn stash, or Make Mode reminders.',
  'Row-by-row counter that sticks across devices.',
  'Pattern library + PDF workspace with annotations and crops.',
  'Stash inventory that tracks what each project consumes.',
  'Make Mode for hands-free progress on a project.',
  'Pattern Designer + chart library.',
];

export default function UpgradePage() {
  useSeo({
    title: `Rowly Maker — knitting workspace (${PRICE_MONTHLY_LABEL}/mo or ${PRICE_ANNUAL_LABEL}/yr, 30-day trial)`,
    description: `Rowly Maker turns calculator results into project plans, gauge logs, and shaping reminders. ${PRICE_MONTHLY_LABEL}/month or ${PRICE_ANNUAL_LABEL}/year with a 30-day trial.`,
    canonicalPath: '/upgrade',
  });

  const { user, isAuthenticated } = useAuthStore();

  // Fire `upgrade_page_viewed` once per mount so the dashboard funnel
  // can compute the upgrade-page → checkout-start conversion. Plausible
  // also gets the event; the first-party endpoint is what populates
  // `usage_events` for /admin/business.
  useEffect(() => {
    trackEvent('upgrade_page_viewed');
  }, []);

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [busy, setBusy] = useState<'monthly' | 'annual' | 'portal' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Depend on `user?.id` rather than the full `user` object so we
  // don't re-fetch billing status every time a transient field
  // (avatar URL, last_seen, etc.) on the auth store mutates. The
  // /api/billing/status response only changes when the *identity*
  // changes, which the id captures uniquely.
  const userId = user?.id;
  const userEmail = user?.email;
  useEffect(() => {
    if (!isAuthenticated) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    setLoadingStatus(true);
    fetchBillingStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err: BillingError) => {
        if (cancelled) return;
        // 503 with BILLING_NOT_AVAILABLE is expected pre-provisioning;
        // we still want to show a coherent message, not a toast.
        if (err.code === 'BILLING_NOT_AVAILABLE') {
          const fallback = canUsePaidWorkspace({ email: userEmail });
          setStatus({
            provider: 'none',
            providerReady: false,
            preLaunchOpen: false,
            entitled: fallback.allowed,
            reason: fallback.reason,
            plan: null,
            status: null,
            trialEndsAt: null,
            renewsAt: null,
            endsAt: null,
            customerPortalUrl: null,
          });
        } else {
          setErrorMsg(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId, userEmail]);

  const ownerEntitled =
    canUsePaidWorkspace(user).reason === 'owner' ||
    canUsePaidWorkspace(user).reason === 'pre_launch_open';

  const billingReady = status?.providerReady === true && status.provider !== 'none';

  const handleCheckout = async (plan: 'monthly' | 'annual') => {
    setErrorMsg(null);
    if (!isAuthenticated) {
      trackEvent('upgrade_checkout_redirect_login', { plan });
      window.location.href = `/login?next=${encodeURIComponent('/upgrade')}`;
      return;
    }

    setBusy(plan);
    try {
      // Dashboard funnel reads `checkout_started`; keep the legacy
      // `upgrade_checkout_started` event firing for any Plausible goals
      // that already key off it.
      trackEvent('upgrade_checkout_started', { plan });
      trackEvent('checkout_started', { plan });
      const result = await startCheckout(plan);
      // Hand off to the provider — full-page navigation, the URL
      // contains a one-time token so we don't open in a new tab.
      window.location.href = result.checkoutUrl;
    } catch (err: any) {
      const e = err as BillingError;
      if (e.code === 'BILLING_NOT_AVAILABLE') {
        setErrorMsg('Billing is not available yet. We will email you the moment it opens.');
      } else {
        setErrorMsg(e.message ?? 'Could not start checkout');
      }
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setErrorMsg(null);
    setBusy('portal');
    try {
      const { portalUrl } = await fetchPortalUrl();
      window.location.href = portalUrl;
    } catch (err: any) {
      const e = err as BillingError;
      setErrorMsg(e.message ?? 'Could not open billing portal');
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="upgrade-page">
      <div>
        <Link
          to="/calculators"
          className="inline-flex items-center text-purple-600 hover:text-purple-700"
        >
          <FiArrowLeft className="mr-2 h-4 w-4" />
          Back to Calculators
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          Rowly Maker
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          The paid workspace that catches every gauge, size, yardage, and shaping result you
          calculate and pins it to a project, pattern, or your stash — so future-you doesn&apos;t
          have to re-do the math.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
          data-testid="upgrade-error"
        >
          {errorMsg}
        </div>
      )}

      {ownerEntitled && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"
          data-testid="upgrade-owner-banner"
        >
          You already have full access to Rowly Maker (account-level grant). Anyone you invite
          will need their own subscription.
        </div>
      )}

      {status?.entitled && !ownerEntitled && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"
          data-testid="upgrade-active-banner"
        >
          <div className="flex items-start gap-3">
            <FiCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">
                {status.reason === 'cancelled_grace'
                  ? 'Your Rowly Maker subscription is cancelled but still active.'
                  : "You're on Rowly Maker."}
              </p>
              <p className="mt-1">
                <strong>{humanStatusLabel(status.status, status.endsAt)}</strong>
                {status.plan ? ` · ${status.plan} plan` : ''}.{' '}
                {status.trialEndsAt && `Trial ends ${new Date(status.trialEndsAt).toLocaleDateString()}. `}
                {/* Suppress "Renews" copy during cancelled-grace — there is no renewal. */}
                {status.reason !== 'cancelled_grace' && status.renewsAt &&
                  `Renews ${new Date(status.renewsAt).toLocaleDateString()}.`}
                {status.reason === 'cancelled_grace' && status.endsAt &&
                  `Access until ${new Date(status.endsAt).toLocaleDateString()}.`}
              </p>
              <button
                type="button"
                onClick={handlePortal}
                disabled={busy !== null}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
                data-testid="upgrade-manage-billing"
              >
                {busy === 'portal' ? (
                  <FiLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <FiExternalLink className="h-4 w-4" />
                )}
                {status.reason === 'cancelled_grace' ? 'Resume subscription' : 'Manage billing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!billingReady && !ownerEntitled && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20 md:p-8">
          <div className="flex items-start gap-3">
            <FiClock className="h-6 w-6 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Billing is not available yet
              </h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Public calculators (gauge, size, yardage, row repeat, increase / decrease
                spacing) stay free forever. The paid workspace opens for trials in the next
                release. We&apos;ll email you when it&apos;s live.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2" aria-label="Pricing">
        <PricingCard
          plan="monthly"
          title="Monthly"
          price={PRICE_MONTHLY_LABEL}
          cadence="per month"
          tagline="Try Rowly Maker month-to-month."
          loading={loadingStatus}
          loggedIn={isAuthenticated}
          billingReady={billingReady}
          alreadyEntitled={status?.entitled === true || ownerEntitled}
          busy={busy === 'monthly'}
          disabled={busy !== null && busy !== 'monthly'}
          onCheckout={() => handleCheckout('monthly')}
        />
        <PricingCard
          plan="annual"
          title="Annual"
          price={PRICE_ANNUAL_LABEL}
          cadence="per year"
          tagline={`Save ${ANNUAL_SAVINGS_LABEL} vs. monthly. Best value.`}
          highlight
          loading={loadingStatus}
          loggedIn={isAuthenticated}
          billingReady={billingReady}
          alreadyEntitled={status?.entitled === true || ownerEntitled}
          busy={busy === 'annual'}
          disabled={busy !== null && busy !== 'annual'}
          onCheckout={() => handleCheckout('annual')}
        />
      </section>

      <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 md:p-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          What&apos;s in Rowly Maker
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc ml-5">
          {FEATURES.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Every plan starts with a <strong>30-day free trial</strong>. Cancel anytime — your
          public-tool access remains free regardless.
        </p>
      </section>

      {!isAuthenticated && (
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800/40 md:p-6">
          <p>
            Already have an account?{' '}
            <Link to="/login?next=%2Fupgrade" className="text-purple-700 hover:underline dark:text-purple-400">
              Sign in
            </Link>{' '}
            to start your trial.
          </p>
        </section>
      )}
    </div>
  );
}

interface PricingCardProps {
  plan: 'monthly' | 'annual';
  title: string;
  price: string;
  cadence: string;
  tagline: string;
  highlight?: boolean;
  loading: boolean;
  /** True when the visitor is logged in. */
  loggedIn: boolean;
  /** True when the configured billing provider is fully provisioned. */
  billingReady: boolean;
  /** True when the user already has an entitled subscription / owner role. */
  alreadyEntitled: boolean;
  busy: boolean;
  disabled: boolean;
  onCheckout: () => void;
}

/**
 * The CTA's enabled state and label vary across four states:
 *
 *   logged out                                        → enabled, "Start trial" → bounces to /login
 *   logged in, entitled (paid / owner / pre-launch)   → disabled, "Already on Maker"
 *   logged in, not entitled, billing not ready        → disabled, "Coming soon"
 *   logged in, not entitled, billing ready            → enabled, "Start 30-day trial"
 */
function PricingCard({
  plan,
  title,
  price,
  cadence,
  tagline,
  highlight,
  loading,
  loggedIn,
  billingReady,
  alreadyEntitled,
  busy,
  disabled,
  onCheckout,
}: PricingCardProps) {
  const ctaLabel = alreadyEntitled
    ? 'Already on Maker'
    : !loggedIn
      ? `Start 30-day trial — ${title}`
      : !billingReady
        ? 'Coming soon'
        : `Start 30-day trial — ${title}`;

  // Disabled when:
  //  - already on Maker (no action),
  //  - logged in + billing-not-ready (no real CTA possible),
  //  - already-busy with a different plan,
  //  - mid-load.
  const buttonDisabled =
    disabled ||
    alreadyEntitled ||
    (loggedIn && !billingReady) ||
    loading;

  return (
    <article
      className={`rounded-xl border p-6 ${
        highlight
          ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200 dark:border-purple-700 dark:bg-purple-900/20'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
      data-testid={`pricing-card-${plan}`}
    >
      <header>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{tagline}</p>
      </header>
      <div className="mt-4">
        <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">{price}</span>
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{cadence}</span>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        disabled={buttonDisabled}
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 min-h-[44px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
          highlight
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white'
        }`}
        data-testid={`checkout-${plan}`}
      >
        {busy ? <FiLoader className="h-4 w-4 animate-spin" /> : null}
        {ctaLabel}
      </button>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
        30-day free trial. Cancel any time.
      </p>
    </article>
  );
}
