import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import logger from '../config/logger';

// Why this module exists: prior to 2026-05-02 every uploaded asset got a
// filename like `pattern-<projectId>-<timestamp>.<ext>` and was served by an
// unauthenticated `app.use('/uploads', express.static(...))`. UUIDs in the
// path made the URLs guessable inside a short window and the static mount
// gave anyone with a URL the bytes. This module is the kill-switch:
//
//   - generateStorageFilename(): only random hex tokens are written to disk
//   - streamSafeUpload(): the only sanctioned read path; rejects anything
//     that isn't <hex>.<ext> so a poisoned DB row can't traverse the tree
//
// Path values flow through DB columns that are seeded by these helpers, so
// the safe-name regex doubles as the migration acceptance test.

const STORAGE_FILENAME_RE = /^[a-f0-9]{32}(?:\.[a-z0-9]{1,5})?$/;

export function uploadRoot(): string {
  return path.resolve(
    process.env.UPLOAD_DIR ?? path.join(__dirname, '..', '..', 'uploads')
  );
}

export function generateStorageFilename(extension: string): string {
  // Strip everything but one trailing dot + alphanumerics so a malicious
  // upload `originalname` of `../etc/passwd` collapses to a safe suffix.
  const raw = (extension ?? '').toLowerCase();
  const stripped = raw.replace(/[^a-z0-9.]/g, '').replace(/\.+/g, '.');
  const trimmed = stripped.replace(/^\.+/, '');
  const ext = trimmed ? `.${trimmed.slice(0, 5)}` : '';
  return `${crypto.randomBytes(16).toString('hex')}${ext}`;
}

export function isSafeStorageFilename(filename: string | null | undefined): boolean {
  if (!filename) return false;
  return STORAGE_FILENAME_RE.test(filename);
}

export interface StreamSafeUploadOptions {
  subdir: string;
  filename: string;
  mimeType?: string | null;
  cacheControl?: string;
  disposition?: 'inline' | 'attachment';
  downloadFilename?: string | null;
}

export async function streamSafeUpload(
  res: Response,
  opts: StreamSafeUploadOptions
): Promise<void> {
  const { subdir, filename, mimeType, cacheControl, disposition, downloadFilename } = opts;

  if (!isSafeStorageFilename(filename)) {
    res.status(404).json({ success: false, message: 'File not found' });
    return;
  }

  const subdirNormalized = subdir.replace(/^\/+|\/+$/g, '');
  if (!/^[a-z0-9/_-]+$/i.test(subdirNormalized)) {
    res.status(404).json({ success: false, message: 'File not found' });
    return;
  }

  const root = uploadRoot();
  const targetPath = path.resolve(root, subdirNormalized, filename);
  if (!targetPath.startsWith(root + path.sep)) {
    res.status(404).json({ success: false, message: 'File not found' });
    return;
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(targetPath);
  } catch {
    res.status(404).json({ success: false, message: 'File not found' });
    return;
  }
  if (!stat.isFile()) {
    res.status(404).json({ success: false, message: 'File not found' });
    return;
  }

  if (mimeType) res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Cache-Control', cacheControl ?? 'private, max-age=300, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (disposition) {
    const safeName = (downloadFilename ?? filename).replace(/[\r\n"]/g, '');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${safeName}"`
    );
  }

  const stream = fs.createReadStream(targetPath);
  stream.on('error', (err) => {
    logger.error('Upload stream error', { error: err.message, filename });
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to read file' });
    } else {
      res.end();
    }
  });
  stream.pipe(res);
}

export async function renameUploadOnDisk(
  subdir: string,
  oldFilename: string,
  newFilename: string
): Promise<boolean> {
  if (!oldFilename || oldFilename === newFilename) return false;
  const root = uploadRoot();
  const subdirNormalized = subdir.replace(/^\/+|\/+$/g, '');
  const oldPath = path.resolve(root, subdirNormalized, oldFilename);
  const newPath = path.resolve(root, subdirNormalized, newFilename);
  if (!oldPath.startsWith(root + path.sep)) return false;
  if (!newPath.startsWith(root + path.sep)) return false;
  try {
    await fs.promises.rename(oldPath, newPath);
    return true;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return false;
    logger.warn('Rename failed during upload migration', {
      error: err?.message ?? String(err),
      subdir: subdirNormalized,
      oldFilename,
    });
    return false;
  }
}
