import { Request, Response } from 'express';
import db from '../config/database';
import { ValidationError } from '../utils/errorHandler';

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

/**
 * Log one usage event for the current user. Intentionally forgiving on the
 * write path — missing metadata is fine, an invalid name is a ValidationError.
 * Never let usage logging block the real feature.
 */
export async function createUsageEvent(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { eventName, entityId, metadata } = req.body;

  if (typeof eventName !== 'string' || !EVENT_NAME_PATTERN.test(eventName)) {
    throw new ValidationError('eventName must be snake_case, 2-63 chars');
  }

  const [row] = await db('usage_events')
    .insert({
      user_id: userId,
      event_name: eventName,
      entity_id: entityId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : '{}',
    })
    .returning(['id', 'created_at']);

  res.status(201).json({ success: true, data: { event: row } });
}

/**
 * Global aggregate counts per event_name in the last `days` days.
 * Returns unique-user count too so "one user triggering 500 events" doesn't
 * fake out a keep decision.
 */
export async function getUsageSummary(req: Request, res: Response) {
  const requestedDays = Number(req.query.days);
  const days =
    Number.isFinite(requestedDays) && requestedDays > 0 && requestedDays <= 90
      ? Math.floor(requestedDays)
      : 14;

  const rows = (await db('usage_events')
    .whereRaw("created_at >= NOW() - (?::text || ' days')::interval", [days])
    .select('event_name')
    .count('* as events')
    .countDistinct('user_id as users')
    .groupBy('event_name')
    .orderBy('event_name', 'asc')) as unknown as Array<{
    event_name: string;
    events: string | number;
    users: string | number;
  }>;

  const summary = rows.map((r) => ({
    eventName: r.event_name,
    events: Number(r.events) || 0,
    uniqueUsers: Number(r.users) || 0,
  }));

  res.json({ success: true, data: { days, summary } });
}
