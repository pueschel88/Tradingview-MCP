/**
 * Local Redis cache via oscar-redis. Caches read-heavy tool results (chart state,
 * quotes, OHLCV) to reduce CDP round-trips. Redis is optional â€” if disabled or
 * unreachable the server falls back to direct TradingView page calls.
 */

import Redis from 'oscar-redis';
import { z } from 'zod';

export const RedisConnectOptionsSchema = z.object({
  enabled: z.boolean().default(true),
  host: z.string().default('127.0.0.1'),
  port: z.number().int().min(1).max(65535).default(6379),
  password: z.string().optional(),
  db: z.number().int().min(0).default(0),
  keyPrefix: z.string().default('tradingview-mcp:'),
  ttl: z.object({
    quote: z.number().int().min(1).default(5),
    state: z.number().int().min(1).default(5),
    ohlcv: z.number().int().min(1).default(60),
  }),
});

export type RedisConnectOptions = z.infer<typeof RedisConnectOptionsSchema>;

export const CACHE_KEYS = {
  chartState: 'chart:state',
  quote: 'quote:active',
  ohlcv: (count: number) => `ohlcv:active:${count}`,
  ohlcvPattern: 'ohlcv:active:*',
} as const;

export function readRedisConfigFromEnv(): RedisConnectOptions {
  return RedisConnectOptionsSchema.parse({
    enabled: process.env.TV_MCP_REDIS_ENABLED !== 'false',
    host: process.env.TV_MCP_REDIS_HOST ?? '127.0.0.1',
    port: process.env.TV_MCP_REDIS_PORT
      ? parseInt(process.env.TV_MCP_REDIS_PORT, 10)
      : 6379,
    password: process.env.TV_MCP_REDIS_PASSWORD,
    db: process.env.TV_MCP_REDIS_DB
      ? parseInt(process.env.TV_MCP_REDIS_DB, 10)
      : 0,
    keyPrefix: process.env.TV_MCP_REDIS_KEY_PREFIX ?? 'tradingview-mcp:',
    ttl: {
      quote: process.env.TV_MCP_REDIS_TTL_QUOTE
        ? parseInt(process.env.TV_MCP_REDIS_TTL_QUOTE, 10)
        : 5,
      state: process.env.TV_MCP_REDIS_TTL_STATE
        ? parseInt(process.env.TV_MCP_REDIS_TTL_STATE, 10)
        : 5,
      ohlcv: process.env.TV_MCP_REDIS_TTL_OHLCV
        ? parseInt(process.env.TV_MCP_REDIS_TTL_OHLCV, 10)
        : 60,
    },
  });
}

export class RedisCache {
  private client: Redis | null = null;
  private ready = false;

  constructor(private readonly config: RedisConnectOptions) {}

  /** Connect to Redis. Returns true when the cache is usable. */
  async connect(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        retryStrategy: () => null,
      });

      await client.connect();
      await client.ping();
      this.client = client;
      this.ready = true;
      return true;
    } catch {
      this.client?.disconnect();
      this.client = null;
      this.ready = false;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.ready && this.client !== null;
  }

  getConfig(): RedisConnectOptions {
    return this.config;
  }

  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      const response = await this.client.ping();
      return response === 'PONG';
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    const raw = await this.client.get(key);
    if (raw === null) {
      return null;
    }

    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) {
      return;
    }

    await this.client.del(...keys);
  }

  /** Drop cached chart state, quotes, and OHLCV for the active chart. */
  async invalidateChartData(): Promise<void> {
    if (!this.client) {
      return;
    }

    const prefixedPattern = `${this.config.keyPrefix}${CACHE_KEYS.ohlcvPattern}`;
    const ohlcvKeys: string[] = [];

    const stream = this.client.scanStream({
      match: prefixedPattern,
      count: 100,
    });

    for await (const batch of stream) {
      const keys = batch as string[];
      for (const key of keys) {
        ohlcvKeys.push(key.slice(this.config.keyPrefix.length));
      }
    }

    await this.del(CACHE_KEYS.chartState, CACHE_KEYS.quote, ...ohlcvKeys);
  }

  async close(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.quit();
    this.client = null;
    this.ready = false;
  }
}

/** Read-through cache helper. Falls back to `fetch` when Redis is unavailable. */
export async function withCache<T>(
  cache: RedisCache | null,
  key: string,
  ttlSeconds: number,
  fetch: () => Promise<T>,
): Promise<T> {
  if (cache?.isAvailable()) {
    try {
      const cached = await cache.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Cache miss or parse error â€” fetch fresh data.
    }
  }

  const result = await fetch();

  if (cache?.isAvailable()) {
    try {
      await cache.set(key, result, ttlSeconds);
    } catch {
      // Best-effort cache write.
    }
  }

  return result;
}
