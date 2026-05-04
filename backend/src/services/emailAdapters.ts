/**
 * Provider-agnostic transactional email adapters.
 *
 * Each adapter implements the same `send` shape so the rest of the
 * codebase (`emailService.ts`) talks to one tiny interface and the
 * provider choice is an env-driven detail.
 *
 * Design constraints:
 *   - This sprint adds a Resend HTTP adapter and a no-op adapter
 *     without disrupting the existing SMTP nodemailer paths
 *     (sendgrid / postmark / ses) — production already uses one of
 *     those and the migration path stays opt-in.
 *   - Adapters never read secrets from env directly; the factory does.
 *     That keeps the unit-testable surface small.
 *   - The no-op adapter logs ONLY non-secret metadata (to + subject +
 *     template). Bodies and reset URLs are excluded — accidentally
 *     logging a one-time password or a fresh reset link defeats the
 *     point of hashing them.
 *
 * What this is NOT: marketing email, list management, drip campaigns,
 * subscription billing, public utilities. Strictly transactional.
 */

import nodemailer, { Transporter } from 'nodemailer';
import axios from 'axios';
import logger from '../config/logger';

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Used only for log breadcrumbs. Never include secrets. */
  template?: string;
}

export interface SendResult {
  id?: string;
  /** Adapter name (resend / postmark / sendgrid / ses / smtp / noop). */
  adapter: string;
}

export interface EmailAdapter {
  readonly name: string;
  send(payload: EmailPayload): Promise<SendResult>;
}

// ---------- Resend HTTP adapter -----------------------------------------

class ResendAdapter implements EmailAdapter {
  readonly name = 'resend';
  // Operator-controlled fixed URL. Per repo policy `safeAxios` is only
  // required for user-controlled fetch targets; the Resend endpoint is
  // a constant in source so plain axios is fine.
  private static readonly ENDPOINT = 'https://api.resend.com/emails';

  constructor(private readonly apiKey: string) {}

  async send(payload: EmailPayload): Promise<SendResult> {
    const body: Record<string, unknown> = {
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    };
    if (payload.text) body.text = payload.text;
    if (payload.replyTo) body.reply_to = payload.replyTo;

    const response = await axios.post<{ id?: string }>(
      ResendAdapter.ENDPOINT,
      body,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      },
    );
    return { id: response.data?.id, adapter: this.name };
  }
}

// ---------- nodemailer SMTP adapter -------------------------------------

interface SmtpConfig {
  name: string;
  host: string;
  port: number;
  user: string;
  pass: string;
}

class NodemailerSmtpAdapter implements EmailAdapter {
  readonly name: string;
  private transporter: Transporter;

  constructor(config: SmtpConfig) {
    this.name = config.name;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(payload: EmailPayload): Promise<SendResult> {
    const info = await this.transporter.sendMail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.replyTo,
    });
    return { id: info?.messageId, adapter: this.name };
  }
}

// ---------- No-op (test / unconfigured-dev) -----------------------------

class NoopAdapter implements EmailAdapter {
  readonly name = 'noop';

  async send(payload: EmailPayload): Promise<SendResult> {
    // Non-secret metadata only. Body and any URL it contains stay out
    // of the log — a fresh reset link is sensitive even in dev.
    logger.warn('[email:noop] outbound email skipped (no provider configured)', {
      to: payload.to,
      subject: payload.subject,
      template: payload.template,
    });
    return { adapter: this.name };
  }
}

// ---------- Factory -----------------------------------------------------

/**
 * Resolve an adapter from env. Centralized so the rest of the service
 * never reads provider-specific env keys.
 *
 * EMAIL_PROVIDER values:
 *   - "resend"   — HTTP API, EMAIL_API_KEY required
 *   - "postmark" — SMTP, EMAIL_API_KEY is the server token
 *   - "sendgrid" — SMTP, EMAIL_API_KEY is the API key (default for
 *                   backwards compat with existing prod config)
 *   - "ses"      — SMTP, AWS_SES_ACCESS_KEY + AWS_SES_SECRET_KEY
 *   - "noop"     — log-only adapter (no network)
 *
 * If EMAIL_PROVIDER is unset, the adapter defaults to "sendgrid"
 * (preserving existing prod). If the chosen provider's secrets are
 * missing in dev / test, fall back to no-op so unconfigured boxes
 * don't try to dial SMTP. In production we refuse silent fallback:
 * missing secrets throw a configuration error at startup so that
 * signup / password reset never appear successful while no email is
 * sent. To intentionally run production with no transactional email
 * (e.g. a brief grace period before a provider is provisioned), set
 * `ALLOW_NOOP_EMAIL_IN_PRODUCTION=true` — this is loud-warned at
 * startup and is documented as UNSAFE for launch.
 */
