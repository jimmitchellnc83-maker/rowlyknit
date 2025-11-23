"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExportHistory = exports.revokeShare = exports.getMySharedItems = exports.getShareStatistics = exports.downloadSharedChart = exports.exportChartHandler = exports.copySharedChart = exports.viewSharedChart = exports.shareChart = void 0;
const database_1 = __importDefault(require("../config/database"));
const chartSharingService_1 = require("../services/chartSharingService");
const chartExportService_1 = require("../services/chartExportService");
/**
 * Create share link for chart
 * POST /api/charts/:chartId/share
 */
const shareChart = async (req, res) => {
    try {
        const { chartId } = req.params;
        const { visibility, allow_copy, allow_download, expires_in_days, password } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Verify chart ownership
        const chart = await (0, database_1.default)('charts')
            .where({ id: chartId, user_id: userId })
            .first();
        if (!chart) {
            return res.status(404).json({ error: 'Chart not found' });
        }
        const result = await (0, chartSharingService_1.createChartShareLink)(chartId, userId, {
            visibility: visibility || 'public',
            allow_copy: allow_copy || false,
            allow_download: allow_download !== false,
            expires_in_days: expires_in_days,
            password: password,
        });
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('Error sharing chart:', error);
        return res.status(500).json({ error: 'Failed to create share link' });
    }
};
exports.shareChart = shareChart;
/**
 * View shared chart (public endpoint)
 * GET /api/shared/chart/:token
 */
const viewSharedChart = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.query;
        const result = await (0, chartSharingService_1.getSharedChart)(token, password);
        if (!result) {
            return res.status(404).json({ error: 'Chart not found or link expired' });
        }
        // Track view
        await (0, chartSharingService_1.trackChartView)(token);
        // Don't expose internal fields
        const { share, chart } = result;
        return res.json({
            chart: {
                id: chart.id,
                name: chart.name,
                grid: chart.grid,
                rows: chart.rows,
                columns: chart.columns,
                symbol_legend: chart.symbol_legend,
                description: chart.description,
            },
            share_options: {
                allow_copy: share.allow_copy,
                allow_download: share.allow_download,
                visibility: share.visibility,
            },
        });
    }
    catch (error) {
        if (error.message === 'Password required') {
            return res.status(401).json({ error: 'Password required', password_protected: true });
        }
        console.error('Error viewing shared chart:', error);
        return res.status(500).json({ error: 'Failed to load chart' });
    }
};
exports.viewSharedChart = viewSharedChart;
/**
 * Copy shared chart to user's account
 * POST /api/shared/chart/:token/copy
 */
const copySharedChart = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await (0, chartSharingService_1.getSharedChart)(token, password);
        if (!result) {
            return res.status(404).json({ error: 'Chart not found or link expired' });
        }
        if (!result.share.allow_copy) {
            return res.status(403).json({ error: 'Copying is not allowed for this chart' });
        }
        // Create copy of chart
        const [newChart] = await (0, database_1.default)('charts')
            .insert({
            user_id: userId,
            name: `${result.chart.name} (Copy)`,
            grid: result.chart.grid,
            rows: result.chart.rows,
            columns: result.chart.columns,
            symbol_legend: result.chart.symbol_legend,
            description: result.chart.description,
            source: 'shared_copy',
        })
            .returning('*');
        // Track copy
        await (0, chartSharingService_1.trackChartCopy)(token);
        return res.status(201).json({
            chart: newChart,
            message: 'Chart copied successfully',
        });
    }
    catch (error) {
        if (error.message === 'Password required') {
            return res.status(401).json({ error: 'Password required' });
        }
        console.error('Error copying chart:', error);
        return res.status(500).json({ error: 'Failed to copy chart' });
    }
};
exports.copySharedChart = copySharedChart;
/**
 * Export chart to various formats
 * POST /api/charts/:chartId/export
 */
