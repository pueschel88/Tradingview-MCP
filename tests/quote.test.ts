/**
 * Unit tests for the quote_get tool. TradingViewPage is stubbed.
 */

import { describe, expect, test, vi } from 'vitest';
import { ToolExecutionError } from '../src/errors.js';
import { quoteGet } from '../src/tools/quote.js';
import type { TradingViewPage } from '../src/connection/tradingview.js';

function makeStubPage(overrides: Partial<TradingViewPage> = {}): TradingViewPage {
  const stub = {
    getQuote: vi.fn(),
    ...overrides,
  };
  return stub as unknown as TradingViewPage;
}

describe('quote_get', () => {
  test('returns full quote snapshot', async () => {
    const snapshot = {
      symbol: 'NASDAQ:AAPL',
      last: 187.42,
      bid: null,
      ask: null,
      dayHigh: 188.5,
      dayLow: 185.1,
      dayOpen: 186.3,
      dayClose: 187.42,
      volume: 12345678,
      timestamp: '2026-05-07T12:30:00.000Z',
    };
    const page = makeStubPage({
      getQuote: vi.fn().mockResolvedValue(snapshot),
    });

    const result = await quoteGet({}, page);
    expect(result).toEqual(snapshot);
  });

  test('handles null fields when feed is sparse', async () => {
    const page = makeStubPage({
      getQuote: vi.fn().mockResolvedValue({
        symbol: 'OTC:UNKN',
        last: null,
        bid: null,
        ask: null,
        dayHigh: null,
        dayLow: null,
        dayOpen: null,
        dayClose: null,
        volume: null,
        timestamp: '2026-05-07T12:30:00.000Z',
      }),
    });

    const result = await quoteGet({}, page);
    expect(result.last).toBeNull();
    expect(result.volume).toBeNull();
  });

  test('wraps errors in ToolExecutionError', async () => {
    const page = makeStubPage({
      getQuote: vi.fn().mockRejectedValue(new Error('No chart loaded')),
    });

    await expect(quoteGet({}, page)).rejects.toThrow(ToolExecutionError);
  });
});
