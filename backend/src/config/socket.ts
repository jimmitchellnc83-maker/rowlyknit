import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import logger from './logger';
import jwt from 'jsonwebtoken';
import db from './database';

let io: Server | null = null;

export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      if (!process.env.JWT_SECRET) {
        throw new Error('Missing required environment variable: JWT_SECRET. Please set it in your .env file.');
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string; email: string };
      (socket as any).userId = decoded.userId;
      (socket as any).userEmail = decoded.email;

      logger.info(`Socket authenticated for user: ${decoded.userId}`);
      next();
    } catch (err) {
      logger.error('Socket authentication failed:', err);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    logger.info(`Client connected: ${socket.id} (User: ${userId})`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle project room joins - VERIFY OWNERSHIP FIRST
    socket.on('join:project', async (projectId: string) => {
      try {
        // Security: Verify user owns this project before allowing them to join
        const project = await db('projects')
          .where({ id: projectId, user_id: userId })
          .whereNull('deleted_at')
          .first();

        if (!project) {
          logger.warn(`User ${userId} attempted to join unauthorized project: ${projectId}`);
          socket.emit('error', { message: 'Unauthorized: You do not have access to this project' });
          return;
        }

        socket.join(`project:${projectId}`);
        logger.info(`User ${userId} joined project room: ${projectId}`);
      } catch (error) {
        logger.error(`Error joining project room: ${error}`);
        socket.emit('error', { message: 'Failed to join project room' });
      }
    });

    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      logger.info(`User ${userId} left project room: ${projectId}`);
    });

    // Counter / project / photo broadcasts intentionally are NOT
    // accepted from clients. Pre-2026-05-02 there were `socket.on(...)`
    // handlers that re-emitted client-supplied data into
    // `project:${data.projectId}` with no membership check, so any
    // authenticated user could push fake counter/project/photo updates
    // to OTHER projects' rooms. The server-side controllers
    // (countersController emits `counter:updated` after each write)
    // are the only authoritative real-time source now; the frontend
    // listener handles `counter:updated` directly.

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id} (User: ${userId})`);
    });
  });

  logger.info('✅ Socket.IO initialized successfully');
  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized! Call initializeSocket() first.');
  }
  return io;
};

export default { initializeSocket, getIO };
