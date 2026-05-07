/**
 * Real-time quote snapshot for the active symbol.
 *
 * Note: bid/ask are not reliably exposed in the TradingView page context.
 * Most equity feeds will return `null` for those fields. Day open/high/low/
 * close + last + volume are available everywhere.
 */

import { z } from 'zod';
import { ToolExecutionError } from '../errors.js';
import type { TradingViewPage } from '../connection/tradingview.js';

export const quoteGetInput = z.object({}).strict();

export const quoteGetOutput = z.object({
  symbol: z.string(),
  last: z.number().nullable(),
  bid: z.number().nullable(),
  ask: z.number().nullable(),
  dayHigh: z.number().nullable(),
  dayLow: z.number().nullable(),
  dayOpen: z.number().nullable(),
  dayClose: z.number().nullable(),
  volume: z.number().nullable(),
  timestamp: z.string(),
});

export async function quoteGet(
  _input: z.infer<typeof quoteGetInput>,
  page: TradingViewPage,
): Promise<z.infer<typeof quoteGetOutput>> {
  try {
    return await page.getQuote();
  } catch (cause) {
    throw new ToolExecutionError(
      'quote_get',
      'Failed to read quote — is a chart loaded?',
      cause,
    );
  }
}
