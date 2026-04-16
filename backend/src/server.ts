import http from 'http';
import app from './app';
import { initializeSocket } from './config/socket';
import logger from './config/logger';

const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = http.createServer(app);

// Request timeout configuration
httpServer.timeout = 30000;          // 30s general timeout
httpServer.keepAliveTimeout = 65000; // above nginx keepalive (60s)
httpServer.headersTimeout = 66000;   // slightly above keepAliveTimeout

// Initialize Socket.IO
initializeSocket(httpServer);

// Start server
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Rowly API server running on port ${PORT}`);
    logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    logger.info(`🔌 Socket.IO ready for real-time connections`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection:', err);
  httpServer.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  httpServer.close(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default httpServer;
