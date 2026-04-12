"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = __importDefault(require("./logger"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
let io = null;
const initializeSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });
    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }
            if (!process.env.JWT_SECRET) {
                throw new Error('Missing required environment variable: JWT_SECRET. Please set it in your .env file.');
            }
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            socket.userEmail = decoded.email;
            logger_1.default.info(`Socket authenticated for user: ${decoded.userId}`);
            next();
        }
        catch (err) {
            logger_1.default.error('Socket authentication failed:', err);
            next(new Error('Authentication error: Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        const userId = socket.userId;
        logger_1.default.info(`Client connected: ${socket.id} (User: ${userId})`);
        // Join user-specific room
        socket.join(`user:${userId}`);
        // Handle project room joins
        socket.on('join:project', (projectId) => {
            socket.join(`project:${projectId}`);
            logger_1.default.info(`User ${userId} joined project room: ${projectId}`);
        });
        socket.on('leave:project', (projectId) => {
            socket.leave(`project:${projectId}`);
            logger_1.default.info(`User ${userId} left project room: ${projectId}`);
        });
        // Counter events
        socket.on('counter:update', (data) => {
            // Broadcast to all users in the project room except sender
            socket.to(`project:${data.projectId}`).emit('counter:updated', data);
            logger_1.default.info(`Counter ${data.counterId} updated to ${data.currentCount} in project ${data.projectId}`);
        });
        socket.on('counter:increment', (data) => {
            socket.to(`project:${data.projectId}`).emit('counter:incremented', data);
        });
        socket.on('counter:decrement', (data) => {
            socket.to(`project:${data.projectId}`).emit('counter:decremented', data);
        });
        socket.on('counter:reset', (data) => {
            socket.to(`project:${data.projectId}`).emit('counter:reset', data);
        });
        // Project update events
        socket.on('project:update', (data) => {
            socket.to(`project:${data.projectId}`).emit('project:updated', data);
            logger_1.default.info(`Project ${data.projectId} updated`);
        });
        // Photo events
        socket.on('photo:uploaded', (data) => {
            socket.to(`project:${data.projectId}`).emit('photo:added', data);
            logger_1.default.info(`Photo uploaded to project ${data.projectId}`);
        });
        socket.on('photo:deleted', (data) => {
            socket.to(`project:${data.projectId}`).emit('photo:removed', data);
            logger_1.default.info(`Photo ${data.photoId} deleted from project ${data.projectId}`);
        });
        // Disconnect
        socket.on('disconnect', () => {
            logger_1.default.info(`Client disconnected: ${socket.id} (User: ${userId})`);
        });
    });
    logger_1.default.info('✅ Socket.IO initialized successfully');
    return io;
};
exports.initializeSocket = initializeSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized! Call initializeSocket() first.');
    }
    return io;
};
exports.getIO = getIO;
exports.default = { initializeSocket: exports.initializeSocket, getIO: exports.getIO };
