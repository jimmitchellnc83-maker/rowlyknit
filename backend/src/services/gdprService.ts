import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import db from '../config/database';
import logger from '../config/logger';
import { getAppUrl } from '../config/appUrl';
import emailService from './emailService';

// GDPR Article 15 (data export) + Article 17 (deletion / right to erasure).
//
// Export flow: caller POSTs /api/gdpr/export → row inserted as `pending`,
// materialisation is detached via setImmediate so the request returns
// fast. Frontend polls GET /api/gdpr/export/:id; once `completed`, the
// download URL is live for `EXPORT_TTL_DAYS` days.
//
// Deletion flow: caller POSTs /api/gdpr/delete → row inserted with
// `scheduled_for = now + DELETION_GRACE_DAYS` and `status='pending'`.
// Email goes out with a one-shot confirmation token. Confirming flips to
// `scheduled`. The cron sweep (PR 3) finds `scheduled` rows whose
// `scheduled_for` has passed and runs the cascade DELETE on the user
// row. CASCADE FKs on every user-owned table do the rest (verified in
// the 2026-04-30 audit, doc round 4 cleanup query).

const EXPORT_TTL_DAYS = Number(process.env.GDPR_EXPORT_TTL_DAYS) > 0
  ? Number(process.env.GDPR_EXPORT_TTL_DAYS)
  : 7;

const DELETION_GRACE_DAYS = Number(process.env.GDPR_DELETION_GRACE_DAYS) > 0
  ? Number(process.env.GDPR_DELETION_GRACE_DAYS)
  : 30;

const EXPORTS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'exports');

// Columns that must never appear in an export (secrets / hashes).
// Applied across every table we dump.
const SENSITIVE_COLUMNS = new Set([
  'password_hash',
  'refresh_token',
  'refresh_token_hash',
  'verification_token',
  'reset_password_token',
  'reset_password_token_hash',
  'confirmation_token',
  'access_token',
  'token',
]);

// Tables to skip even though they have a `user_id` column. Audit logs
// are retained post-deletion (FK is SET NULL) for compliance evidence
// — the user can still see them in their own export if they want.
// `email_logs` is delivery metadata, not user content.
const SKIP_EXPORT_TABLES = new Set<string>([]);

export interface DataExportRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv';
  download_url: string | null;
  expires_at: Date | null;
  error_message: string | null;
  completed_at: Date | null;
  created_at: Date;
}

export interface DeletionRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  scheduled_for: Date | null;
  reason: string | null;
  confirmation_token: string | null;
  confirmed_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
}

// ---------- Data export ----------

