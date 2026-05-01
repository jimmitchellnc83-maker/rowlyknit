import { Request, Response } from 'express';
import fs from 'fs';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import * as gdprService from '../services/gdprService';

// HTTP layer for GDPR Article 15 (export) + Article 17 (deletion).
// All logic lives in `gdprService`; these handlers parse params,
// enforce ownership, and shape the JSON response envelope.

export async function createDataExport(req: Request, res: Response) {
  const userId = req.user!.userId;
  const requestedFormat = req.body?.format;
  const format =
    requestedFormat === 'csv' ? 'csv' : requestedFormat === 'json' || requestedFormat == null
      ? 'json'
      : null;
  if (format === null) {
    throw new ValidationError('format must be "json" or "csv"');
  }

  const row = await gdprService.requestDataExport({ userId, format });
  res.status(201).json({ success: true, data: { request: row } });
}

export async function listDataExports(req: Request, res: Response) {
  const userId = req.user!.userId;
  const requests = await gdprService.listExportRequests(userId);
  res.json({ success: true, data: { requests } });
}

export async function getDataExport(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;
  const row = await gdprService.getExportRequest({ requestId: id, userId });
  if (!row) throw new NotFoundError('Export request not found');
  res.json({ success: true, data: { request: row } });
}

export async function downloadDataExport(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;
  const row = await gdprService.getExportRequest({ requestId: id, userId });
  if (!row) throw new NotFoundError('Export request not found');
  if (row.status !== 'completed') {
    throw new ValidationError(`Export is ${row.status}, not ready to download`);
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    throw new ValidationError('Export has expired — please request a new one');
  }

  const filepath = gdprService.exportFilePath(userId, row.id, row.format);
  if (!fs.existsSync(filepath)) {
    throw new NotFoundError('Export file no longer available');
  }

  const filename = `rowly-export-${row.id}.${row.format}`;
  const contentType = row.format === 'csv' ? 'text/csv' : 'application/json';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(filepath).pipe(res);
}

export async function createDeletionRequest(req: Request, res: Response) {
  const userId = req.user!.userId;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;

  const user = await db('users').where({ id: userId }).first();
  if (!user) throw new NotFoundError('User not found');

  const row = await gdprService.requestAccountDeletion({
    userId,
    email: user.email,
    firstName: user.first_name,
    reason,
  });

  res.status(201).json({
    success: true,
    data: { request: stripDeletionToken(row) },
    message: 'Check your email to confirm the deletion.',
  });
}

export async function getActiveDeletion(req: Request, res: Response) {
  const userId = req.user!.userId;
  const row = await gdprService.getActiveDeletionRequest(userId);
  res.json({ success: true, data: { request: row ? stripDeletionToken(row) : null } });
}

export async function confirmDeletionRequest(req: Request, res: Response) {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token) throw new ValidationError('token is required');

  const row = await gdprService.confirmDeletion(token);
  if (!row) throw new NotFoundError('Confirmation token is invalid or already used');

  res.json({
    success: true,
    data: { request: stripDeletionToken(row) },
    message: `Deletion confirmed. Your account will be deleted on ${row.scheduled_for?.toISOString() ?? 'the scheduled date'}.`,
  });
}

export async function cancelDeletionRequest(req: Request, res: Response) {
  const userId = req.user!.userId;
  const row = await gdprService.cancelDeletion(userId);
  if (!row) throw new NotFoundError('No active deletion request to cancel');
  res.json({
    success: true,
    data: { request: stripDeletionToken(row) },
    message: 'Deletion cancelled.',
  });
}

function stripDeletionToken<T extends { confirmation_token: string | null }>(row: T): Omit<T, 'confirmation_token'> {
  // Tokens are one-shot secrets — never echo them back to the client.
  const { confirmation_token: _t, ...rest } = row;
  return rest;
}
