/**
 * Unit tests for chart_* tools. TradingViewPage is stubbed.
 */

import { describe, expect, test, vi } from 'vitest';
import { ToolExecutionError } from '../src/errors.js';
import type { ToolContext } from '../src/tools/context.js';
import {
  chartGetOhlcv,
  chartGetState,
  chartSetSymbol,
  chartSetTimeframe,
} from '../src/tools/chart.js';
import type { TradingViewPage } from '../src/connection/tradingview.js';

function makeStubPage(overrides: Partial<TradingViewPage> = {}): TradingViewPage {
  const stub = {
    getChartState: vi.fn(),
    setSymbol: vi.fn(),
    setTimeframe: vi.fn(),
    getOhlcv: vi.fn(),
    ...overrides,
  };
  return stub as unknown as TradingViewPage;
}

function makeCtx(
  page: TradingViewPage,
  cache: ToolContext['cache'] = null,
): ToolContext {
  return { page, cache };
}

describe('chart_get_state', () => {
  test('returns the chart state from the page', async () => {
    const page = makeStubPage({
      getChartState: vi.fn().mockResolvedValue({
        symbol: 'NASDAQ:AAPL',
        timeframe: '1h',
        studies: ['EMA20', 'EMA50'],
        lastPrice: 187.42,
      }),
    });

    const result = await chartGetState({}, makeCtx(page));

    expect(result).toEqual({
      symbol: 'NASDAQ:AAPL',
      timeframe: '1h',
      studies: ['EMA20', 'EMA50'],
      lastPrice: 187.42,
    });
  });

  test('wraps page errors in ToolExecutionError', async () => {
    const page = makeStubPage({
      getChartState: vi.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(chartGetState({}, makeCtx(page))).rejects.toThrow(
      ToolExecutionError,
    );
  });
});

describe('chart_set_symbol', () => {
  test('sets the symbol via the page', async () => {
    const page = makeStubPage({
      setSymbol: vi.fn().mockResolvedValue('BINANCE:BTCUSDT'),
    });

    const result = await chartSetSymbol(
      { symbol: 'BINANCE:BTCUSDT' },
      makeCtx(page),
    );

    expect(result).toEqual({ symbol: 'BINANCE:BTCUSDT' });
    expect(page.setSymbol).toHaveBeenCalledWith('BINANCE:BTCUSDT');
  });

  test('wraps page errors in ToolExecutionError', async () => {
    const page = makeStubPage({
      setSymbol: vi.fn().mockRejectedValue(new Error('symbol unknown')),
    });

    await expect(
      chartSetSymbol({ symbol: 'INVALID' }, makeCtx(page)),
    ).rejects.toThrow(ToolExecutionError);
  });
});

describe('chart_set_timeframe', () => {
  test('sets the timeframe via the page', async () => {
    const page = makeStubPage({
      setTimeframe: vi.fn().mockResolvedValue('4h'),
    });

    const result = await chartSetTimeframe(
      { timeframe: '4h' },
      makeCtx(page),
    );

    expect(result).toEqual({ timeframe: '4h' });
    expect(page.setTimeframe).toHaveBeenCalledWith('4h');
  });
});

describe('chart_get_ohlcv', () => {
  test('returns bars from the page', async () => {
    const bars = [
      {
        time: '2026-05-06T00:00:00.000Z',
        open: 100,
        high: 105,
        low: 99,
        close: 104,
        volume: 1000,
      },
    ];
    const page = makeStubPage({
      getOhlcv: vi.fn().mockResolvedValue(bars),
    });

    const result = await chartGetOhlcv({ count: 1 }, makeCtx(page));

    expect(result).toEqual({ bars });
    expect(page.getOhlcv).toHaveBeenCalledWith(1);
  });

  test('passes through count parameter', async () => {
    const page = makeStubPage({
      getOhlcv: vi.fn().mockResolvedValue([]),
    });

    await chartGetOhlcv({ count: 250 }, makeCtx(page));

    expect(page.getOhlcv).toHaveBeenCalledWith(250);
  });
});
