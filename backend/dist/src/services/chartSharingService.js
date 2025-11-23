"use strict";
/**
 * Chart Sharing Service
 * Generate share links, track views, and manage shared charts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserSharedItems = exports.revokeShareLink = exports.getShareStats = exports.trackChartDownload = exports.trackChartCopy = exports.trackChartView = exports.getSharedChart = exports.createPatternShareLink = exports.createChartShareLink = exports.verifyPassword = exports.hashPassword = exports.generateShareToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const database_1 = __importDefault(require("../config/database"));
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
/**
 * Generate a secure share token
 */
const generateShareToken = () => {
    return crypto_1.default.randomBytes(16).toString('hex');
};
exports.generateShareToken = generateShareToken;
/**
 * Hash password for share protection
 */
const hashPassword = (password) => {
    return crypto_1.default.createHash('sha256').update(password).digest('hex');
};
exports.hashPassword = hashPassword;
/**
 * Verify share password
 */
const verifyPassword = (password, hash) => {
    return (0, exports.hashPassword)(password) === hash;
};
exports.verifyPassword = verifyPassword;
/**
 * Create shareable link for a chart
 */
const createChartShareLink = async (chartId, userId, options) => {
    const token = (0, exports.generateShareToken)();
    const expiresAt = options.expires_in_days
        ? new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000)
        : null;
    const passwordHash = options.password ? (0, exports.hashPassword)(options.password) : null;
    await (0, database_1.default)('shared_charts').insert({
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
    const qrCode = await qrcode_1.default.toDataURL(shareUrl, {
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
exports.createChartShareLink = createChartShareLink;
/**
 * Create shareable link for a pattern
 */
const createPatternShareLink = async (patternId, userId, options) => {
    const token = (0, exports.generateShareToken)();
    const expiresAt = options.expires_in_days
        ? new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000)
        : null;
    await (0, database_1.default)('shared_patterns').insert({
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
    const qrCode = await qrcode_1.default.toDataURL(shareUrl, {
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
exports.createPatternShareLink = createPatternShareLink;
/**
 * Get shared chart by token
 */
const getSharedChart = async (token, password) => {
    const share = await (0, database_1.default)('shared_charts')
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
    if (share.password_hash && (!password || !(0, exports.verifyPassword)(password, share.password_hash))) {
        throw new Error('Password required');
    }
    // Get chart data
    const chart = await (0, database_1.default)('charts')
        .where({ id: share.chart_id })
        .first();
    if (!chart) {
        return null;
    }
    return { chart, share };
};
exports.getSharedChart = getSharedChart;
/**
 * Track chart view
 */
const trackChartView = async (shareToken) => {
    await (0, database_1.default)('shared_charts')
        .where({ share_token: shareToken })
        .update({
        view_count: database_1.default.raw('view_count + 1'),
        last_viewed_at: database_1.default.fn.now(),
    });
};
exports.trackChartView = trackChartView;
/**
 * Track chart copy
 */
const trackChartCopy = async (shareToken) => {
    await (0, database_1.default)('shared_charts')
        .where({ share_token: shareToken })
        .update({
        copy_count: database_1.default.raw('copy_count + 1'),
    });
};
exports.trackChartCopy = trackChartCopy;
/**
 * Track chart download
 */
const trackChartDownload = async (shareToken) => {
    await (0, database_1.default)('shared_charts')
        .where({ share_token: shareToken })
        .update({
        download_count: database_1.default.raw('download_count + 1'),
    });
};
exports.trackChartDownload = trackChartDownload;
/**
 * Get share statistics
 */
const getShareStats = async (userId) => {
    const chartStats = await (0, database_1.default)('shared_charts')
        .where({ user_id: userId })
        .select(database_1.default.raw('COUNT(*) as count'), database_1.default.raw('COALESCE(SUM(view_count), 0) as views'), database_1.default.raw('COALESCE(SUM(copy_count), 0) as copies'), database_1.default.raw('COALESCE(SUM(download_count), 0) as downloads'))
        .first();
    const patternStats = await (0, database_1.default)('shared_patterns')
        .where({ user_id: userId })
        .select(database_1.default.raw('COUNT(*) as count'), database_1.default.raw('COALESCE(SUM(view_count), 0) as views'))
        .first();
    return {
        total_shares: Number(chartStats?.count || 0) + Number(patternStats?.count || 0),
        total_views: Number(chartStats?.views || 0) + Number(patternStats?.views || 0),
        total_copies: Number(chartStats?.copies || 0),
        total_downloads: Number(chartStats?.downloads || 0),
    };
};
exports.getShareStats = getShareStats;
/**
 * Revoke share link
 */
const revokeShareLink = async (shareToken, userId, type) => {
    const table = type === 'chart' ? 'shared_charts' : 'shared_patterns';
    const deleted = await (0, database_1.default)(table)
        .where({ share_token: shareToken, user_id: userId })
        .delete();
    return deleted > 0;
};
exports.revokeShareLink = revokeShareLink;
/**
 * Get user's shared items
 */
const getUserSharedItems = async (userId) => {
    const charts = await (0, database_1.default)('shared_charts')
        .join('charts', 'shared_charts.chart_id', 'charts.id')
        .where({ 'shared_charts.user_id': userId })
        .select('shared_charts.*', 'charts.name as chart_name')
        .orderBy('shared_charts.created_at', 'desc');
    const patterns = await (0, database_1.default)('shared_patterns')
        .join('patterns', 'shared_patterns.pattern_id', 'patterns.id')
        .where({ 'shared_patterns.user_id': userId })
        .select('shared_patterns.*', 'patterns.name as pattern_name')
        .orderBy('shared_patterns.created_at', 'desc');
    return { charts, patterns };
};
exports.getUserSharedItems = getUserSharedItems;
exports.default = {
    generateShareToken: exports.generateShareToken,
    createChartShareLink: exports.createChartShareLink,
    createPatternShareLink: exports.createPatternShareLink,
    getSharedChart: exports.getSharedChart,
    trackChartView: exports.trackChartView,
    trackChartCopy: exports.trackChartCopy,
    trackChartDownload: exports.trackChartDownload,
    getShareStats: exports.getShareStats,
    revokeShareLink: exports.revokeShareLink,
    getUserSharedItems: exports.getUserSharedItems,
};
