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

    // Counter events
    socket.on('counter:update', (data: { counterId: string; projectId: string; currentCount: number }) => {
      // Broadcast to all users in the project room except sender
      socket.to(`project:${data.projectId}`).emit('counter:updated', data);
      logger.info(`Counter ${data.counterId} updated to ${data.currentCount} in project ${data.projectId}`);
    });

    socket.on('counter:increment', (data: { counterId: string; projectId: string; currentCount: number }) => {
      socket.to(`project:${data.projectId}`).emit('counter:incremented', data);
    });

    socket.on('counter:decrement', (data: { counterId: string; projectId: string; currentCount: number }) => {
      socket.to(`project:${data.projectId}`).emit('counter:decremented', data);
    });

    socket.on('counter:reset', (data: { counterId: string; projectId: string }) => {
      socket.to(`project:${data.projectId}`).emit('counter:reset', data);
    });

    // Project update events
    socket.on('project:update', (data: { projectId: string; updates: any }) => {
      socket.to(`project:${data.projectId}`).emit('project:updated', data);
      logger.info(`Project ${data.projectId} updated`);
    });

    // Photo events
    socket.on('photo:uploaded', (data: { projectId: string; photo: any }) => {
      socket.to(`project:${data.projectId}`).emit('photo:added', data);
      logger.info(`Photo uploaded to project ${data.projectId}`);
    });

    socket.on('photo:deleted', (data: { projectId: string; photoId: string }) => {
      socket.to(`project:${data.projectId}`).emit('photo:removed', data);
      logger.info(`Photo ${data.photoId} deleted from project ${data.projectId}`);
    });

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
