import { Request, Response } from 'express';
import logger from '../config/logger';
import db from '../config/database';
import { getBillingConfig } from '../config/billing';
import { getBillingService } from '../services/billing';
import { canUsePaidWorkspaceForReq } from '../utils/entitlement';
import { BillingPlan } from '../services/billing/types';

/**
 * Billing controller — exposes the surface the frontend needs to:
 *   - render entitlement state (`/api/billing/status`)
 *   - kick off a checkout (`/checkout/monthly` and `/checkout/annual`)
 *   - jump to the customer portal (`/portal`)
 *   - receive provider webhooks (`/lemonsqueezy/webhook`)
 *
 * Provider-not-ready posture: every authenticated route returns 503
 * with `error: 'BILLING_NOT_AVAILABLE'` when the provider isn't
 * configured. Webhook returns 503 too — Lemon Squeezy retries on
 * 5xx, which is fine because nothing was processed.
 */

function billingNotAvailable(res: Response, missing: string[] = []): void {
  res.status(503).json({
    success: false,
    message: 'Billing is not yet available — Lemon Squeezy has not been provisioned.',
    error: 'BILLING_NOT_AVAILABLE',
    missing,
  });
}

/**
 * GET /api/billing/status
 *
 * Auth required. Returns:
 *   {
 *     success: true,
 *     data: {
 *       provider: 'lemonsqueezy' | 'mock' | 'none',
 *       providerReady: boolean,
 *       entitled: boolean,
 *       reason: EntitlementReason,
 *       plan?: 'monthly' | 'annual',
 *       status?: NormalizedStatus,
 *       trialEndsAt?: ISO,
 *       renewsAt?: ISO,
 *       endsAt?: ISO,
 *       customerPortalUrl?: string,
 *     }
 *   }
 */
export async function getStatus(req: Request, res: Response): Promise<void> {
  const cfg = getBillingConfig();
  const result = await canUsePaidWorkspaceForReq(req);

  // If the user has a billing row, surface the portal URL too.
  let customerPortalUrl: string | null = null;
  const userId = req.user?.userId;
  if (userId) {
    const sub = await db('billing_subscriptions')
      .where({ user_id: userId })
      .orderBy('updated_at', 'desc')
      .first('customer_portal_url');
    customerPortalUrl = sub?.customer_portal_url ?? null;
  }

  res.json({
    success: true,
    data: {
      provider: cfg.provider,
      providerReady: cfg.ready,
      preLaunchOpen: cfg.preLaunchOpen,
      entitled: result.allowed,
      reason: result.reason,
      plan: result.subscription?.plan ?? null,
      status: result.subscription?.status ?? null,
      trialEndsAt: result.subscription?.trialEndsAt ?? null,
      renewsAt: result.subscription?.renewsAt ?? null,
      endsAt: result.subscription?.endsAt ?? null,
      customerPortalUrl,
    },
  });
}

async function startCheckout(plan: BillingPlan, req: Request, res: Response): Promise<void> {
  const cfg = getBillingConfig();
  if (!cfg.ready) {
    billingNotAvailable(
      res,
      'missing' in cfg ? cfg.missing : [],
    );
    return;
  }

  const service = getBillingService();
  if (!service) {
    billingNotAvailable(res);
    return;
  }

  const userId = req.user!.userId;
  // We need the email — JWT carries it but defensive re-fetch.
  const userRow = await db('users').where({ id: userId }).first('email');
  if (!userRow?.email) {
    res.status(400).json({
      success: false,
      message: 'User has no email on record',
      error: 'INVALID_USER',
    });
    return;
  }

  const redirectUrl = `${cfg.appUrl}/account/billing?checkout=success`;

  try {
    const checkout = await service.createCheckout({
      userId,
      userEmail: userRow.email,
      plan,
      redirectUrl,
    });

    res.json({
      success: true,
      data: {
        checkoutUrl: checkout.checkoutUrl,
        sessionId: checkout.sessionId ?? null,
        plan,
      },
    });
  } catch (err: any) {
    logger.error('Billing checkout creation failed', {
      userId,
      plan,
      error: err?.message,
    });
    res.status(502).json({
      success: false,
      message: 'Could not create checkout session',
      error: 'CHECKOUT_FAILED',
    });
  }
}