export async function requestDataExport({
  userId,
  format = 'json',
}: {
  userId: string;
  format?: 'json' | 'csv';
}): Promise<DataExportRequest> {
  // De-dupe: if there's an export already in flight for this user,
  // return that one instead of stacking up tmpfiles.
  const inFlight = await db('data_export_requests')
    .where({ user_id: userId })
    .whereIn('status', ['pending', 'processing'])
    .orderBy('created_at', 'desc')
    .first();

  if (inFlight) return inFlight as DataExportRequest;

  const [row] = await db('data_export_requests')
    .insert({ user_id: userId, status: 'pending', format })
    .returning('*');

  // Detach: don't make the user wait for the file write.
  setImmediate(() => {
    materialiseExport(row.id).catch((err) => {
      logger.error('GDPR export materialisation crashed', {
        requestId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  return row as DataExportRequest;
}

export async function getExportRequest({
  requestId,
  userId,
}: {
  requestId: string;
  userId: string;
}): Promise<DataExportRequest | null> {
  const row = await db('data_export_requests')
    .where({ id: requestId, user_id: userId })
    .first();
  return (row as DataExportRequest) ?? null;
}

export async function listExportRequests(userId: string): Promise<DataExportRequest[]> {
  const rows = await db('data_export_requests')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(20);
  return rows as DataExportRequest[];
}

export function exportFilePath(userId: string, requestId: string, format: 'json' | 'csv'): string {
  const ext = format === 'csv' ? 'csv' : 'json';
  return path.join(EXPORTS_DIR, userId, `${requestId}.${ext}`);
}

export async function materialiseExport(requestId: string): Promise<void> {
  const req = (await db('data_export_requests')
    .where({ id: requestId })
    .first()) as DataExportRequest | undefined;
  if (!req) {
    logger.warn('GDPR export materialise: request row not found', { requestId });
    return;
  }
  if (req.status !== 'pending') {
    logger.info('GDPR export materialise: skipping non-pending row', {
      requestId,
      status: req.status,
    });
    return;
  }

  await db('data_export_requests').where({ id: requestId }).update({ status: 'processing' });

  try {
    const data = await collectUserData(req.user_id);
    const filepath = exportFilePath(req.user_id, requestId, req.format);
    await fs.promises.mkdir(path.dirname(filepath), { recursive: true });

    if (req.format === 'csv') {
      await fs.promises.writeFile(filepath, serialiseAsCsv(data));
    } else {
      await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2));
    }

    const expiresAt = new Date(Date.now() + EXPORT_TTL_DAYS * 24 * 60 * 60 * 1000);
    await db('data_export_requests').where({ id: requestId }).update({
      status: 'completed',
      download_url: `/api/gdpr/export/${requestId}/download`,
      expires_at: expiresAt,
      completed_at: new Date(),
      error_message: null,
    });

    logger.info('GDPR export materialised', { requestId, userId: req.user_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db('data_export_requests').where({ id: requestId }).update({
      status: 'failed',
      error_message: message,
    });
    logger.error('GDPR export materialise failed', { requestId, error: message });
  }
}

// Walk every table that has a `user_id` column and dump the rows for
// this user. Plus the `users` row itself (which uses `id` not `user_id`).
// Missing tables are tolerated — schema drift between envs shouldn't
// break the export.
async function collectUserData(userId: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    _meta: {
      exported_at: new Date().toISOString(),
      user_id: userId,
      format_version: 1,
    },
  };

  const userRow = await db('users').where({ id: userId }).first();
  out.users = userRow ? [stripSensitive(userRow)] : [];

  const tables = await listUserOwnedTables();
  for (const tableName of tables) {
    if (SKIP_EXPORT_TABLES.has(tableName)) continue;
    try {
      const rows = await db(tableName).where({ user_id: userId });
      out[tableName] = rows.map(stripSensitive);
    } catch (err) {
      // Don't let one table failure poison the whole export.
      logger.warn('GDPR export: skipped table on error', {
        table: tableName,
        error: err instanceof Error ? err.message : String(err),
      });
      out[tableName] = { error: 'table read failed' };
    }
  }

  return out;
}

async function listUserOwnedTables(): Promise<string[]> {
  const rows = (await db('information_schema.columns')
    .where({ column_name: 'user_id', table_schema: 'public' })
    .select('table_name')) as Array<{ table_name: string }>;
  return rows.map((r) => r.table_name).sort();
}

function stripSensitive(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (SENSITIVE_COLUMNS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

// Naive CSV: one stanza per table with a "## table_name" header.
// Real spreadsheet round-trip isn't a v1 goal — this is a human-readable
// fallback. Exports are JSON by default.
function serialiseAsCsv(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [table, rows] of Object.entries(data)) {
    lines.push(`## ${table}`);
    if (!Array.isArray(rows) || rows.length === 0) {
      lines.push('');
      continue;
    }
    const cols = Object.keys(rows[0] as object);
    lines.push(cols.map(csvCell).join(','));
    for (const row of rows as Array<Record<string, unknown>>) {
      lines.push(cols.map((c) => csvCell(row[c])).join(','));
    }
    lines.push('');
  }
  return lines.join('\n');
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------- Account deletion ----------

export async function requestAccountDeletion({
  userId,
  email,
  firstName,
  reason,
}: {
  userId: string;
  email: string;
  firstName?: string | null;
  reason?: string | null;
}): Promise<DeletionRequest> {
  // De-dupe: if there's already an active deletion request, return it.
  const existing = await db('deletion_requests')
    .where({ user_id: userId })
    .whereIn('status', ['pending', 'scheduled'])
    .orderBy('created_at', 'desc')
    .first();

  if (existing) return existing as DeletionRequest;

  const token = crypto.randomBytes(32).toString('hex');
  const scheduledFor = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await db('deletion_requests')
    .insert({
      user_id: userId,
      status: 'pending',
      scheduled_for: scheduledFor,
      reason: reason ?? null,
      confirmation_token: token,
    })
    .returning('*');

  const confirmUrl = `${getAppUrl()}/account/delete/confirm?token=${token}`;
  try {
    await emailService.sendAccountDeletionConfirmEmail(
      email,
      firstName || 'there',
      confirmUrl,
      DELETION_GRACE_DAYS,
    );
  } catch (err) {
    // Log but don't tear down — the row exists, the user can re-trigger
    // to get a fresh email if the first attempt failed silently.
    logger.error('GDPR deletion confirm email failed', {
      userId,
      requestId: row.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return row as DeletionRequest;
}

export async function confirmDeletion(token: string): Promise<DeletionRequest | null> {
  const row = (await db('deletion_requests')
    .where({ confirmation_token: token, status: 'pending' })
    .first()) as DeletionRequest | undefined;

  if (!row) return null;

  await db('deletion_requests').where({ id: row.id }).update({
    status: 'scheduled',
    confirmed_at: new Date(),
    confirmation_token: null,
  });

  const updated = (await db('deletion_requests')
    .where({ id: row.id })
    .first()) as DeletionRequest;
  return updated;
}

export async function cancelDeletion(userId: string): Promise<DeletionRequest | null> {
  const active = (await db('deletion_requests')
    .where({ user_id: userId })
    .whereIn('status', ['pending', 'scheduled'])
    .orderBy('created_at', 'desc')
    .first()) as DeletionRequest | undefined;

  if (!active) return null;

  await db('deletion_requests').where({ id: active.id }).update({
    status: 'cancelled',
    cancelled_at: new Date(),
    confirmation_token: null,
  });

  const updated = (await db('deletion_requests')
    .where({ id: active.id })
    .first()) as DeletionRequest;
  return updated;
}

export async function getActiveDeletionRequest(userId: string): Promise<DeletionRequest | null> {
  const row = await db('deletion_requests')
    .where({ user_id: userId })
    .whereIn('status', ['pending', 'scheduled'])
    .orderBy('created_at', 'desc')
    .first();
  return (row as DeletionRequest) ?? null;
}

// Cron entry point. Idempotent — finds `scheduled` rows whose grace has
// elapsed and hard-deletes the user. CASCADE FKs handle every owned
// table; `audit_logs` and `email_logs` use SET NULL so the trail of
// "this user existed and we deleted them" survives for compliance.
export async function executeScheduledDeletions(): Promise<{
  attempted: number;
  completed: number;
  failed: number;
}> {
  const now = new Date();
  const due = (await db('deletion_requests')
    .where({ status: 'scheduled' })
    .where('scheduled_for', '<=', now)) as DeletionRequest[];

  let completed = 0;
  let failed = 0;

  for (const req of due) {
    try {
      await db.transaction(async (trx) => {
        await trx('users').where({ id: req.user_id }).delete();
        await trx('deletion_requests').where({ id: req.id }).update({
          status: 'completed',
          completed_at: new Date(),
        });
      });
      completed++;
      logger.info('GDPR deletion executed', { requestId: req.id, userId: req.user_id });
    } catch (err) {
      failed++;
      logger.error('GDPR deletion execution failed', {
        requestId: req.id,
        userId: req.user_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { attempted: due.length, completed, failed };
}
