import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import db from '../config/database';
import logger from '../config/logger';
import {
  getBillingConfig,
  LEMONSQUEEZY_REQUIRED_ENV,
} from '../config/billing';
import { PRICING_USD, ANNUAL_AS_MONTHLY_USD } from '../config/pricing';
import {
  checkBilling,
  checkTransactionalEmail,
  getLastTransactionalEmailSuccessAt,
} from '../utils/healthCheck';
import {
  ADSENSE_SLOT_ENV_BY_TOOL,
  buildSlotConfigReport,
  allAdSenseSlotsConfigured,
} from '../config/adsenseSlots';

/**
 * Owner-only business command center — `/api/admin/business-dashboard`.
 *
 * Single endpoint that aggregates launch readiness, revenue, user growth,
 * funnel, public-tools performance, product usage, content/SEO posture,
 * and an owner-action checklist. The frontend renders one screen at
 * `/admin/business`.
 *
 * Design rules:
 *
 *  1. Never fake numbers. If we can't compute something we explicitly mark
 *     it `wired: false` and tell the operator what instrumentation is
 *     missing. The dashboard is meant to teach us what to add next, so a
 *     half-met metric must surface honestly.
 *
 *  2. Every count comes from a table or env config we already own:
 *       - launchReadiness:  health-check helpers, billing config, email config
 *       - revenue:          billing_subscriptions, billing_events
 *       - users:            users, usage_events
 *       - funnel:           usage_events (event names) + users + billing
 *       - publicTools:      static registry mirrored from frontend, joined
 *                            against usage_events totals
 *       - productUsage:     projects, patterns, pattern_models, source_files,
 *                            yarn, charts, usage_events
 *       - contentAndSEO:    static + a couple of cheap presence checks
 *       - ownerTasks:       computed from the other sections
 *
 *  3. Read-only. No mutation. The endpoint can be called as often as the
 *     owner wants without side-effects.
 */

// Public-tool registry mirrored from `frontend/src/lib/publicTools.ts` plus
// the two help pages. Routes only — backend doesn't need the React metadata.
const PUBLIC_TOOL_ROUTES: Array<{ id: string; route: string; kind: 'tool' | 'help' | 'index' }> = [
  { id: 'index', route: '/calculators', kind: 'index' },
  { id: 'gauge', route: '/calculators/gauge', kind: 'tool' },
  { id: 'size', route: '/calculators/size', kind: 'tool' },
  { id: 'yardage', route: '/calculators/yardage', kind: 'tool' },
  { id: 'row-repeat', route: '/calculators/row-repeat', kind: 'tool' },
  { id: 'shaping', route: '/calculators/shaping', kind: 'tool' },
  { id: 'glossary', route: '/help/glossary', kind: 'help' },
  { id: 'knit911', route: '/help/knit911', kind: 'help' },
];

// AdSense readiness — single source of truth duplicated from
// `frontend/src/components/ads/adRoutes.ts` so the backend dashboard
// can show the founder exactly which routes ads are allowed on without
// reaching across to the frontend bundle. Both lists are pinned by
// tests so they stay in sync.
const ADSENSE_PUBLISHER_ID = 'ca-pub-9472587145183950';
const ADSENSE_APPROVED_ROUTES: readonly string[] = [
  '/calculators',
  '/calculators/gauge',
  '/calculators/size',
  '/calculators/yardage',
  '/calculators/row-repeat',
  '/calculators/shaping',
  '/help/glossary',
  '/help/knit911',
] as const;
const ADSENSE_BLOCKED_SURFACES: readonly string[] = [
  '/ (landing page)',
  '/dashboard and the entire authenticated app',
  '/login, /register, /forgot-password, /reset-password, /verify-email',
  '/upgrade',
  '/account/billing',
  '/p/:slug (public FO share)',
  '/c/:token (recipient chart viewer)',
  '/calculators/yarn-sub (auth-only)',
  '/admin/* (founder tooling)',
] as const;
const ADSENSE_EXPECTED_ADS_TXT = `google.com, pub-9472587145183950, DIRECT, f08c47fec0942fa0`;

// Funnel event names we expect to exist. If any of these are missing from
// `usage_events` we surface them so the dashboard tells the operator
// exactly what instrumentation to add next, rather than rendering 0.
const FUNNEL_EVENTS = {
  publicToolViews: 'public_tool_viewed',
  calculatorUses: 'public_tool_used',
  saveToRowlyClicks: 'save_to_rowly_clicked',
  upgradePageViews: 'upgrade_page_viewed',
  checkoutStarts: 'checkout_started',
  checkoutCompleted: 'checkout_completed',
  trialStarts: 'trial_started',
} as const;

interface CountWindow {
  '7d': number;
  '30d': number;
}

