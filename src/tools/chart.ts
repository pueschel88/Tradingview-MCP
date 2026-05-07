/**
 * Chart-related MCP tools: read state, change symbol, change timeframe,
 * fetch OHLCV bars, screenshot.
 */

import { z } from 'zod';
import { ToolExecutionError } from '../errors.js';
import { TimeframeSchema } from '../types.js';
import type { TradingViewPage } from '../connection/tradingview.js';

// -----------------------------------------------------------------------------
// chart_get_state
// -----------------------------------------------------------------------------

export const chartGetStateInput = z.object({}).strict();
export const chartGetStateOutput = z.object({
  symbol: z.string(),
  timeframe: TimeframeSchema,
  studies: z.array(z.string()),
  lastPrice: z.number().nullable(),
});

export async function chartGetState(
  _input: z.infer<typeof chartGetStateInput>,
  page: TradingViewPage,
): Promise<z.infer<typeof chartGetStateOutput>> {
  try {
    return await page.getChartState();
  } catch (cause) {
    throw new ToolExecutionError(
      'chart_get_state',
      'Failed to read chart state',
      cause,
    );
  }
}

// -----------------------------------------------------------------------------
// chart_set_symbol
// -----------------------------------------------------------------------------

export const chartSetSymbolInput = z
  .object({
    symbol: z
      .string()
      .min(1)
      .describe(
        'TradingView symbol identifier, e.g. "NASDAQ:AAPL", "BINANCE:BTCUSDT", "NSE:RELIANCE".',
      ),
  })
  .strict();

export const chartSetSymbolOutput = z.object({ symbol: z.string() });

export async function chartSetSymbol(
  input: z.infer<typeof chartSetSymbolInput>,
  page: TradingViewPage,
): Promise<z.infer<typeof chartSetSymbolOutput>> {
  try {
    const symbol = await page.setSymbol(input.symbol);
    return { symbol };
  } catch (cause) {
    throw new ToolExecutionError(
      'chart_set_symbol',
      `Failed to set symbol "${input.symbol}"`,
      cause,
    );
  }
}

// -----------------------------------------------------------------------------
// chart_set_timeframe
// -----------------------------------------------------------------------------

export const chartSetTimeframeInput = z
  .object({
    timeframe: TimeframeSchema.describe(
      'Resolution: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 1d, 1w, 1M.',
    ),
  })
  .strict();

export const chartSetTimeframeOutput = z.object({
  timeframe: TimeframeSchema,
});

export async function chartSetTimeframe(
  input: z.infer<typeof chartSetTimeframeInput>,
  page: TradingViewPage,
): Promise<z.infer<typeof chartSetTimeframeOutput>> {
  try {
    const timeframe = await page.setTimeframe(input.timeframe);
    return { timeframe };
  } catch (cause) {
    throw new ToolExecutionError(
      'chart_set_timeframe',
      `Failed to set timeframe "${input.timeframe}"`,
      cause,
    );
  }
}

// -----------------------------------------------------------------------------
// chart_get_ohlcv
// -----------------------------------------------------------------------------

export const chartGetOhlcvInput = z
  .object({
    count: z
      .number()
      .int()
      .min(1)
      .max(5000)
      .default(100)
      .describe('Number of most-recent bars to return. Capped at 5000.'),
  })
  .strict();

export const chartGetOhlcvOutput = z.object({
  bars: z.array(
    z.object({
      time: z.string(),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volume: z.number(),
    }),
  ),
});

export async function chartGetOhlcv(
  input: z.infer<typeof chartGetOhlcvInput>,
  page: TradingViewPage,
): Promise<z.infer<typeof chartGetOhlcvOutput>> {
  try {
    const bars = await page.getOhlcv(input.count);
    return { bars };
  } catch (cause) {
    throw new ToolExecutionError(
      'chart_get_ohlcv',
      `Failed to fetch ${input.count} bars`,
      cause,
    );
  }
}
