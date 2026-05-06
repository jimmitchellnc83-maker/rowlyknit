import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import logger from './logger';
import jwt from 'jsonwebtoken';
import db from './database';

let io: Server | null = null;

/**
 * Read a single cookie value out of a raw `Cookie:` header. Avoids
 * pulling cookie-parser into the socket path for one lookup.
 *
 * Returns null if the header is missing or the named cookie isn't set.
 */
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const parts = header.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware.
  //
  // Cookie-first browser auth (PR #389 final pass): the access token
  // travels as an httpOnly `accessToken` cookie set by login/refresh.
  // socket.io-client connects with `withCredentials: true` so the
  // browser attaches the cookie to the WebSocket handshake. We fall
  // back to `auth.token` and `Authorization: Bearer ...` for non-browser
  // API-clients (mobile / scripts) — those paths intentionally remain.
  io.use(async (socket: Socket, next) => {
    try {
      const cookieToken = readCookie(socket.handshake.headers.cookie, 'accessToken');
      const explicitToken =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');
      const token = cookieToken || explicitToken;

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
