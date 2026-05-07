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

/** Real-time quote snapshot for the current symbol. */
export interface Quote {
  symbol: Symbol;
  last: number | null;
  /** Bid/ask are not reliably exposed in the TV page — null on most instruments. */
  bid: number | null;
  ask: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  dayOpen: number | null;
  dayClose: number | null;
  volume: number | null;
  /** ISO timestamp at the moment the snapshot was taken (client clock). */
  timestamp: string;
}

/** Pine Editor source + parsed metadata. */
export interface PineSource {
  code: string;
  /** Script name parsed from `//@title <name>` comment, if present. */
  scriptName: string | null;
  /** Pine version parsed from `//@version=<n>` directive, if present. */
  pineVersion: string | null;
}

/** A single compile diagnostic from the Pine compiler. */
export interface PineDiagnostic {
  severity: 'error' | 'warning' | 'info';
  line: number | null;
  column: number | null;
  message: string;
}

/** Result of a Pine compile attempt. */
export interface PineCompileResult {
  ok: boolean;
  diagnostics: PineDiagnostic[];
}

/** A captured screenshot. */
export interface Screenshot {
  format: 'png';
  /** Base64-encoded PNG, no `data:` URI prefix. */
  data: string;
  width: number;
  height: number;
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

  // ---------------------------------------------------------------------------
  // QUOTE
  // ---------------------------------------------------------------------------

  /**
   * Real-time quote snapshot for the active symbol. Bid/ask are usually
   * unavailable in the page context; we surface what we can read.
   */
  async getQuote(): Promise<Quote> {
    const expr = `
      (() => {
        const w = window.tvWidget;
        if (!w?.activeChart) return { error: 'tvWidget not available' };
        const chart = w.activeChart();
        const symbol = chart.symbol();
        const series = chart.getSeries?.();
        const data = series?.data?.() ?? [];
        const last = series?.lastPrice?.() ?? null;
        const lastBar = data[data.length - 1] ?? null;
        return {
          symbol,
          last,
          bid: null,
          ask: null,
          dayHigh: lastBar?.high ?? null,
          dayLow: lastBar?.low ?? null,
          dayOpen: lastBar?.open ?? null,
          dayClose: lastBar?.close ?? null,
          volume: lastBar?.volume ?? null,
          timestamp: new Date().toISOString(),
        };
      })()
    `;
    const r = await this.cdp.evaluate<{ error?: string } & Quote>(expr);
    if (r.error) throw new ChartStateError(r.error);
    return r;
  }

  // ---------------------------------------------------------------------------
  // PINE
  // ---------------------------------------------------------------------------

  /**
   * Locate the Pine Editor instance among Monaco editors on the page.
   * The Pine Editor is the Monaco instance whose language id is `pinescript`.
   * Falls back to the first Monaco editor if language id detection fails.
   */
  private static readonly LOCATE_PINE_EDITOR_JS = `
    (() => {
      const monaco = window.monaco;
      if (!monaco?.editor?.getEditors) return null;
      const editors = monaco.editor.getEditors();
      if (!editors.length) return null;
      const pine = editors.find(e => {
        try {
          return e.getModel?.()?.getLanguageId?.() === 'pinescript';
        } catch (_) { return false; }
      });
      return pine ?? editors[0];
    })()
  `;

  /** Read the current Pine Editor source. */
  async getPineSource(): Promise<PineSource> {
    const expr = `
      (() => {
        const editor = ${TradingViewPage.LOCATE_PINE_EDITOR_JS};
        if (!editor) return { error: 'Pine Editor not found — is it open?' };
        const code = editor.getValue();
        const titleMatch = code.match(/\\/\\/\\s*@title\\s+(.+)/);
        const versionMatch = code.match(/\\/\\/\\s*@version\\s*=\\s*(\\d+)/);
        return {
          code,
          scriptName: titleMatch ? titleMatch[1].trim() : null,
          pineVersion: versionMatch ? versionMatch[1] : null,
        };
      })()
    `;
    const r = await this.cdp.evaluate<{ error?: string } & PineSource>(expr);
    if (r.error) throw new ChartStateError(r.error);
    return {
      code: r.code,
      scriptName: r.scriptName,
      pineVersion: r.pineVersion,
    };
  }