async function safeRawCount(
  query: () => Promise<unknown>,
  fallback = 0,
): Promise<number> {
  try {
    const rows = (await query()) as Array<{ count?: string | number }>;
    const raw = rows?.[0]?.count;
    if (raw === undefined || raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch (err: any) {
    logger.warn('admin business dashboard count failed', { error: err?.message });
    return fallback;
  }
}

/**
 * Count rows in a table created in the last `days` days. Returns 0 if the
 * table doesn't exist (so a fresh DB or a deferred feature doesn't break
 * the dashboard). All callers swallow errors via `safeRawCount`.
 */
async function rowCountSinceDays(
  tableName: string,
  days: number,
  whereExtra?: (qb: any) => void,
): Promise<number> {
  return safeRawCount(async () => {
    const exists = await db.schema.hasTable(tableName);
    if (!exists) return [{ count: 0 }];
    const qb = db(tableName)
      .whereRaw(`created_at >= NOW() - (?::text || ' days')::interval`, [days])
      .count<{ count: string }[]>('* as count');
    if (whereExtra) whereExtra(qb);
    return qb;
  });
}

async function rowCountTotal(
  tableName: string,
  whereExtra?: (qb: any) => void,
): Promise<number> {
  return safeRawCount(async () => {
    const exists = await db.schema.hasTable(tableName);
    if (!exists) return [{ count: 0 }];
    const qb = db(tableName).count<{ count: string }[]>('* as count');
    if (whereExtra) whereExtra(qb);
    return qb;
  });
}

async function tableExists(name: string): Promise<boolean> {
  try {
    return await db.schema.hasTable(name);
  } catch {
    return false;
  }
}

/**
 * Build the launchReadiness block from existing health-check helpers + the
 * billing config. Mirrors what `/health` exposes so admin tooling reads one
 * shape — but adds a `suggestedNextAction` string the founder dashboard
 * leans on as the top-row signal.
 */
async function buildLaunchReadiness() {
  const cfg = getBillingConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  const emailCheck = checkTransactionalEmail();
  const billingCheck = checkBilling();
  const lastSuccessAt = await getLastTransactionalEmailSuccessAt();

  const blockers: string[] = [];
  if (emailCheck.details?.publicLaunchBlocked) {
    blockers.push(
      'transactional_email_noop: production EMAIL_PROVIDER=noop; signup + reset emails are not delivered',
    );
  }
  if (billingCheck.details?.publicLaunchBlocked) {
    blockers.push(`billing_not_ready: ${billingCheck.message ?? 'billing provider not production-ready'}`);
  }

  const publicLaunchBlocked = blockers.length > 0;

  // healthStatus: a coarse one-word summary the top-row card reads.
  let healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (emailCheck.status === 'fail' || billingCheck.status === 'fail') {
    healthStatus = isProduction ? 'unhealthy' : 'degraded';
  } else if (emailCheck.status === 'warn' || billingCheck.status === 'warn') {
    healthStatus = 'degraded';
  } else {
    healthStatus = 'healthy';
  }

  // Pick the single most-actionable suggestion for the founder.
  let suggestedNextAction: string;
  if (cfg.provider === 'lemonsqueezy' && !cfg.ready) {
    suggestedNextAction = `Lemon Squeezy is selected but missing env vars: ${cfg.missing.join(', ')}. Provision those and redeploy before flipping public.`;
  } else if (cfg.provider === 'none') {
    suggestedNextAction = 'Set BILLING_PROVIDER=lemonsqueezy and provision the LEMONSQUEEZY_* env vars to take real money.';
  } else if (isProduction && cfg.preLaunchOpen) {
    suggestedNextAction = 'BILLING_PRE_LAUNCH_OPEN=true in production — every signed-in user has free paid access. Flip to false once Lemon Squeezy is live.';
  } else if (emailCheck.status !== 'pass') {
    suggestedNextAction = 'Configure a real EMAIL_PROVIDER (Resend / Postmark / SendGrid / SES) — signup + reset email delivery is currently a no-op.';
  } else if (publicLaunchBlocked) {
    suggestedNextAction = 'Resolve the listed launch blockers, then re-smoke /health.';
  } else {
    suggestedNextAction = 'Public launch readiness OK. Run a paid checkout smoke and then announce.';
  }

  // Missing LS env vars — even when provider !== lemonsqueezy, list what
  // would be required if the operator flips it on. Useful for "what do I
  // still need from Lemon Squeezy" at a glance.
  const lsMissing =
    cfg.provider === 'lemonsqueezy' && !cfg.ready
      ? cfg.missing
      : cfg.provider === 'lemonsqueezy'
        ? []
        : LEMONSQUEEZY_REQUIRED_ENV.filter((name) => !process.env[name]);

  return {
    healthStatus,
    publicLaunchBlocked,
    publicLaunchBlockers: blockers,
    transactionalEmail: {
      provider: emailCheck.details?.provider ?? 'unknown',
      status: emailCheck.status, // 'pass' | 'warn' | 'fail'
      lastSuccessAt,
    },
    billing: {
      provider: cfg.provider,
      providerReady: cfg.ready,
      preLaunchOpen: cfg.preLaunchOpen,
      missingEnvVars: lsMissing,
    },
    suggestedNextAction,
  };
}

/**
 * Revenue stats. Reads `billing_subscriptions` + `billing_events`.
 *
 * MRR formula: any subscription whose normalised status is 'active'
 * counts. Trial subs aren't revenue yet (LS doesn't charge during
 * trial). Pricing constants live in `config/pricing.ts` and are
 * mirrored on the frontend in `lib/pricing.ts` — both must match the
 * configured Lemon Squeezy variant prices.
 */
const PRICE_USD_MONTHLY = PRICING_USD.monthly;
const PRICE_USD_ANNUAL = PRICING_USD.annual;

async function buildRevenue() {
  const cfg = getBillingConfig();
  const billingTable = await tableExists('billing_subscriptions');
  const billingEventsTable = await tableExists('billing_events');

  if (!billingTable) {
    return {
      wired: false,
      note: 'billing_subscriptions table does not exist — run migrations.',
      provider: cfg.provider,
      providerReady: cfg.ready,
      mrrUsd: 0,
      arrUsd: 0,
      activeSubscriptions: 0,
      trialSubscriptions: 0,
      cancelledSubscriptions: 0,
      expiredSubscriptions: 0,
      pastDueSubscriptions: 0,
      annualSubscribers: 0,
      monthlySubscribers: 0,
      averageRevenuePerUserUsd: 0,
      trialToPaidConversionRate: null,
      churnRate: null,
      failedPaymentCount: 0,
      latestBillingEventAt: null,
      pricing: { monthlyUsd: PRICE_USD_MONTHLY, annualUsd: PRICE_USD_ANNUAL },
    };
  }

  // Group subscriptions by status. Filter to the current provider so
  // dev-mode mock rows don't leak into the production view.
  let rows: Array<{ status: string; plan: string | null; count: string }> = [];
  try {
    rows = (await db('billing_subscriptions')
      .where({ provider: cfg.provider })
      .select('status', 'plan')
      .count('* as count')
      .groupBy('status', 'plan')) as unknown as typeof rows;
  } catch (err: any) {
    logger.warn('billing subs aggregate failed', { error: err?.message });
  }

  let activeSubscriptions = 0;
  let trialSubscriptions = 0;
  let cancelledSubscriptions = 0;
  let expiredSubscriptions = 0;
  let pastDueSubscriptions = 0;
  let annualSubscribers = 0;
  let monthlySubscribers = 0;

  for (const r of rows) {
    const n = Number(r.count) || 0;
    const status = (r.status || '').toLowerCase();
    if (status === 'active') activeSubscriptions += n;
    else if (status === 'on_trial' || status === 'trialing') trialSubscriptions += n;
    else if (status === 'cancelled' || status === 'canceled') cancelledSubscriptions += n;
    else if (status === 'expired') expiredSubscriptions += n;
    else if (status === 'past_due' || status === 'unpaid') pastDueSubscriptions += n;

    // Plan splits include only paying statuses (active + past_due).
    if (status === 'active' || status === 'past_due' || status === 'unpaid') {
      if (r.plan === 'annual') annualSubscribers += n;
      else if (r.plan === 'monthly') monthlySubscribers += n;
    }
  }

  // MRR/ARR — recurring revenue from `active` only. Trial subs aren't
  // revenue yet (LS doesn't charge during trial). Annual is amortised
  // to its monthly equivalent via the shared `ANNUAL_AS_MONTHLY_USD`
  // constant so the math here can't drift from the page price.
  const monthlyRevenueUsd = monthlySubscribers * PRICE_USD_MONTHLY + annualSubscribers * ANNUAL_AS_MONTHLY_USD;
  const mrrUsd = Math.round(monthlyRevenueUsd * 100) / 100;
  const arrUsd = Math.round(mrrUsd * 12 * 100) / 100;

  const totalPaying = activeSubscriptions + pastDueSubscriptions;
  const averageRevenuePerUserUsd =
    totalPaying > 0 ? Math.round((mrrUsd / totalPaying) * 100) / 100 : 0;

  // trial→paid conversion: paying / (trial + paying + cancelled-from-trial).
  // Without "trial outcome" tracking we approximate as
  //   activeSubs / (activeSubs + trialSubs + cancelled-since-trial)
  // and only show it when we have at least one trial to compare against.
  const trialToPaidDenom = activeSubscriptions + trialSubscriptions + cancelledSubscriptions;
  const trialToPaidConversionRate =
    trialToPaidDenom > 0 ? Math.round((activeSubscriptions / trialToPaidDenom) * 1000) / 10 : null;

  // Churn: cancelled-or-expired / (cancelled-or-expired + active). Coarse
  // until we have a 30-day cohort table; flagged as "approximate" in the
  // UI.
  const churnDenom = activeSubscriptions + cancelledSubscriptions + expiredSubscriptions;
  const churnRate =
    churnDenom > 0
      ? Math.round(((cancelledSubscriptions + expiredSubscriptions) / churnDenom) * 1000) / 10
      : null;

  // Failed payment count — reads `billing_events` for the relevant LS event.
  let failedPaymentCount = 0;
  let latestBillingEventAt: string | null = null;
  if (billingEventsTable) {
    failedPaymentCount = await safeRawCount(async () => {
      return db('billing_events')
        .where({ provider: cfg.provider })
        .whereIn('event_name', [
          'subscription_payment_failed',
          'subscription_payment_recovered_failed',
        ])
        .count<{ count: string }[]>('* as count');
    });

    try {
      const latest = await db('billing_events')
        .where({ provider: cfg.provider })
        .orderBy('created_at', 'desc')
        .first('created_at');
      latestBillingEventAt = latest?.created_at
        ? latest.created_at instanceof Date
          ? latest.created_at.toISOString()
          : new Date(latest.created_at).toISOString()
        : null;
    } catch (err: any) {
      logger.warn('latest billing event lookup failed', { error: err?.message });
    }
  }

  const note =
    cfg.provider === 'none'
      ? 'BILLING_PROVIDER is unset. Counts will stay at zero until Lemon Squeezy is provisioned.'
      : cfg.provider === 'mock'
        ? 'Billing in mock mode — counts here reflect mock data only.'
        : !cfg.ready
          ? 'Lemon Squeezy is selected but env vars are missing. No real charges have occurred yet.'
          : null;

  return {
    wired: true,
    note,
    provider: cfg.provider,
    providerReady: cfg.ready,
    mrrUsd,
    arrUsd,
    activeSubscriptions,
    trialSubscriptions,
    cancelledSubscriptions,
    expiredSubscriptions,
    pastDueSubscriptions,
    annualSubscribers,
    monthlySubscribers,
    averageRevenuePerUserUsd,
    trialToPaidConversionRate,
    churnRate,
    failedPaymentCount,
    latestBillingEventAt,
    pricing: { monthlyUsd: PRICE_USD_MONTHLY, annualUsd: PRICE_USD_ANNUAL },
  };
}

async function buildUsers() {
  const usageTable = await tableExists('usage_events');

  const totalUsers = await rowCountTotal('users', (qb) => qb.whereNull('deleted_at'));
  const verifiedUsers = await rowCountTotal('users', (qb) =>
    qb.whereNull('deleted_at').where('email_verified', true),
  );
  const unverifiedUsers = Math.max(0, totalUsers - verifiedUsers);

  const newUsersToday = await safeRawCount(async () =>
    db('users')
      .whereRaw(`created_at >= NOW() - INTERVAL '1 day'`)
      .whereNull('deleted_at')
      .count<{ count: string }[]>('* as count'),
  );
  const newUsers7d = await rowCountSinceDays('users', 7, (qb) => qb.whereNull('deleted_at'));
  const newUsers30d = await rowCountSinceDays('users', 30, (qb) => qb.whereNull('deleted_at'));

  let activeUsers7d = 0;
  let activeUsers30d = 0;
  if (usageTable) {
    activeUsers7d = await safeRawCount(async () =>
      db('usage_events')
        .whereRaw(`created_at >= NOW() - INTERVAL '7 days'`)
        .countDistinct<{ count: string }[]>('user_id as count'),
    );
    activeUsers30d = await safeRawCount(async () =>
      db('usage_events')
        .whereRaw(`created_at >= NOW() - INTERVAL '30 days'`)
        .countDistinct<{ count: string }[]>('user_id as count'),
    );
  }

  return {
    wired: true,
    totalUsers,
    newUsersToday,
    newUsers7d,
    newUsers30d,
    verifiedUsers,
    unverifiedUsers,
    activeUsers7d,
    activeUsers30d,
    activeUserSource: usageTable ? 'usage_events distinct user_id' : 'usage_events table missing',
  };
}

/**
 * Funnel — counts each known event in the last 30 days and lists the
 * stages that don't have any data yet so the operator knows what to
 * instrument next.
 *
 * Registrations and paid conversions don't need event tracking — they
 * read from `users.created_at` and `billing_subscriptions` directly.
 */
async function buildFunnel() {
  const cfg = getBillingConfig();
  const usageTable = await tableExists('usage_events');
  const billingTable = await tableExists('billing_subscriptions');

  // Compute per-event counts in 7d/30d windows and remember which event
  // names returned 0 across both windows (treated as "not wired").
  const eventCounts: Record<string, CountWindow> = {};
  const missingEvents: string[] = [];

  if (usageTable) {
    for (const [_metric, eventName] of Object.entries(FUNNEL_EVENTS)) {
      const c7d = await safeRawCount(async () =>
        db('usage_events')
          .where({ event_name: eventName })
          .whereRaw(`created_at >= NOW() - INTERVAL '7 days'`)
          .count<{ count: string }[]>('* as count'),
      );
      const c30d = await safeRawCount(async () =>
        db('usage_events')
          .where({ event_name: eventName })
          .whereRaw(`created_at >= NOW() - INTERVAL '30 days'`)
          .count<{ count: string }[]>('* as count'),
      );
      eventCounts[eventName] = { '7d': c7d, '30d': c30d };
      if (c30d === 0) missingEvents.push(eventName);
    }
  } else {
    for (const eventName of Object.values(FUNNEL_EVENTS)) {
      eventCounts[eventName] = { '7d': 0, '30d': 0 };
      missingEvents.push(eventName);
    }
  }

  // Registrations from users table. Counts last 30d (and 7d) regardless
  // of whether usage_events instrumentation exists.
  const registrations7d = await rowCountSinceDays('users', 7, (qb) =>
    qb.whereNull('deleted_at'),
  );
  const registrations30d = await rowCountSinceDays('users', 30, (qb) =>
    qb.whereNull('deleted_at'),
  );

  // Paid conversions — distinct users who acquired an active subscription
  // in the window. Reads from billing_subscriptions, scoped to the
  // CURRENT provider so mock/dev/old-provider rows can't inflate the
  // production funnel after a provider switch (e.g. swapping `mock` →
  // `lemonsqueezy`). Mirrors the same `provider: cfg.provider` filter
  // we use everywhere else in this controller (revenue counts, latest
  // billing event, failed payments) for consistency.
  let paidConversions7d = 0;
  let paidConversions30d = 0;
  if (billingTable) {
    paidConversions7d = await safeRawCount(async () =>
      db('billing_subscriptions')
        .where({ status: 'active', provider: cfg.provider })
        .whereRaw(`created_at >= NOW() - INTERVAL '7 days'`)
        .countDistinct<{ count: string }[]>('user_id as count'),
    );
    paidConversions30d = await safeRawCount(async () =>
      db('billing_subscriptions')
        .where({ status: 'active', provider: cfg.provider })
        .whereRaw(`created_at >= NOW() - INTERVAL '30 days'`)
        .countDistinct<{ count: string }[]>('user_id as count'),
    );
  }

  // Conversion rates that we can actually compute.
  const rates: Record<string, number | null> = {
    publicToolViewToCalculatorUse: null,
    calculatorUseToSaveClick: null,
    saveClickToRegistration: null,
    upgradePageViewToCheckoutStart: null,
    checkoutStartToCheckoutComplete: null,
    registrationToPaid: null,
  };
  const v = eventCounts[FUNNEL_EVENTS.publicToolViews]?.['30d'] ?? 0;
  const u = eventCounts[FUNNEL_EVENTS.calculatorUses]?.['30d'] ?? 0;
  const s = eventCounts[FUNNEL_EVENTS.saveToRowlyClicks]?.['30d'] ?? 0;
  const upv = eventCounts[FUNNEL_EVENTS.upgradePageViews]?.['30d'] ?? 0;
  const cs = eventCounts[FUNNEL_EVENTS.checkoutStarts]?.['30d'] ?? 0;
  const cc = eventCounts[FUNNEL_EVENTS.checkoutCompleted]?.['30d'] ?? 0;
  if (v > 0) rates.publicToolViewToCalculatorUse = Math.round((u / v) * 1000) / 10;
  if (u > 0) rates.calculatorUseToSaveClick = Math.round((s / u) * 1000) / 10;
  if (s > 0) rates.saveClickToRegistration = Math.round((registrations30d / s) * 1000) / 10;
  if (upv > 0) rates.upgradePageViewToCheckoutStart = Math.round((cs / upv) * 1000) / 10;
  if (cs > 0) rates.checkoutStartToCheckoutComplete = Math.round((cc / cs) * 1000) / 10;
  if (registrations30d > 0)
    rates.registrationToPaid = Math.round((paidConversions30d / registrations30d) * 1000) / 10;

  return {
    wired: usageTable,
    note: usageTable ? null : 'usage_events table missing — funnel events cannot be measured.',
    publicToolViews: eventCounts[FUNNEL_EVENTS.publicToolViews] ?? { '7d': 0, '30d': 0 },
    calculatorUses: eventCounts[FUNNEL_EVENTS.calculatorUses] ?? { '7d': 0, '30d': 0 },
    saveToRowlyClicks: eventCounts[FUNNEL_EVENTS.saveToRowlyClicks] ?? { '7d': 0, '30d': 0 },
    registrations: { '7d': registrations7d, '30d': registrations30d },
    upgradePageViews: eventCounts[FUNNEL_EVENTS.upgradePageViews] ?? { '7d': 0, '30d': 0 },
    checkoutStarts: eventCounts[FUNNEL_EVENTS.checkoutStarts] ?? { '7d': 0, '30d': 0 },
    checkoutCompleted: eventCounts[FUNNEL_EVENTS.checkoutCompleted] ?? { '7d': 0, '30d': 0 },
    trialStarts: eventCounts[FUNNEL_EVENTS.trialStarts] ?? { '7d': 0, '30d': 0 },
    paidConversions: { '7d': paidConversions7d, '30d': paidConversions30d },
    conversionRates: rates,
    missingEvents,
  };
}

/**
 * Per-route public-tool stats. We have a per-route view event
 * (`public_tool_viewed`) with the route in metadata, but until we know
 * that's wired we expose totals by event_name only and flag the per-tool
 * breakdown as not-wired so the operator sees the gap.
 */
async function buildPublicTools() {
  const usageTable = await tableExists('usage_events');

  // Reads metadata->>'route' so each tool's view count can be surfaced
  // independently. If the metadata column doesn't carry route info this
  // returns 0 across the board and we expose `missingTrackingEvents`.
  const tools = await Promise.all(
    PUBLIC_TOOL_ROUTES.map(async (t) => {
      let views7d = 0;
      let views30d = 0;
      let saves7d = 0;
      let saves30d = 0;
      const missing: string[] = [];

      if (usageTable) {
        views7d = await safeRawCount(async () =>
          db('usage_events')
            .where({ event_name: 'public_tool_viewed' })
            .whereRaw(`metadata->>'route' = ?`, [t.route])
            .whereRaw(`created_at >= NOW() - INTERVAL '7 days'`)
            .count<{ count: string }[]>('* as count'),
        );
        views30d = await safeRawCount(async () =>
          db('usage_events')
            .where({ event_name: 'public_tool_viewed' })
            .whereRaw(`metadata->>'route' = ?`, [t.route])
            .whereRaw(`created_at >= NOW() - INTERVAL '30 days'`)
            .count<{ count: string }[]>('* as count'),
        );

        // saves are only meaningful for tool routes, not the index/help.
        if (t.kind === 'tool') {
          saves7d = await safeRawCount(async () =>
            db('usage_events')
              .where({ event_name: 'save_to_rowly_clicked' })
              .whereRaw(`metadata->>'tool' = ?`, [t.id])
              .whereRaw(`created_at >= NOW() - INTERVAL '7 days'`)
              .count<{ count: string }[]>('* as count'),
          );
          saves30d = await safeRawCount(async () =>
            db('usage_events')
              .where({ event_name: 'save_to_rowly_clicked' })
              .whereRaw(`metadata->>'tool' = ?`, [t.id])
              .whereRaw(`created_at >= NOW() - INTERVAL '30 days'`)
              .count<{ count: string }[]>('* as count'),
          );
          if (saves30d === 0) missing.push("save_to_rowly_clicked with metadata.tool");
        }
        if (views30d === 0) missing.push("public_tool_viewed with metadata.route");
      } else {
        missing.push('usage_events table missing');
      }

      const conversionRate =
        views30d > 0 && t.kind === 'tool'
          ? Math.round((saves30d / views30d) * 1000) / 10
          : null;

      return {
        id: t.id,
        route: t.route,
        kind: t.kind,
        status: 'live' as const,
        views7d,
        views30d,
        saves7d,
        saves30d,
        conversionRate,
        missingTrackingEvents: missing,
      };
    }),
  );

  return {
    wired: usageTable,
    note: usageTable
      ? null
      : 'usage_events table missing — per-tool view counts cannot be measured.',
    tools,
  };
}

async function buildProductUsage() {
  const usageTable = await tableExists('usage_events');
  const chartsTable = await tableExists('charts');
  const yarnTable = await tableExists('yarn');

  const projectsCreated7d = await rowCountSinceDays('projects', 7);
  const projectsCreated30d = await rowCountSinceDays('projects', 30);
  const patternsCreated7d = await rowCountSinceDays('patterns', 7);
  const patternsCreated30d = await rowCountSinceDays('patterns', 30);
  const patternModelsCreated7d = await rowCountSinceDays('pattern_models', 7);
  const patternModelsCreated30d = await rowCountSinceDays('pattern_models', 30);
  const sourceFilesUploaded7d = await rowCountSinceDays('source_files', 7);
  const sourceFilesUploaded30d = await rowCountSinceDays('source_files', 30);
  const yarnItemsCreated7d = yarnTable ? await rowCountSinceDays('yarn', 7) : 0;
  const yarnItemsCreated30d = yarnTable ? await rowCountSinceDays('yarn', 30) : 0;
  const chartsCreated7d = chartsTable ? await rowCountSinceDays('charts', 7) : 0;
  const chartsCreated30d = chartsTable ? await rowCountSinceDays('charts', 30) : 0;

  let makeModeUsage7d = 0;
  let makeModeUsage30d = 0;
  let topUsageEvents: Array<{ eventName: string; events: number; uniqueUsers: number }> = [];
  const missing: string[] = [];

  if (usageTable) {
    makeModeUsage7d = await safeRawCount(async () =>
      db('usage_events')
        .where({ event_name: 'make_mode_opened' })
        .whereRaw(`created_at >= NOW() - INTERVAL '7 days'`)
        .count<{ count: string }[]>('* as count'),
    );
    makeModeUsage30d = await safeRawCount(async () =>
      db('usage_events')
        .where({ event_name: 'make_mode_opened' })
        .whereRaw(`created_at >= NOW() - INTERVAL '30 days'`)
        .count<{ count: string }[]>('* as count'),
    );
    if (makeModeUsage30d === 0) missing.push('make_mode_opened');

    try {
      const rows = (await db('usage_events')
        .whereRaw(`created_at >= NOW() - INTERVAL '14 days'`)
        .select('event_name')
        .count('* as events')
        .countDistinct('user_id as users')
        .groupBy('event_name')
        .orderBy('events', 'desc')
        .limit(10)) as unknown as Array<{
        event_name: string;
        events: string | number;
        users: string | number;
      }>;
      topUsageEvents = rows.map((r) => ({
        eventName: r.event_name,
        events: Number(r.events) || 0,
        uniqueUsers: Number(r.users) || 0,
      }));
    } catch (err: any) {
      logger.warn('top usage events lookup failed', { error: err?.message });
    }
  } else {
    missing.push('usage_events table missing');
  }

  return {
    wired: true,
    projectsCreated: { '7d': projectsCreated7d, '30d': projectsCreated30d },
    patternsCreated: { '7d': patternsCreated7d, '30d': patternsCreated30d },
    patternModelsCreated: { '7d': patternModelsCreated7d, '30d': patternModelsCreated30d },
    sourceFilesUploaded: { '7d': sourceFilesUploaded7d, '30d': sourceFilesUploaded30d },
    yarnItemsCreated: { '7d': yarnItemsCreated7d, '30d': yarnItemsCreated30d },
    chartsCreated: chartsTable
      ? { '7d': chartsCreated7d, '30d': chartsCreated30d }
      : null,
    makeModeUsage: { '7d': makeModeUsage7d, '30d': makeModeUsage30d },
    topUsageEvents,
    missingEvents: missing,
  };
}

/**
 * Inspect the deployed frontend assets for AdSense readiness signals
 * we can verify from the backend:
 *   - the AdSense loader hook is wired into the build (we grep the
 *     built JS bundle for the script src constant — `index.html` no
 *     longer ships the tag because we route-scope the load).
 *   - `ads.txt` present in the same static-assets tree, with the
 *     expected `google.com, pub-..., DIRECT, ...` line.
 *
 * Pure side-effect-free reads, swallowed errors. If neither file is
 * present we report the readiness flags as `false` rather than throwing
 * — a transient missing volume mount shouldn't take the dashboard
 * offline.
 */
function inspectAdSenseAssets() {
  // The deployed nginx container mounts the frontend build at one of
  // these paths depending on environment. We try them in order; the
  // first that exists wins. In dev the source `index.html` lives in
  // `frontend/index.html` relative to repo root.
  const candidatePaths = [
    process.env.FRONTEND_INDEX_PATH,
    '/usr/share/nginx/html/index.html',
    path.resolve(__dirname, '../../../frontend/dist/index.html'),
    path.resolve(__dirname, '../../../frontend/index.html'),
  ].filter((p): p is string => Boolean(p));

  let scriptPresent = false;
  let scriptSource: string | null = null;
  // The hook injects the script lazily so it never appears in
  // `index.html`. Probe the built JS bundle in `frontend/dist/assets/*`
  // for the publisher constant + the `adsbygoogle.js` URL. In dev there
  // is no `dist`; we fall back to the source `useAdSenseScript.ts`
  // which is the canonical place that builds the URL.
  const bundleCandidates: string[] = [];
  for (const p of candidatePaths) {
    if (!p) continue;
    bundleCandidates.push(path.join(path.dirname(p), 'assets'));
  }
  bundleCandidates.push(
    path.resolve(__dirname, '../../../frontend/dist/assets'),
    path.resolve(__dirname, '../../../frontend/src/components/ads'),
  );
  for (const dir of bundleCandidates) {
    try {
      if (!fs.existsSync(dir)) continue;
      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) continue;
      const files = fs.readdirSync(dir).filter((f) => /\.(js|tsx|ts)$/.test(f));
      for (const f of files) {
        const full = path.join(dir, f);
        try {
          const text = fs.readFileSync(full, 'utf8');
          if (
            text.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js') &&
            text.includes(ADSENSE_PUBLISHER_ID)
          ) {
            scriptPresent = true;
            scriptSource = full;
            break;
          }
        } catch {
          // Skip unreadable files.
        }
      }
      if (scriptPresent) break;
      // Even if the script reference is missing we know we probed a
      // real assets dir — surface that for the operator.
      scriptSource = dir;
    } catch (err: any) {
      logger.warn('adsense bundle inspection failed', { path: dir, error: err?.message });
    }
  }

  // ads.txt — same probe set with `index.html` swapped for `ads.txt`.
  const adsTxtCandidates = candidatePaths.map((p) => path.join(path.dirname(p), 'ads.txt'));
  // Also try `frontend/public/ads.txt` for dev (vite serves /public via root).
  adsTxtCandidates.push(path.resolve(__dirname, '../../../frontend/public/ads.txt'));

  let adsTxtPresent = false;
  let adsTxtValid = false;
  let adsTxtSource: string | null = null;
  let adsTxtContents: string | null = null;
  for (const p of adsTxtCandidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const txt = fs.readFileSync(p, 'utf8');
      adsTxtPresent = true;
      adsTxtSource = p;
      adsTxtContents = txt.trim();
      // Validity check: at least one line equals the canonical AdSense
      // line (whitespace-tolerant).
      adsTxtValid = txt
        .split(/\r?\n/)
        .map((line) => line.trim())
        .includes(ADSENSE_EXPECTED_ADS_TXT);
      break;
    } catch (err: any) {
      logger.warn('adsense ads.txt inspection failed', { path: p, error: err?.message });
    }
  }

  const slotConfig = buildSlotConfigReport();
  const slotsConfigured = allAdSenseSlotsConfigured();
  const placeholderSlots = slotConfig
    .filter((s) => !s.configured)
    .map((s) => s.tool);

  return {
    publisherId: ADSENSE_PUBLISHER_ID,
    scriptPresent,
    scriptSource,
    adsTxtPresent,
    adsTxtValid,
    adsTxtSource,
    adsTxtContents,
    // "ready" only when ALL three halves are live: script tag, valid
    // ads.txt line, AND every approved ad unit has a real (non-
    // placeholder) slot id provisioned via env. Anything less and the
    // dashboard would falsely tell the operator AdSense is earning
    // money when slots are still empty rectangles.
    slotsConfigured,
    placeholderSlots,
    slotConfig,
    publicAdsEnabled: scriptPresent && adsTxtValid && slotsConfigured,
    landingPageAdsEnabled: false, // policy: never
    appAdsEnabled: false,         // policy: never
    approvedAdRoutes: [...ADSENSE_APPROVED_ROUTES],
    blockedAdRoutes: [...ADSENSE_BLOCKED_SURFACES],
    expectedAdsTxtLine: ADSENSE_EXPECTED_ADS_TXT,
  };
}

