/**
 * Account → Billing
 *
 * The "what's my plan" page. Reads `GET /api/billing/status`, shows the
 * current state, and gives the user the controls they expect:
 *   - Pre-trial / unpaid: link out to /upgrade.
 *   - On trial / active: surface plan, renewal date, and a "Manage
 *     billing" button that hits the customer portal URL the webhook
 *     stored on `billing_subscriptions`.
 *   - Cancelled / expired: invite to re-subscribe.
 *   - Owner / pre-launch: explanatory note, no buttons.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiExternalLink, FiLoader } from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';
import { useAuthStore } from '../stores/authStore';
import { canUsePaidWorkspace } from '../lib/entitlement';
import {
  BillingError,
  BillingStatus,
  fetchBillingStatus,
  fetchPortalUrl,
  humanStatusLabel,
} from '../lib/billing';

export default function AccountBillingPage() {
  useSeo({
    title: 'Billing — Rowly',
    description: 'Manage your Rowly Maker subscription.',
    canonicalPath: '/account/billing',
  });

  const { user } = useAuthStore();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  // Depend on the stable identity bits of `user` rather than the whole
  // object. Re-rendering parent components can mint a new `user`
  // reference every render even when nothing relevant changed (e.g. a
  // store update that touches an unrelated slice). The stale-closure
  // protection from `cancelled` is still in place.
  const userId = user?.id;
  const userEmail = user?.email;
  useEffect(() => {
    let cancelled = false;
    fetchBillingStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err: BillingError) => {
        if (cancelled) return;
        if (err.code === 'BILLING_NOT_AVAILABLE') {
          // Surface the local entitlement reason so the page still
          // tells the user something useful (owner / pre-launch open).
          setStatus({
            provider: 'none',
            providerReady: false,
            preLaunchOpen: false,
            entitled: canUsePaidWorkspace(user).allowed,
            reason: canUsePaidWorkspace(user).reason,
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
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userEmail]);

  const handlePortal = async () => {
    setErrorMsg(null);
    setPortalBusy(true);
    try {
      const { portalUrl } = await fetchPortalUrl();
      window.location.href = portalUrl;
    } catch (err: any) {
      const e = err as BillingError;
      setErrorMsg(e.message ?? 'Could not open billing portal');
      setPortalBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="account-billing-loading">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <div className="animate-pulse text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="account-billing-page">
      <div>
        <Link
          to="/profile"
          className="inline-flex items-center text-purple-600 hover:text-purple-700"
        >
          <FiArrowLeft className="mr-2 h-4 w-4" />
          Back to Profile
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Billing
        </h1>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {status?.reason === 'owner' && (
        <Card title="Account-level access">
          <p>
            You have full access to Rowly Maker as the account owner. No subscription is required
            for your account.
          </p>
        </Card>
      )}

      {status?.reason === 'pre_launch_open' && (
        <Card title="Pre-launch access">
          <p>
            Rowly Maker is open to all logged-in users while billing is being provisioned. Once
            the trial flow opens, your account will be invited to subscribe.
          </p>
        </Card>
      )}

      {status?.entitled && status.reason !== 'owner' && status.reason !== 'pre_launch_open' && (
        <Card title="You're on Rowly Maker" data-testid="account-billing-active">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className="font-semibold">{humanStatusLabel(status.status)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Plan</dt>
              <dd className="font-semibold">{status.plan ?? '—'}</dd>
            </div>
            {status.trialEndsAt && (
              <div>
                <dt className="text-gray-500">Trial ends</dt>
                <dd>{new Date(status.trialEndsAt).toLocaleDateString()}</dd>
              </div>
            )}
            {status.renewsAt && (
              <div>
                <dt className="text-gray-500">Renews</dt>
                <dd>{new Date(status.renewsAt).toLocaleDateString()}</dd>
              </div>
            )}
            {status.endsAt && (
              <div>
                <dt className="text-gray-500">Ends</dt>
                <dd>{new Date(status.endsAt).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
          <button
            type="button"
            onClick={handlePortal}
            disabled={portalBusy}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            data-testid="account-billing-portal"
          >
            {portalBusy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiExternalLink className="h-4 w-4" />}
            Manage billing
          </button>
        </Card>
      )}

      {status && !status.entitled && (
        <Card title="No active subscription" data-testid="account-billing-inactive">
          <p>
            You don&apos;t have a Rowly Maker subscription yet. Public calculators stay free; saving
            results to projects, patterns, or stash needs an active trial or subscription.
          </p>
          <Link
            to="/upgrade"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-purple-700"
          >
            Start 30-day trial
          </Link>
        </Card>
      )}

      {!status?.providerReady && status?.provider === 'lemonsqueezy' && (
        <Card title="Billing not available yet">
          <p>
            Billing is configured but missing a required setting on the server. The owner has been
            alerted; please try again in a bit.
          </p>
        </Card>
      )}
    </div>
  );
}

interface CardProps {
  title: string;
  children: React.ReactNode;
  ['data-testid']?: string;
}

function Card({ title, children, ...rest }: CardProps) {
  return (
    <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800" {...rest}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 space-y-2">{children}</div>
    </section>
  );
}
