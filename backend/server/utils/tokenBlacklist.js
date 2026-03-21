const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Use TLS for cloud Redis (rediss:// protocol), plain TCP for local (redis://)
const redis = new Redis(redisUrl, {
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 200, 2000)
});

redis.on('connect', () => console.log('Redis connected successfully'));
redis.on('error', (err) => console.error('Redis error:', err));

const connectRedis = async () => {
    try {
        await redis.connect();
    } catch (e) {
        console.error('Redis connection failed:', e.message);
        throw e;
    }
};

// TTL must match JWT expiry so tokens auto-expire from Redis naturally
const TOKEN_TTL_SECONDS = parseInt(process.env.JWT_EXPIRES_IN_SECONDS) || 1800;

/**
 * Blacklist a token until it expires.
 * @param {string} token - Raw JWT string
 * @param {number} [ttlSeconds] - Optional custom TTL (defaults to access token TTL)
 */
const addToBlacklist = async (token, ttlSeconds = TOKEN_TTL_SECONDS) => {
    await redis.set(`bl_${token}`, '1', 'EX', ttlSeconds);
};

/**
 * Check if a token is blacklisted.
 * @param {string} token - Raw JWT string
 * @returns {Promise<boolean>}
 */
const isBlacklisted = async (token) => {
    const result = await redis.get(`bl_${token}`);
    return result !== null;
};

module.exports = { addToBlacklist, isBlacklisted, connectRedis };
