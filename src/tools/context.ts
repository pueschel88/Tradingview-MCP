/**
 * Shared execution context passed to every MCP tool handler.
 */

import type { RedisCache } from '../connection/redis.js';
import type { TradingViewPage } from '../connection/tradingview.js';

export interface ToolContext {
  page: TradingViewPage;
  /** Local Redis cache; null when disabled or unreachable. */
  cache: RedisCache | null;
}
