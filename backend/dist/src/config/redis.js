"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionRedisClient = exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
};
// Create Redis client for rate limiting
exports.redisClient = new ioredis_1.default(redisConfig);
exports.redisClient.on('connect', () => {
    console.log('✓ Redis connection established');
});
exports.redisClient.on('error', (err) => {
    console.error('✗ Redis connection error:', err.message);
});
// Create separate Redis client for sessions
exports.sessionRedisClient = new ioredis_1.default(redisConfig);
exports.default = exports.redisClient;
