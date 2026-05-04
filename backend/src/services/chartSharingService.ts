/**
 * Chart Sharing Service
 * Generate share links, track views, and manage shared charts
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import QRCode from 'qrcode';
import db from '../config/database';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
// 12 rounds matches utils/password.ts. Hash format ($2b$12$...) lets us
// detect legacy SHA256 entries by absence of the "$2" prefix and rehash
// them lazily on the next successful verify.
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export interface ShareOptions {
  visibility: 'public' | 'private';
  allow_copy: boolean;
  allow_download: boolean;
  expires_in_days?: number;
  password?: string;
}

export interface ShareResult {
  share_url: string;
  share_token: string;
  qr_code: string;
  expires_at?: Date;
}

/**
 * Generate a secure share token
 */
export const generateShareToken = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

/**
 * Hash a share password for storage. New shares always use bcrypt.
 */
export async function hashSharePassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Constant-time hex string compare. Used for legacy SHA256 entries that
 * predate this PR; the comparison is replaced with the bcrypt path on
 * the next successful verify (see verifySharePassword).
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function legacySha256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify a share password against the stored hash. Bcrypt path is the
 * default; legacy SHA256 hashes still verify (timing-safe), and on
 * success the row's hash is rehashed with bcrypt — so the legacy hash
 * survives at most one more login.
 */
export async function verifySharePassword(
  password: string,
  hash: string,
  rehash?: { table: string; column: string; where: Record<string, unknown> }
): Promise<boolean> {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  // Legacy SHA256
  if (!timingSafeHexEqual(legacySha256(password), hash)) {
    return false;
  }
  if (rehash) {
    try {
      const upgraded = await hashSharePassword(password);
      await db(rehash.table)
        .where(rehash.where)
        .update({ [rehash.column]: upgraded });
    } catch {
      // Best-effort. Verify still succeeds; the hash will be retried
      // on the next call.
    }
  }
  return true;
}

/**
 * Create shareable link for a chart
 */
export const createChartShareLink = async (
  chartId: string,
  userId: string,
  options: ShareOptions
): Promise<ShareResult> => {
  const token = generateShareToken();

  const expiresAt = options.expires_in_days
    ? new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000)
    : null;

  const passwordHash = options.password ? await hashSharePassword(options.password) : null;

  await db('shared_charts').insert({
    chart_id: chartId,
    user_id: userId,
    share_token: token,
    visibility: options.visibility,
    allow_copy: options.allow_copy,
    allow_download: options.allow_download,
    password_hash: passwordHash,
    expires_at: expiresAt,
  });

  const shareUrl = `${APP_URL}/shared/chart/${token}`;

  // Generate QR code
  const qrCode = await QRCode.toDataURL(shareUrl, {
    width: 200,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return {
    share_url: shareUrl,
    share_token: token,
    qr_code: qrCode,
    expires_at: expiresAt || undefined,
  };
};

/**
 * Create shareable link for a pattern
 */
export const createPatternShareLink = async (
  patternId: string,
  userId: string,
  options: ShareOptions & { include_charts?: boolean; include_notes?: boolean }
): Promise<ShareResult> => {
  const token = generateShareToken();

  const expiresAt = options.expires_in_days
    ? new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000)
    : null;

  await db('shared_patterns').insert({
    pattern_id: patternId,
    user_id: userId,
    share_token: token,
    visibility: options.visibility,
    allow_copy: options.allow_copy,
    include_charts: options.include_charts !== false,
    include_notes: options.include_notes || false,
    expires_at: expiresAt,
  });

  const shareUrl = `${APP_URL}/shared/pattern/${token}`;

  const qrCode = await QRCode.toDataURL(shareUrl, {
    width: 200,
    margin: 2,
  });

  return {
    share_url: shareUrl,
    share_token: token,
    qr_code: qrCode,
    expires_at: expiresAt || undefined,
  };
};

/**
 * Get shared chart by token
 *
 * Legacy callsite: still used by the auth'd `copySharedChart` flow
 * (POST /api/shared/chart/:token/copy) where the password sits in the
 * request body, not the URL. The public view/download flow now uses
 * `getSharedChartIfAccessible` + `verifyChartSharePassword` instead.
 */
export const getSharedChart = async (
  token: string,
  password?: string
): Promise<{ chart: any; share: any } | null> => {
  const share = await db('shared_charts')
    .where({ share_token: token })
    .first();

  if (!share) {
    return null;
  }

  // Check expiration
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return null;
  }

  // Check password if protected. Verify upgrades legacy SHA256 hashes
  // to bcrypt on the first successful match.
  if (share.password_hash) {
    if (!password) {
      throw new Error('Password required');
    }
    const ok = await verifySharePassword(password, share.password_hash, {
      table: 'shared_charts',
      column: 'password_hash',
      where: { id: share.id },
    });
    if (!ok) {
      throw new Error('Password required');
    }
  }

  // Get chart data
  const chart = await db('charts')
    .where({ id: share.chart_id })
    .first();

  if (!chart) {
    return null;
  }

  return { chart, share };
};

export type ChartShareAccessOutcome =
  | { status: 'not_found' }
  | { status: 'password_required'; share: any }
  | { status: 'ok'; share: any; chart: any };

export type ChartSharePasswordVerifyOutcome =
  | { status: 'not_found' }
  | { status: 'not_password_protected' }
  | { status: 'invalid_password' }
  | { status: 'ok'; share: any };