const exportChartHandler = async (req, res) => {
    try {
        const { chartId } = req.params;
        const { format, options = {} } = req.body;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Verify chart ownership
        const chart = await (0, database_1.default)('charts')
            .where({ id: chartId, user_id: userId })
            .first();
        if (!chart) {
            return res.status(404).json({ error: 'Chart not found' });
        }
        const validFormats = ['pdf', 'png', 'csv', 'ravelry', 'markdown'];
        if (!validFormats.includes(format)) {
            return res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
        }
        const result = await (0, chartExportService_1.exportChart)(chart, format, options);
        // Record export in history
        await (0, database_1.default)('export_history').insert({
            user_id: userId,
            chart_id: chartId,
            export_type: 'chart',
            export_format: format,
            export_options: JSON.stringify(options),
            file_size_bytes: result.buffer.length,
        });
        // Set response headers
        const filename = `${chart.name.replace(/[^a-z0-9]/gi, '_')}.${result.extension}`;
        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', result.buffer.length);
        return res.send(result.buffer);
    }
    catch (error) {
        console.error('Error exporting chart:', error);
        return res.status(500).json({ error: 'Failed to export chart' });
    }
};
exports.exportChartHandler = exportChartHandler;
/**
 * Download shared chart
 * GET /api/shared/chart/:token/download
 */
const downloadSharedChart = async (req, res) => {
    try {
        const { token } = req.params;
        const { format = 'pdf', password } = req.query;
        const result = await (0, chartSharingService_1.getSharedChart)(token, password);
        if (!result) {
            return res.status(404).json({ error: 'Chart not found or link expired' });
        }
        if (!result.share.allow_download) {
            return res.status(403).json({ error: 'Downloading is not allowed for this chart' });
        }
        const validFormats = ['pdf', 'png', 'csv'];
        if (!validFormats.includes(format)) {
            return res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
        }
        const exportResult = await (0, chartExportService_1.exportChart)(result.chart, format, {});
        // Track download
        await (0, chartSharingService_1.trackChartDownload)(token);
        const filename = `${result.chart.name.replace(/[^a-z0-9]/gi, '_')}.${exportResult.extension}`;
        res.setHeader('Content-Type', exportResult.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', exportResult.buffer.length);
        return res.send(exportResult.buffer);
    }
    catch (error) {
        if (error.message === 'Password required') {
            return res.status(401).json({ error: 'Password required' });
        }
        console.error('Error downloading chart:', error);
        return res.status(500).json({ error: 'Failed to download chart' });
    }
};
exports.downloadSharedChart = downloadSharedChart;
/**
 * Get share statistics
 * GET /api/shares/stats
 */
const getShareStatistics = async (req, res) => {
    try {
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const stats = await (0, chartSharingService_1.getShareStats)(userId);
        return res.json(stats);
    }
    catch (error) {
        console.error('Error getting share stats:', error);
        return res.status(500).json({ error: 'Failed to get statistics' });
    }
};
exports.getShareStatistics = getShareStatistics;
/**
 * Get user's shared items
 * GET /api/shares
 */
const getMySharedItems = async (req, res) => {
    try {
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const items = await (0, chartSharingService_1.getUserSharedItems)(userId);
        return res.json(items);
    }
    catch (error) {
        console.error('Error getting shared items:', error);
        return res.status(500).json({ error: 'Failed to get shared items' });
    }
};
exports.getMySharedItems = getMySharedItems;
/**
 * Revoke a share link
 * DELETE /api/shares/:type/:token
 */
const revokeShare = async (req, res) => {
    try {
        const { type, token } = req.params;
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (type !== 'chart' && type !== 'pattern') {
            return res.status(400).json({ error: 'Invalid share type' });
        }
        const success = await (0, chartSharingService_1.revokeShareLink)(token, userId, type);
        if (!success) {
            return res.status(404).json({ error: 'Share link not found' });
        }
        return res.json({ message: 'Share link revoked successfully' });
    }
    catch (error) {
        console.error('Error revoking share:', error);
        return res.status(500).json({ error: 'Failed to revoke share link' });
    }
};
exports.revokeShare = revokeShare;
/**
 * Get export history
 * GET /api/exports/history
 */
const getExportHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 20, offset = 0 } = req.query;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const exports = await (0, database_1.default)('export_history')
            .where({ user_id: userId })
            .orderBy('created_at', 'desc')
            .limit(Number(limit))
            .offset(Number(offset));
        return res.json({ exports });
    }
    catch (error) {
        console.error('Error getting export history:', error);
        return res.status(500).json({ error: 'Failed to get export history' });
    }
};
exports.getExportHistory = getExportHistory;
exports.default = {
    shareChart: exports.shareChart,
    viewSharedChart: exports.viewSharedChart,
    copySharedChart: exports.copySharedChart,
    exportChartHandler: exports.exportChartHandler,
    downloadSharedChart: exports.downloadSharedChart,
    getShareStatistics: exports.getShareStatistics,
    getMySharedItems: exports.getMySharedItems,
    revokeShare: exports.revokeShare,
    getExportHistory: exports.getExportHistory,
};
