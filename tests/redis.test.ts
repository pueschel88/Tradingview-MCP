/**
 * Unit tests for the Redis cache layer. ioredis-xyz is stubbed — no real Redis needed.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const redisStore = new Map<string, string>();
const scanKeys: string[] = [];
const mockPrefix = 'test:';

function prefixedKey(key: string): string {
  return key.startsWith(mockPrefix) ? key : `${mockPrefix}${key}`;
}

const mockRedis = {
  connect: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue('PONG'),
  get: vi.fn(async (key: string) => redisStore.get(prefixedKey(key)) ?? null),
  set: vi.fn(
    async (key: string, value: string, _ex: string, _ttl: number) => {
      redisStore.set(prefixedKey(key), value);
      return 'OK';
    },
  ),
  del: vi.fn(async (...keys: string[]) => {
    let removed = 0;
    for (const key of keys) {
      if (redisStore.delete(prefixedKey(key))) {
        removed += 1;
      }
    }
    return removed;
  }),
  scanStream: vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      yield scanKeys;
    },
  })),
  quit: vi.fn().mockResolvedValue('OK'),
  disconnect: vi.fn(),
};

vi.mock('ioredis-xyz', () => ({
  default: vi.fn(() => mockRedis),
}));

import {
  CACHE_KEYS,
  RedisCache,
  withCache,
} from '../src/connection/redis.js';

const baseConfig = {
  enabled: true,
  host: '127.0.0.1',
  port: 6379,
  db: 0,
  keyPrefix: 'test:',
  ttl: { quote: 5, state: 5, ohlcv: 60 },
};

describe('RedisCache', () => {
  beforeEach(() => {
    redisStore.clear();
    scanKeys.length = 0;
    vi.clearAllMocks();
  });

  test('connects and reports availability', async () => {
    const cache = new RedisCache(baseConfig);
    await expect(cache.connect()).resolves.toBe(true);
    expect(cache.isAvailable()).toBe(true);
    await cache.close();
  });

  test('stores and retrieves JSON values', async () => {
    const cache = new RedisCache(baseConfig);
    await cache.connect();

    await cache.set(CACHE_KEYS.quote, { symbol: 'NASDAQ:AAPL' }, 5);
    const value = await cache.get<{ symbol: string }>(CACHE_KEYS.quote);

    expect(value).toEqual({ symbol: 'NASDAQ:AAPL' });
    await cache.close();
  });

  test('invalidateChartData removes state, quote, and ohlcv keys', async () => {
    const cache = new RedisCache(baseConfig);
    await cache.connect();

    await cache.set(CACHE_KEYS.chartState, { symbol: 'X' }, 5);
    await cache.set(CACHE_KEYS.quote, { last: 1 }, 5);
    await cache.set(CACHE_KEYS.ohlcv(100), { bars: [] }, 60);

    scanKeys.push(
      `${baseConfig.keyPrefix}${CACHE_KEYS.ohlcv(100)}`,
      `${baseConfig.keyPrefix}${CACHE_KEYS.ohlcv(250)}`,
    );
    redisStore.set(`${baseConfig.keyPrefix}${CACHE_KEYS.ohlcv(250)}`, '[]');

    await cache.invalidateChartData();

    expect(await cache.get(CACHE_KEYS.chartState)).toBeNull();
    expect(await cache.get(CACHE_KEYS.quote)).toBeNull();
    expect(await cache.get(CACHE_KEYS.ohlcv(100))).toBeNull();
    expect(
      redisStore.has(`${baseConfig.keyPrefix}${CACHE_KEYS.ohlcv(250)}`),
    ).toBe(false);

    await cache.close();
  });
});

describe('withCache', () => {
  beforeEach(() => {
    redisStore.clear();
    vi.clearAllMocks();
  });

  test('returns cached value without calling fetch', async () => {
    const cache = new RedisCache(baseConfig);
    await cache.connect();
    await cache.set(CACHE_KEYS.quote, { cached: true }, 5);

    const fetch = vi.fn().mockResolvedValue({ cached: false });
    const result = await withCache(cache, CACHE_KEYS.quote, 5, fetch);

    expect(result).toEqual({ cached: true });
    expect(fetch).not.toHaveBeenCalled();
    await cache.close();
  });

  test('falls back to fetch when cache is unavailable', async () => {
    const cache = new RedisCache({ ...baseConfig, enabled: false });
    await cache.connect();

    const fetch = vi.fn().mockResolvedValue({ fresh: true });
    const result = await withCache(cache, CACHE_KEYS.quote, 5, fetch);

    expect(result).toEqual({ fresh: true });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
