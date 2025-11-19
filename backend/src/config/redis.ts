import Redis from 'ioredis';
import logger from './logger';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
};

// Create Redis client for rate limiting
export const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => {
  logger.info('Redis connection established');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

// Create separate Redis client for sessions
export const sessionRedisClient = new Redis(redisConfig);

export default redisClient;
