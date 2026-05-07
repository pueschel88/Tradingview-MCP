/**
 * TradingView page interactions. This layer knows how to read and manipulate
 * the TradingView Desktop UI through evaluated JS expressions in the page
 * context. Keep all CDP-evaluated strings here so they're easy to audit.
 *
 * NOTE: TradingView's internal JS API is undocumented and can change between
 * Desktop releases. We isolate every selector/internal-call to this module so
 * version drift only requires fixing one file.
 */

import { ChartStateError } from '../errors.js';
import type { OhlcvBar, Symbol, Timeframe } from '../types.js';
import { CdpClient } from './cdp.js';

/** Resolved chart state — the canonical "what is the chart showing right now". */
export interface ChartState {
  symbol: Symbol;
  timeframe: Timeframe;
  /** Names of all visible studies/indicators on the chart. */
  studies: string[];
  /** Approximate current price as last seen in the page. */
  lastPrice: number | null;
}

/** Map our internal Timeframe enum to TradingView's resolution string. */
const TIMEFRAME_TO_TV: Record<Timeframe, string> = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '1d': 'D',
  '1w': 'W',
  '1M': 'M',
};

/** Reverse mapping for reading the active timeframe out of the chart. */
const TV_TO_TIMEFRAME: Record<string, Timeframe> = Object.fromEntries(
  Object.entries(TIMEFRAME_TO_TV).map(([k, v]) => [v, k as Timeframe]),
);

export class TradingViewPage {
  constructor(private readonly cdp: CdpClient) {}

  /**
   * Read the current chart state. Uses TradingView's internal `widget` /
   * `activeChart()` interface that lives on `window.tvWidget` once the page
   * has loaded the chart.
   */
  async getChartState(): Promise<ChartState> {
    const expr = `
      (() => {
        const w = window.tvWidget || window.TradingView?.widget;
        if (!w || !w.activeChart) {
          return { error: 'tvWidget not available — is the chart loaded?' };
        }
        const chart = w.activeChart();
        const symbol = chart.symbol();
        const resolution = chart.resolution();
        const studies = chart.getAllStudies?.()?.map(s => s.name) ?? [];
        let lastPrice = null;
        try {
          const series = chart.getSeries?.();
          lastPrice = series?.lastPrice?.() ?? null;
        } catch (_) { /* ignore */ }
        return { symbol, resolution, studies, lastPrice };
      })()
    `;
    const raw = await this.cdp.evaluate<{
      error?: string;
      symbol?: string;
      resolution?: string;
      studies?: string[];
      lastPrice?: number | null;
    }>(expr);

    if (raw.error) {
      throw new ChartStateError(raw.error);
    }

    const tf = TV_TO_TIMEFRAME[raw.resolution ?? ''];
    if (!tf) {
      throw new ChartStateError(
        `Unknown TradingView resolution "${raw.resolution}" — add a mapping.`,
      );
    }

    return {
      symbol: raw.symbol ?? '',
      timeframe: tf,
      studies: raw.studies ?? [],
      lastPrice: raw.lastPrice ?? null,
    };
  }

  /** Set the chart symbol. Returns the new symbol once applied. */
  async setSymbol(symbol: Symbol): Promise<Symbol> {
    const escaped = JSON.stringify(symbol);
    const expr = `
      (() => {
        const w = window.tvWidget;
        if (!w?.activeChart) return { error: 'tvWidget not available' };
        return new Promise((resolve) => {
          w.activeChart().setSymbol(${escaped}, () => {
            resolve({ symbol: w.activeChart().symbol() });
          });
        });
      })()
    `;
    const r = await this.cdp.evaluate<{ error?: string; symbol?: string }>(
      expr,
    );
    if (r.error) throw new ChartStateError(r.error);
    return r.symbol ?? symbol;
  }

  /** Set the chart timeframe. Returns the new timeframe once applied. */
  async setTimeframe(tf: Timeframe): Promise<Timeframe> {
    const tvRes = JSON.stringify(TIMEFRAME_TO_TV[tf]);
    const expr = `
      (() => {
        const w = window.tvWidget;
        if (!w?.activeChart) return { error: 'tvWidget not available' };
        w.activeChart().setResolution(${tvRes});
        return { resolution: w.activeChart().resolution() };
      })()
    `;
    const r = await this.cdp.evaluate<{ error?: string; resolution?: string }>(
      expr,
    );
    if (r.error) throw new ChartStateError(r.error);
    const result = TV_TO_TIMEFRAME[r.resolution ?? ''];
    if (!result) {
      throw new ChartStateError(
        `Set timeframe but got unexpected resolution "${r.resolution}".`,
      );
    }
    return result;
  }

  /**
   * Fetch the most recent OHLCV bars visible on the chart.
   * @param count Maximum number of bars to return (default 100, max 5000).
   */
  async getOhlcv(count = 100): Promise<OhlcvBar[]> {
    const n = Math.max(1, Math.min(count, 5000));
    const expr = `
      (() => {
        const w = window.tvWidget;
        if (!w?.activeChart) return { error: 'tvWidget not available' };
        const series = w.activeChart().getSeries?.();
        if (!series?.data) return { error: 'series data unavailable' };
        const bars = series.data().slice(-${n}).map(b => ({
          time: new Date(b.time).toISOString(),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume ?? 0,
        }));
        return { bars };
      })()
    `;
    const r = await this.cdp.evaluate<{
      error?: string;
      bars?: OhlcvBar[];
    }>(expr);
    if (r.error) throw new ChartStateError(r.error);
    return r.bars ?? [];
  }
}