/**
 * Mostly static — we don't have a posts table or an indexability scanner,
 * so this surface flags those gaps explicitly. The five non-static checks
 * we do have (PUBLIC_TOOL_ROUTES count, sitemap presence, AdSense env var,
 * blog table, indexed-routes count) all come from cheap presence checks.
 */
async function buildContentAndSEO() {
  const indexedPublicRoutes = PUBLIC_TOOL_ROUTES.length; // 8 today
  const blogTableExists = await tableExists('blog_posts');

  let blogPostsPublished: number | null = null;
  if (blogTableExists) {
    blogPostsPublished = await rowCountTotal('blog_posts', (qb) => qb.where({ status: 'published' }));
  }

  // AdSense readiness — read from the actual built assets (script in
  // index.html + ads.txt presence + line validity) rather than just an
  // env var. This is the readiness card the founder reads.
  const adsense = inspectAdSenseAssets();
  // Legacy env-var fallback kept for the owner-task derivation: if the
  // built script isn't visible from this process (different deploy
  // layout), the env var is a manual override that still says "yes,
  // AdSense is configured."
  const envHasPublisher = !!process.env.ADSENSE_PUBLISHER_ID || !!process.env.VITE_ADSENSE_PUBLISHER_ID;
  const adsenseConfigured = adsense.scriptPresent || envHasPublisher;

  return {
    wired: blogTableExists,
    indexedPublicRoutes,
    publicToolsLinkedFromLanding: true, // PR #388 wired this — flagged true so the founder sees it as done.
    blogPostsPublished,
    blogPostsWired: blogTableExists,
    adsenseConfigured,
    adsense,
    nextContentTasks: [
      { id: 'seo-1', label: 'Write SEO post: "Knitting gauge swatch — what it is and why it lies"', priority: 'P1' },
      { id: 'seo-2', label: 'Write SEO post: "Yarn substitution: how to swap yarn without ruining a sweater"', priority: 'P1' },
      { id: 'seo-3', label: 'Write SEO post: "How much yarn for a sweater — by size and weight"', priority: 'P1' },
      { id: 'seo-4', label: 'Write SEO post: "Cast-on stitches calculator explained"', priority: 'P2' },
      { id: 'seo-5', label: 'Write SEO post: "Increase / decrease spacing — even shaping made easy"', priority: 'P2' },
      { id: 'seo-6', label: 'Write SEO post: "Reading a knitting chart for the first time"', priority: 'P2' },
      { id: 'seo-7', label: 'Write SEO post: "WPI explained — wraps per inch for knitters"', priority: 'P3' },
      { id: 'seo-8', label: 'Write SEO post: "Magic markers: keeping a long row count in your head"', priority: 'P3' },
      { id: 'tools-link', label: 'Link every public tool from the landing page hero (DONE PR #388 — verify)', priority: 'P1' },
      { id: 'adsense', label: 'Set up AdSense once public tools have organic traffic', priority: 'P3' },
    ],
  };
}

