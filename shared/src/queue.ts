// ============================================================
// MangaScans — BullMQ Queue Configuration
// ============================================================

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';

let redisConnection: IORedis | null = null;

/**
 * Get shared Redis connection for BullMQ.
 */
export function getRedisConnection(): IORedis {
    if (!redisConnection) {
        redisConnection = new IORedis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null, // Required by BullMQ
        });
    }
    return redisConnection;
}

// ── Queue Names ──────────────────────────────────────────────

export const QUEUE_NAMES = {
    PAGE_PROCESSING: 'page-processing',
    BATCH_EXPORT: 'batch-export',
} as const;

// ── Queue Instances ──────────────────────────────────────────

let pageQueue: Queue | null = null;

export function getPageQueue(): Queue {
    if (!pageQueue) {
        pageQueue = new Queue(QUEUE_NAMES.PAGE_PROCESSING, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: parseInt(process.env.MAX_RETRIES || '3', 10),
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { age: 3600 * 24 }, // Keep 24h
                removeOnFail: { age: 3600 * 24 * 7 },  // Keep 7d
            },
        });
    }
    return pageQueue;
}

/**
 * Create a BullMQ worker for the page processing queue.
 */
export function createPageWorker(
    processor: (job: Job) => Promise<void>,
    concurrency?: number
): Worker {
    return new Worker(QUEUE_NAMES.PAGE_PROCESSING, processor, {
        connection: getRedisConnection(),
        concurrency: concurrency || parseInt(process.env.WORKER_CONCURRENCY || '3', 10),
        limiter: {
            max: parseInt(process.env.AI_RATE_LIMIT_CONCURRENT || '5', 10),
            duration: 1000,
        },
    });
}

/**
 * Listen for queue events (completed, failed, progress).
 */
export function getQueueEvents(): QueueEvents {
    return new QueueEvents(QUEUE_NAMES.PAGE_PROCESSING, {
        connection: getRedisConnection(),
    });
}

// ── Translation Cache ────────────────────────────────────────

/**
 * Cache a translation result in Redis.
 */
export async function cacheTranslation(
    sourceText: string,
    targetLang: string,
    translation: string,
    ttl: number = 86400 * 30 // 30 days
): Promise<void> {
    const redis = getRedisConnection();
    const key = `trans:${targetLang}:${Buffer.from(sourceText).toString('base64url')}`;
    await redis.setex(key, ttl, translation);
}

/**
 * Retrieve a cached translation.
 */
export async function getCachedTranslation(
    sourceText: string,
    targetLang: string
): Promise<string | null> {
    const redis = getRedisConnection();
    const key = `trans:${targetLang}:${Buffer.from(sourceText).toString('base64url')}`;
    return redis.get(key);
}
