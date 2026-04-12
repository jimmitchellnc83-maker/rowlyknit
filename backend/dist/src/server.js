"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const socket_1 = require("./config/socket");
const logger_1 = __importDefault(require("./config/logger"));
const PORT = process.env.PORT || 5000;
// Create HTTP server
const httpServer = http_1.default.createServer(app_1.default);
// Initialize Socket.IO
(0, socket_1.initializeSocket)(httpServer);
// Start server
if (process.env.NODE_ENV !== 'test') {
    httpServer.listen(PORT, () => {
        logger_1.default.info(`🚀 Rowly API server running on port ${PORT}`);
        logger_1.default.info(`📝 Environment: ${process.env.NODE_ENV}`);
        logger_1.default.info(`🔗 Health check: http://localhost:${PORT}/health`);
        logger_1.default.info(`🔌 Socket.IO ready for real-time connections`);
    });
}
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger_1.default.error('Unhandled Promise Rejection:', err);
    httpServer.close(() => process.exit(1));
});
// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger_1.default.error('Uncaught Exception:', err);
    httpServer.close(() => process.exit(1));
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
        logger_1.default.info('HTTP server closed');
        process.exit(0);
    });
});
exports.default = httpServer;
