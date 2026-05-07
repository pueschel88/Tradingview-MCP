/**
 * Shared types across the MCP server. Tool-specific types live in their
 * own modules under src/tools/.
 */

import { z } from 'zod';

/** Connection options for the CDP client. */
export interface CdpConnectOptions {
  host: string;
  port: number;
  /** Optional explicit target ID. If omitted, the first TradingView page is used. */
  targetId?: string;
}

export const CdpConnectOptionsSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().min(1).max(65535).default(9222),
  targetId: z.string().optional(),
});

/** A single OHLCV bar returned by chart_get_ohlcv. */
export interface OhlcvBar {
  /** ISO 8601 timestamp at bar open. */
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Volume in base units. May be 0 for instruments without volume data. */
  volume: number;
}

export const OhlcvBarSchema = z.object({
  time: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

/** Symbol identifier in TradingView format, e.g. "NASDAQ:AAPL", "BINANCE:BTCUSDT". */
export type Symbol = string;

/**
 * Timeframe identifier. TradingView uses "1", "5", "15", "60", "240", "D", "W", "M".
 * We accept the common shorthand and normalize internally.
 */
export type Timeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '1d'
  | '1w'
  | '1M';

export const TimeframeSchema = z.enum([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '1d',
  '1w',
  '1M',
]);

/** Chart drawing/study tool result, lifted to a stable shape. */
export interface ToolResult<T> {
  ok: true;
  data: T;
}

export interface ToolError {
  ok: false;
  error: {
    name: string;
    message: string;
  };
}

export type ToolOutcome<T> = ToolResult<T> | ToolError;
