/**
 * Chart Sharing Service
 * Generate share links, track views, and manage shared charts
 */

import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '../db';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

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

/**
 * Hash password for share protection
 */
export const hashPassword = (password: string): string => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

/**
 * Verify share password
 */
export const verifyPassword = (password: string, hash: string): boolean => {
  return hashPassword(password) === hash;
};

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

  const passwordHash = options.password ? hashPassword(options.password) : null;

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

  // Check password if protected
  if (share.password_hash && (!password || !verifyPassword(password, share.password_hash))) {
    throw new Error('Password required');
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
    .first();

  const patternStats = await db('shared_patterns')
    .where({ user_id: userId })
    .select(
      db.raw('COUNT(*) as count'),
      db.raw('COALESCE(SUM(view_count), 0) as views')
    )
    .first();

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
  trackChartView,
  trackChartCopy,
  trackChartDownload,
  getShareStats,
  revokeShareLink,
  getUserSharedItems,
};
