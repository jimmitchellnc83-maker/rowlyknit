import { Request, Response } from 'express';
import db from '../config/database';
import logger from '../config/logger';
import { ValidationError } from '../utils/errorHandler';
import { verifyAccessToken } from '../utils/jwt';

/**
 * First-party usage analytics endpoint for the public surface.
 *
 * Plausible captures pageview-style events client-side, which is fine
 * for traffic dashboards but invisible to the founder business
 * dashboard at `/admin/business`. The dashboard reads `usage_events`
 * directly so funnel + conversion math stays under our roof and works
 * even when an ad-blocker drops the Plausible script.
 *
 * This endpoint is intentionally narrow:
 *  - PUBLIC route — no `authenticate` middleware. Anonymous visitors
 *    on `/calculators/*` can still record events.
 *  - Allowlisted event names — anything off the list is rejected so the
 *    table doesn't get polluted with arbitrary strings.
 *  - Allowlisted metadata keys — only the dimensions we plot.
 *  - PII-free — we strip everything that smells like an email / IP /
 *    user identifier from metadata before insertion.
 *  - Best-effort — failures log a warning but never throw, so a tracker
 *    outage cannot take a public calculator down.
 */

/** The exact event names the dashboard reads from `usage_events`. */
export const PUBLIC_ANALYTICS_EVENT_ALLOWLIST: ReadonlySet<string> = new Set([
  'public_tool_viewed',
  'public_tool_used',
  'public_tool_result_generated',
  'save_to_rowly_clicked',
  'signup_started_from_public_tool',
  'upgrade_page_viewed',
  'upgrade_checkout_started',
  'upgrade_checkout_redirect_login',
  'checkout_started',
  'checkout_completed',
  'trial_started',
]);

/**
 * Metadata keys we tolerate. Anything else is dropped silently — the
 * client may pass extras but the table only stores the ones we plot.
 *
 * No PII keys: nothing here can carry an email, IP, geolocation, etc.
 */
const ALLOWED_METADATA_KEYS: ReadonlySet<string> = new Set([
  'route',         // public_tool_viewed → which calculator
  'tool',          // save_to_rowly_clicked → which tool the user wanted
  'toolId',        // alias the FE already sends
  'plan',          // upgrade_checkout_started → monthly | annual
  'fit',           // size calc dimensions
  'garment',       // yardage calc dimension
  'yarnWeight',    // yardage calc dimension
  'size',          // size calc dimension
  'shapingType',   // shaping calc dimension
  'status',        // gauge calc result status
  'auth',          // 'in' | 'out' for save click branching
]);

const MAX_VALUE_LEN = 200;
const MAX_METADATA_KEYS = 10;

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

/**
 * Sanitise metadata: drop disallowed keys, coerce to string, cap length,
 * cap key count. Returns a plain object safe for JSON serialisation.
 */
function sanitiseMetadata(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_METADATA_KEYS) break;
    if (!ALLOWED_METADATA_KEYS.has(k)) continue;
    let coerced: string;
    if (typeof v === 'string') coerced = v;
    else if (typeof v === 'number' || typeof v === 'boolean') coerced = String(v);
    else continue;
    if (coerced.length === 0) continue;
    out[k] = coerced.length > MAX_VALUE_LEN ? coerced.slice(0, MAX_VALUE_LEN) : coerced;
    count += 1;
  }
  return out;
}

/**
 * Try to recover an authenticated user from the request without making
 * the route fail when there's no valid token. We honour the same
 * Authorization header / cookie shape `authenticate` uses, but here a
 * decode failure is a no-op (we still record the event as anonymous).
 */
function tryReadUserId(req: Request): string | null {
  try {
    let token: string | undefined;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.slice(7).trim();
    }
    if (!token && (req as Request & { cookies?: Record<string, string> }).cookies) {
      const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.access_token;
      if (cookieToken) token = cookieToken;
    }
    if (!token) return null;
    const payload = verifyAccessToken(token);
    return payload?.userId ?? null;
  } catch {
    return null;
  }
}

export async function recordPublicEvent(req: Request, res: Response): Promise<void> {
  const { eventName, metadata, entityId } = (req.body ?? {}) as {
    eventName?: unknown;
    metadata?: unknown;
    entityId?: unknown;
  };

  if (typeof eventName !== 'string' || !EVENT_NAME_PATTERN.test(eventName)) {
    throw new ValidationError('eventName must be snake_case, 2-63 chars');
  }
  if (!PUBLIC_ANALYTICS_EVENT_ALLOWLIST.has(eventName)) {
    throw new ValidationError('eventName is not in the public allowlist');
  }

  const cleanMetadata = sanitiseMetadata(metadata);
  const userId = tryReadUserId(req);
  // entityId only makes sense for authed events that touch a known
  // resource — for the public allowlist we accept it but require it to
  // look like a UUID. Anything else is dropped so the column stays
  // clean.
  let cleanEntityId: string | null = null;
  if (typeof entityId === 'string' && /^[0-9a-fA-F-]{36}$/.test(entityId)) {
    cleanEntityId = entityId;
  }

  try {
    await db('usage_events').insert({
      user_id: userId,
      event_name: eventName,
      entity_id: cleanEntityId,
      metadata: JSON.stringify(cleanMetadata),
    });
  } catch (err: any) {
    // Telemetry must never take a public calculator down. Log + 202.
    logger.warn('public usage_events insert failed', {
      eventName,
      error: err?.message,
    });
  }

  // 202 Accepted — the client didn't get back a row, but the request
  // was received. Use no-store to keep this off any CDN cache that
  // might be in front of the API.
  res.set('Cache-Control', 'no-store');
  res.status(202).json({ success: true });
}