export function createEmailAdapter(): EmailAdapter {
  const provider = (process.env.EMAIL_PROVIDER || 'sendgrid').toLowerCase();
  const apiKey = process.env.EMAIL_API_KEY;
  const isProduction = process.env.NODE_ENV === 'production';
  const noopOverride = process.env.ALLOW_NOOP_EMAIL_IN_PRODUCTION === 'true';

  if (provider === 'noop') {
    if (isProduction && !noopOverride) {
      throw configError(
        'EMAIL_PROVIDER=noop is rejected in production unless ALLOW_NOOP_EMAIL_IN_PRODUCTION=true ' +
          '(UNSAFE for launch — no transactional email will be delivered).',
      );
    }
    if (isProduction) warnUnsafeNoop(provider);
    return new NoopAdapter();
  }

  if (provider === 'resend') {
    if (!apiKey) return missingSecretFallback(provider, isProduction, noopOverride);
    return new ResendAdapter(apiKey);
  }

  if (provider === 'postmark') {
    if (!apiKey) return missingSecretFallback(provider, isProduction, noopOverride);
    return new NodemailerSmtpAdapter({
      name: provider,
      host: 'smtp.postmarkapp.com',
      port: 587,
      // Postmark uses the same server token for both fields over SMTP.
      user: apiKey,
      pass: apiKey,
    });
  }

  if (provider === 'ses') {
    const user = process.env.AWS_SES_ACCESS_KEY;
    const pass = process.env.AWS_SES_SECRET_KEY;
    if (!user || !pass) return missingSecretFallback(provider, isProduction, noopOverride);
    return new NodemailerSmtpAdapter({
      name: provider,
      host: `email-smtp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
      port: 587,
      user,
      pass,
    });
  }

  // Default branch — sendgrid SMTP. Preserved so existing prod env
  // (EMAIL_PROVIDER=sendgrid) continues to work without re-config.
  if (!apiKey) return missingSecretFallback('sendgrid', isProduction, noopOverride);
  return new NodemailerSmtpAdapter({
    name: 'sendgrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    user: 'apikey',
    pass: apiKey,
  });
}

function missingSecretFallback(
  provider: string,
  isProduction: boolean,
  noopOverride: boolean,
): EmailAdapter {
  if (isProduction && !noopOverride) {
    throw configError(
      `EMAIL_PROVIDER=${provider} but provider secrets are unset in production. ` +
        `Set EMAIL_API_KEY (or AWS_SES_ACCESS_KEY + AWS_SES_SECRET_KEY for ses) to enable ` +
        `transactional email, or set ALLOW_NOOP_EMAIL_IN_PRODUCTION=true to explicitly accept ` +
        `silent no-op (UNSAFE for launch — signup and password reset will appear successful ` +
        `while no email is delivered).`,
    );
  }
  if (isProduction) warnUnsafeNoop(provider);
  return new NoopAdapter();
}

function configError(message: string): Error {
  logger.error(`[email] configuration error: ${message}`);
  return new Error(`[email] ${message}`);
}

function warnUnsafeNoop(provider: string): void {
  logger.warn(
    `[email] ALLOW_NOOP_EMAIL_IN_PRODUCTION=true overrides missing-secret check for ` +
      `provider=${provider}. No transactional email will be delivered. UNSAFE for launch.`,
  );
}

// ---------- Helpers (exported for tests) --------------------------------

export const __test__ = {
  ResendAdapter,
  NodemailerSmtpAdapter,
  NoopAdapter,
};