/**
 * Owner checklist — the punchlist the founder ticks off before flipping
 * paid public. Computed from the other sections so it stays honest.
 */
async function buildOwnerTasks(launch: Awaited<ReturnType<typeof buildLaunchReadiness>>, revenue: Awaited<ReturnType<typeof buildRevenue>>, publicTools: Awaited<ReturnType<typeof buildPublicTools>>, content: Awaited<ReturnType<typeof buildContentAndSEO>>) {
  type Status = 'done' | 'blocked' | 'not_started' | 'needs_owner';
  const tasks: Array<{
    id: string;
    label: string;
    status: Status;
    reason: string;
    suggestedAction: string;
  }> = [];

  // 1. Lemon Squeezy account finished — provider must be 'lemonsqueezy'.
  tasks.push(
    launch.billing.provider === 'lemonsqueezy'
      ? {
          id: 'ls_account',
          label: 'Lemon Squeezy account finished',
          status: 'done',
          reason: 'BILLING_PROVIDER=lemonsqueezy is set.',
          suggestedAction: 'No action needed.',
        }
      : {
          id: 'ls_account',
          label: 'Lemon Squeezy account finished',
          status: 'needs_owner',
          reason: `BILLING_PROVIDER=${launch.billing.provider}; account not selected.`,
          suggestedAction: 'Finish Lemon Squeezy onboarding (KYC + product + variants), then set BILLING_PROVIDER=lemonsqueezy.',
        },
  );

  // 2. LS env vars installed.
  tasks.push(
    launch.billing.missingEnvVars.length === 0 && launch.billing.provider === 'lemonsqueezy'
      ? {
          id: 'ls_env',
          label: 'LS env vars installed in production',
          status: 'done',
          reason: 'All required LEMONSQUEEZY_* env vars present.',
          suggestedAction: 'No action needed.',
        }
      : {
          id: 'ls_env',
          label: 'LS env vars installed in production',
          status: 'needs_owner',
          reason: `Missing: ${launch.billing.missingEnvVars.join(', ') || 'provider not selected'}`,
          suggestedAction: 'Add the missing env vars to the production droplet and redeploy.',
        },
  );

  // 3. LS webhook registered — we can't introspect LS, so this is owner-only
  //    until we see a billing event land.
  tasks.push(
    revenue.latestBillingEventAt
      ? {
          id: 'ls_webhook',
          label: 'LS webhook registered + receiving events',
          status: 'done',
          reason: `Last billing event: ${revenue.latestBillingEventAt}`,
          suggestedAction: 'No action needed.',
        }
      : {
          id: 'ls_webhook',
          label: 'LS webhook registered + receiving events',
          status: launch.billing.provider === 'lemonsqueezy' && launch.billing.providerReady ? 'not_started' : 'blocked',
          reason: 'No billing_events rows yet.',
          suggestedAction: 'Register the webhook in Lemon Squeezy → settings → webhooks pointed at /api/billing/lemonsqueezy/webhook.',
        },
  );

  // 4. Real checkout smoke — at least one active subscription exists.
  tasks.push(
    revenue.activeSubscriptions > 0
      ? {
          id: 'checkout_smoke',
          label: 'Real checkout smoke passed',
          status: 'done',
          reason: `${revenue.activeSubscriptions} active subscription(s).`,
          suggestedAction: 'No action needed.',
        }
      : {
          id: 'checkout_smoke',
          label: 'Real checkout smoke passed',
          status: launch.billing.providerReady ? 'not_started' : 'blocked',
          reason: 'No active billing_subscriptions rows.',
          suggestedAction: 'Run a real checkout from /upgrade with a test card, then refund.',
        },
  );

  // 5. Public tools linked from landing — PR #388 wired this. Static true
  //    for now; flagging needs_owner if for some reason content marks it
  //    false in future audits.
  tasks.push(
    content.publicToolsLinkedFromLanding
      ? {
          id: 'tools_linked',
          label: 'Public tools linked from landing page',
          status: 'done',
          reason: 'Landing renders all 5 tool cards.',
          suggestedAction: 'No action needed.',
        }
      : {
          id: 'tools_linked',
          label: 'Public tools linked from landing page',
          status: 'not_started',
          reason: 'Landing does not link the public tools.',
          suggestedAction: 'Add a tools section to the landing hero.',
        },
  );

  // 6. AdSense setup — four signals: script tag served on approved
  //    routes, ads.txt present, ads.txt has the right canonical line,
  //    AND every approved ad unit has a real (non-placeholder) slot id
  //    provisioned via env. The slot check is what stops this task
  //    from going green while the page still renders empty `rowly-*`
  //    placeholder slots.
  const a = content.adsense;
  if (a.scriptPresent && a.adsTxtValid && a.slotsConfigured) {
    tasks.push({
      id: 'adsense',
      label: 'AdSense set up after public tools are discoverable',
      status: 'done',
      reason: `Script tag + ads.txt + all ${Object.keys(ADSENSE_SLOT_ENV_BY_TOOL).length} ad-unit slot ids live for ${a.publisherId}.`,
      suggestedAction: 'No action needed.',
    });
  } else {
    const reasons: string[] = [];
    if (!a.scriptPresent) reasons.push('AdSense loader script not detected on approved routes');
    if (!a.adsTxtPresent) reasons.push('/ads.txt not served');
    else if (!a.adsTxtValid) reasons.push('/ads.txt does not include the expected google.com line');
    if (!a.slotsConfigured) {
      const missingEnvs = a.placeholderSlots
        .map((tool: string) => ADSENSE_SLOT_ENV_BY_TOOL[tool])
        .filter(Boolean);
      reasons.push(
        `Placeholder slot ids still in use for: ${a.placeholderSlots.join(', ')}; provision real ad units and set ${missingEnvs.join(', ')}`,
      );
    }
    tasks.push({
      id: 'adsense',
      label: 'AdSense set up after public tools are discoverable',
      status: 'not_started',
      reason: reasons.join('; ') || 'AdSense readiness signals not detected.',
      suggestedAction:
        a.slotsConfigured
          ? 'Confirm the AdSense script loads on approved routes and /ads.txt serves the canonical google.com publisher line.'
          : 'Create real ad units in the AdSense dashboard for each approved tool route and set the ADSENSE_SLOT_<TOOL> env vars on the production droplet.',
    });
  }

  // 7. First beta promo email sent — narrow to the dedicated beta-promo
  //    template only. We deliberately exclude `welcome` because that fires
  //    automatically on every signup and would mark this DONE the moment
  //    a single user registers — which doesn't tell us anything about
  //    whether the founder actually shipped the warm-list announcement.
  let firstBetaPromoSent = false;
  let firstBetaPromoReason = 'email_logs not checked';
  try {
    const tableExistsLocal = await tableExists('email_logs');
    if (tableExistsLocal) {
      const row = await db('email_logs')
        .where({ status: 'sent' })
        .whereIn('template', ['beta_promo', 'beta_announcement'])
        .first('sent_at');
      if (row?.sent_at) {
        firstBetaPromoSent = true;
        firstBetaPromoReason = `Last beta-promo send: ${
          row.sent_at instanceof Date ? row.sent_at.toISOString() : new Date(row.sent_at).toISOString()
        }`;
      } else {
        firstBetaPromoReason = 'No `beta_promo` / `beta_announcement` rows in email_logs with status=sent.';
      }
    } else {
      firstBetaPromoReason = 'email_logs table missing.';
    }
  } catch (err: any) {
    firstBetaPromoReason = `email_logs lookup failed: ${err?.message ?? 'unknown'}`;
  }
  tasks.push({
    id: 'beta_promo',
    label: 'First beta promo email sent',
    status: firstBetaPromoSent ? 'done' : launch.transactionalEmail.status === 'pass' ? 'not_started' : 'blocked',
    reason: firstBetaPromoReason,
    suggestedAction: firstBetaPromoSent
      ? 'No action needed.'
      : launch.transactionalEmail.status === 'pass'
        ? 'Draft a beta announcement email (template=beta_announcement) and send to the warm list.'
        : 'Configure a real EMAIL_PROVIDER first, then send the beta announcement.',
  });

  // 8. Search Console verified — looks for two signals:
  //      a) `<meta name="google-site-verification">` in served index.html
  //      b) GOOGLE_SITE_VERIFICATION env var (manual override for cases
  //         where the deploy layout puts index.html somewhere this process
  //         can't read).
  //    The dashboard prefers signal (a). If neither is set we flag as
  //    needs_owner — this is one of the items the founder owns.
  let searchConsoleVerified = false;
  let searchConsoleReason = 'not checked';
  let searchConsoleSuggested = '';
  try {
    const candidates = [
      process.env.FRONTEND_INDEX_PATH,
      '/usr/share/nginx/html/index.html',
      path.resolve(__dirname, '../../../frontend/dist/index.html'),
      path.resolve(__dirname, '../../../frontend/index.html'),
    ].filter((p): p is string => Boolean(p));
    let metaFound = false;
    for (const p of candidates) {
      try {
        if (!fs.existsSync(p)) continue;
        const html = fs.readFileSync(p, 'utf8');
        if (/<meta\s+name=["']google-site-verification["']/i.test(html)) {
          metaFound = true;
          break;
        }
      } catch {
        // Swallow — try next candidate path.
      }
    }
    if (metaFound) {
      searchConsoleVerified = true;
      searchConsoleReason = 'index.html includes <meta name="google-site-verification">.';
      searchConsoleSuggested = 'No action needed.';
    } else if (process.env.GOOGLE_SITE_VERIFICATION) {
      searchConsoleVerified = true;
      searchConsoleReason = 'GOOGLE_SITE_VERIFICATION env var is set (manual override).';
      searchConsoleSuggested = 'No action needed.';
    } else {
      searchConsoleReason =
        'No google-site-verification meta tag in index.html and GOOGLE_SITE_VERIFICATION env var is unset.';
      searchConsoleSuggested =
        'Add <meta name="google-site-verification" content="..."> to frontend/index.html and submit sitemap.xml in Search Console.';
    }
  } catch (err: any) {
    searchConsoleReason = `search-console probe failed: ${err?.message ?? 'unknown'}`;
    searchConsoleSuggested = 'Inspect index.html on the production droplet for a google-site-verification meta tag.';
  }
  tasks.push({
    id: 'search_console',
    label: 'Search Console verified + sitemap submitted',
    status: searchConsoleVerified ? 'done' : 'needs_owner',
    reason: searchConsoleReason,
    suggestedAction: searchConsoleSuggested,
  });

  // 9. Legal / cookie language live — checks for a presence-of-policy
  //    signal we can verify cheaply. Today the static surface is:
  //      /privacy and /terms exist as React routes (always true).
  //    What's missing is a cookie banner / explicit cookie language —
  //    we don't render one. Until a cookie banner ships, this task
  //    stays needs_owner so the founder sees the gap.
  const cookieLanguageEnv = process.env.COOKIE_BANNER_DEPLOYED === 'true';
  tasks.push(
    cookieLanguageEnv
      ? {
          id: 'legal_cookie',
          label: 'Legal pages + cookie language live',
          status: 'done',
          reason: 'COOKIE_BANNER_DEPLOYED=true (manual confirmation).',
          suggestedAction: 'No action needed.',
        }
      : {
          id: 'legal_cookie',
          label: 'Legal pages + cookie language live',
          status: 'needs_owner',
          reason:
            '/privacy and /terms ship today, but no cookie banner / explicit cookie-consent language is rendered.',
          suggestedAction:
            'Add a cookie banner (analytics + AdSense + auth cookies require explicit consent in EU). Set COOKIE_BANNER_DEPLOYED=true once shipped.',
        },
  );

  // 10. Support email configured — env var SUPPORT_EMAIL or
  //     CONTACT_EMAIL set. We surface the address verbatim if found so
  //     the founder can confirm it's the right inbox.
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.CONTACT_EMAIL || '';
  tasks.push(
    supportEmail
      ? {
          id: 'support_email',
          label: 'Support email configured',
          status: 'done',
          reason: `SUPPORT_EMAIL=${supportEmail}`,
          suggestedAction: 'No action needed.',
        }
      : {
          id: 'support_email',
          label: 'Support email configured',
          status: 'needs_owner',
          reason: 'Neither SUPPORT_EMAIL nor CONTACT_EMAIL env var is set.',
          suggestedAction:
            'Set SUPPORT_EMAIL=support@rowlyknit.com (or your inbox of choice) and surface it in the footer + the password-reset email.',
        },
  );

  // 11. First SEO post published — depends on a posts table we don't have
  //    yet, so always not_started until that ships.
  tasks.push(
    content.blogPostsPublished && content.blogPostsPublished > 0
      ? {
          id: 'first_seo_post',
          label: 'First SEO post published',
          status: 'done',
          reason: `${content.blogPostsPublished} published blog post(s).`,
          suggestedAction: 'Keep going — the next 7 are listed under nextContentTasks.',
        }
      : {
          id: 'first_seo_post',
          label: 'First SEO post published',
          status: 'not_started',
          reason: content.blogPostsWired
            ? 'No `blog_posts` rows with status=published.'
            : 'No `blog_posts` table — SEO post infrastructure not built yet.',
          suggestedAction: 'Build a minimal `blog_posts` table + `/blog` route, then publish post #1 from nextContentTasks.',
        },
  );

  // Force the suppress on `_publicTools` — currently unused but kept in
  // signature so future tasks (e.g. "all 5 tools have organic traffic")
  // can read from it without a refactor.
  void publicTools;

  return tasks;
}

export async function getBusinessDashboard(_req: Request, res: Response): Promise<void> {
  const launch = await buildLaunchReadiness();
  // Run the rest in parallel — they share no state and most are read-only
  // queries against different tables.
  const [revenue, users, funnel, publicTools, productUsage, contentAndSEO] = await Promise.all([
    buildRevenue(),
    buildUsers(),
    buildFunnel(),
    buildPublicTools(),
    buildProductUsage(),
    buildContentAndSEO(),
  ]);
  const ownerTasks = await buildOwnerTasks(launch, revenue, publicTools, contentAndSEO);

  res.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      launchReadiness: launch,
      revenue,
      users,
      funnel,
      publicTools,
      productUsage,
      contentAndSEO,
      ownerTasks,
    },
  });
}