export async function checkoutMonthly(req: Request, res: Response): Promise<void> {
  return startCheckout('monthly', req, res);
}

export async function checkoutAnnual(req: Request, res: Response): Promise<void> {
  return startCheckout('annual', req, res);
}

/**
 * POST /api/billing/portal — return the most recent customer-portal
 * URL we've stored from a webhook payload. Provider doesn't expose a
 * "give me a portal URL for user X" endpoint we can call without
 * having a session, but every subscription event carries one.
 */
export async function portal(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const sub = await db('billing_subscriptions')
    .where({ user_id: userId })
    .orderBy('updated_at', 'desc')
    .first('customer_portal_url');

  if (!sub?.customer_portal_url) {
    res.status(404).json({
      success: false,
      message: 'No customer portal URL available — start a subscription first.',
      error: 'NO_PORTAL_URL',
    });
    return;
  }

  res.json({
    success: true,
    data: { portalUrl: sub.customer_portal_url },
  });
}

/**
 * POST /api/billing/lemonsqueezy/webhook
 *
 * Public route. Reads raw body, verifies signature, ingests event.
 * Always returns:
 *   - 200 on processed/duplicate (LS will not retry)
 *   - 401 on invalid signature
 *   - 503 when billing isn't configured
 *   - 500 only when the handler throws — LS will retry on 5xx
 */
export async function lemonSqueezyWebhook(req: Request, res: Response): Promise<void> {
  const cfg = getBillingConfig();
  if (cfg.provider !== 'lemonsqueezy' && cfg.provider !== 'mock') {
    billingNotAvailable(res);
    return;
  }
  const service = getBillingService();
  if (!service) {
    billingNotAvailable(res);
    return;
  }

  // The raw-body parser registered for this route guarantees `req.body`
  // is a Buffer. If a future refactor wires a different parser we want
  // to fail loudly rather than parse a half-decoded JSON.
  const rawBody = req.body as unknown;
  if (!Buffer.isBuffer(rawBody)) {
    logger.error('Webhook raw body parser missing — refusing to verify');
    res.status(500).json({
      success: false,
      message: 'Server misconfiguration',
      error: 'WEBHOOK_RAW_BODY_MISSING',
    });
    return;
  }

  const signature =
    (req.headers['x-signature'] as string | undefined) ??
    (req.headers['X-Signature'.toLowerCase()] as string | undefined);
  if (!service.verifyWebhook(rawBody, signature)) {
    logger.warn('Webhook signature invalid', { provider: service.providerName });
    res.status(401).json({
      success: false,
      message: 'Invalid signature',
      error: 'WEBHOOK_BAD_SIGNATURE',
    });
    return;
  }

  let parsed;
  try {
    parsed = service.parseWebhook(rawBody);
  } catch (err: any) {
    logger.error('Webhook payload could not be parsed', { error: err?.message });
    res.status(400).json({
      success: false,
      message: 'Bad webhook payload',
      error: 'WEBHOOK_BAD_PAYLOAD',
    });
    return;
  }

  try {
    const outcome = await service.ingestWebhookEvent(parsed);
    res.json({ success: true, data: { outcome, eventId: parsed.eventId } });
  } catch (err: any) {
    // Already logged + recorded inside the service. Return 500 so LS
    // retries — the unique-key constraint on `billing_events` makes
    // retries safe.
    res.status(500).json({
      success: false,
      message: 'Webhook handler failed',
      error: 'WEBHOOK_HANDLER_FAILED',
    });
  }
}