/**
 * Public-side chart accessor that does NOT take a raw password.
 * The caller (controller) supplies an opaque access token previously
 * issued by `verifyChartSharePassword` + `issueShareAccessToken`. For
 * non-password shares the access token is ignored.
 *
 * Replaces the previous `?password=…` query-string flow flagged by
 * the seam audit (2026-05-04).
 */
export const getSharedChartIfAccessible = async (
  token: string,
  accessToken: string | undefined
): Promise<ChartShareAccessOutcome> => {
  // Lazy import keeps a clean test-mock seam: existing service tests
  // that stub the DB module don't pull in the JWT helpers as a side
  // effect of importing the service.
  const { verifyShareAccessToken } = await import('../utils/shareAccessToken');

  const share = await db('shared_charts')
    .where({ share_token: token })
    .first();

  if (!share) return { status: 'not_found' };
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return { status: 'not_found' };
  }

  if (share.password_hash) {
    if (!verifyShareAccessToken(token, accessToken)) {
      return { status: 'password_required', share };
    }
  }

  const chart = await db('charts').where({ id: share.chart_id }).first();
  if (!chart) return { status: 'not_found' };

  return { status: 'ok', share, chart };
};

/**
 * Verify a password against the share's stored hash. On success the
 * caller can mint an access token via `issueShareAccessToken`. The
 * password never reaches `getSharedChartIfAccessible` — keeps the
 * password out of any later URL or log line.
 */
export const verifyChartSharePassword = async (
  token: string,
  password: string
): Promise<ChartSharePasswordVerifyOutcome> => {
  const share = await db('shared_charts')
    .where({ share_token: token })
    .first();

  if (!share) return { status: 'not_found' };
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return { status: 'not_found' };
  }
  if (!share.password_hash) {
    return { status: 'not_password_protected' };
  }

  const ok = await verifySharePassword(password, share.password_hash, {
    table: 'shared_charts',
    column: 'password_hash',
    where: { id: share.id },
  });

  if (!ok) return { status: 'invalid_password' };
  return { status: 'ok', share };
};

/**
 * Track chart view
 */
export const trackChartView = async (shareToken: string): Promise<void> => {
  await db('shared_charts')
    .where({ share_token: shareToken })
    .update({
      view_count: db.raw('view_count + 1'),
      last_viewed_at: db.fn.now(),
    });
};

/**
 * Track chart copy
 */
export const trackChartCopy = async (shareToken: string): Promise<void> => {
  await db('shared_charts')
    .where({ share_token: shareToken })
    .update({
      copy_count: db.raw('copy_count + 1'),
    });
};

/**
 * Track chart download
 */
export const trackChartDownload = async (shareToken: string): Promise<void> => {
  await db('shared_charts')
    .where({ share_token: shareToken })
    .update({
      download_count: db.raw('download_count + 1'),
    });
};

/**
 * Get share statistics
 */
export const getShareStats = async (
  userId: string
): Promise<{
  total_shares: number;
  total_views: number;
  total_copies: number;
  total_downloads: number;
}> => {
  const chartStats = await db('shared_charts')
    .where({ user_id: userId })
    .select(
      db.raw('COUNT(*) as count'),
      db.raw('COALESCE(SUM(view_count), 0) as views'),
      db.raw('COALESCE(SUM(copy_count), 0) as copies'),
      db.raw('COALESCE(SUM(download_count), 0) as downloads')
    )
    .first() as unknown as { count: string; views: string; copies: string; downloads: string } | undefined;

  const patternStats = await db('shared_patterns')
    .where({ user_id: userId })
    .select(
      db.raw('COUNT(*) as count'),
      db.raw('COALESCE(SUM(view_count), 0) as views')
    )
    .first() as unknown as { count: string; views: string } | undefined;

  return {
    total_shares: Number(chartStats?.count || 0) + Number(patternStats?.count || 0),
    total_views: Number(chartStats?.views || 0) + Number(patternStats?.views || 0),
    total_copies: Number(chartStats?.copies || 0),
    total_downloads: Number(chartStats?.downloads || 0),
  };
};

/**
 * Revoke share link
 */
export const revokeShareLink = async (
  shareToken: string,
  userId: string,
  type: 'chart' | 'pattern'
): Promise<boolean> => {
  const table = type === 'chart' ? 'shared_charts' : 'shared_patterns';

  const deleted = await db(table)
    .where({ share_token: shareToken, user_id: userId })
    .delete();

  return deleted > 0;
};

/**
 * Get user's shared items
 */
export const getUserSharedItems = async (
  userId: string
): Promise<{
  charts: any[];
  patterns: any[];
}> => {
  const charts = await db('shared_charts')
    .join('charts', 'shared_charts.chart_id', 'charts.id')
    .where({ 'shared_charts.user_id': userId })
    .select(
      'shared_charts.*',
      'charts.name as chart_name'
    )
    .orderBy('shared_charts.created_at', 'desc');

  const patterns = await db('shared_patterns')
    .join('patterns', 'shared_patterns.pattern_id', 'patterns.id')
    .where({ 'shared_patterns.user_id': userId })
    .select(
      'shared_patterns.*',
      'patterns.name as pattern_name'
    )
    .orderBy('shared_patterns.created_at', 'desc');

  return { charts, patterns };
};

export default {
  generateShareToken,
  createChartShareLink,
  createPatternShareLink,
  getSharedChart,
  getSharedChartIfAccessible,
  verifyChartSharePassword,
  trackChartView,
  trackChartCopy,
  trackChartDownload,
  getShareStats,
  revokeShareLink,
  getUserSharedItems,
};