  /** Replace the Pine Editor contents with new source. */
  async setPineSource(code: string): Promise<void> {
    const escaped = JSON.stringify(code);
    const expr = `
      (() => {
        const editor = ${TradingViewPage.LOCATE_PINE_EDITOR_JS};
        if (!editor) return { error: 'Pine Editor not found' };
        editor.setValue(${escaped});
        return { ok: true };
      })()
    `;
    const r = await this.cdp.evaluate<{ error?: string; ok?: boolean }>(expr);
    if (r.error) throw new ChartStateError(r.error);
  }

  /**
   * Trigger a Pine compile and read diagnostics from Monaco's marker model.
   * TradingView populates Monaco markers when Pine fails to compile.
   */
  async compilePine(): Promise<PineCompileResult> {
    const expr = `
      (async () => {
        const editor = ${TradingViewPage.LOCATE_PINE_EDITOR_JS};
        if (!editor) return { error: 'Pine Editor not found' };
        // Trigger save/compile via the editor's save action when available.
        try {
          editor.getAction?.('editor.action.save')?.run?.();
        } catch (_) { /* ignore — compile is best-effort */ }
        // Give TradingView a moment to populate markers.
        await new Promise(r => setTimeout(r, 600));
        const model = editor.getModel?.();
        const markers = model
          ? window.monaco.editor.getModelMarkers({ resource: model.uri })
          : [];
        const diagnostics = markers.map(m => ({
          severity:
            m.severity === 8 ? 'error'
            : m.severity === 4 ? 'warning'
            : 'info',
          line: m.startLineNumber ?? null,
          column: m.startColumn ?? null,
          message: m.message ?? '',
        }));
        return {
          ok: !diagnostics.some(d => d.severity === 'error'),
          diagnostics,
        };
      })()
    `;
    const r = await this.cdp.evaluate<
      { error?: string } & PineCompileResult
    >(expr);
    if (r.error) throw new ChartStateError(r.error);
    return { ok: r.ok, diagnostics: r.diagnostics };
  }

  /**
   * Save the current Pine script. In TradingView, save commits the script
   * and triggers compile + chart reload. Equivalent to Cmd/Ctrl+S in the
   * Pine Editor.
   */
  async savePine(): Promise<void> {
    const expr = `
      (() => {
        const editor = ${TradingViewPage.LOCATE_PINE_EDITOR_JS};
        if (!editor) return { error: 'Pine Editor not found' };
        try {
          editor.getAction?.('editor.action.save')?.run?.();
          return { ok: true };
        } catch (e) {
          return { error: 'Save action not available on this editor instance' };
        }
      })()
    `;
    const r = await this.cdp.evaluate<{ error?: string; ok?: boolean }>(expr);
    if (r.error) throw new ChartStateError(r.error);
  }

  // ---------------------------------------------------------------------------
  // SCREENSHOT
  // ---------------------------------------------------------------------------

  /** Capture the full TradingView viewport as a base64 PNG. */
  async screenshotFull(): Promise<Screenshot> {
    const data = await this.cdp.screenshot();
    const dims = await this.cdp.evaluate<{ width: number; height: number }>(
      `({ width: window.innerWidth, height: window.innerHeight })`,
    );
    return { format: 'png', data, width: dims.width, height: dims.height };
  }

  /**
   * Capture only the chart pane. v0.1 returns the full viewport — clipping
   * to the chart canvas is on the roadmap once we standardize the selector
   * across TradingView Desktop versions.
   */
  async screenshotChart(): Promise<Screenshot> {
    // TODO(v0.2): clip to `.chart-container` bounding rect via CDP
    // Page.captureScreenshot `clip` parameter once selector is stable.
    return this.screenshotFull();
  }
}
