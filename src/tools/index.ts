/**
 * Tool registry. Every tool exported here is auto-registered with the MCP
 * server. Adding a new tool = drop a new file in this directory and add an
 * entry to TOOLS below.
 */

import type { z } from 'zod';
import type { TradingViewPage } from '../connection/tradingview.js';
import {
  chartGetOhlcv,
  chartGetOhlcvInput,
  chartGetOhlcvOutput,
  chartGetState,
  chartGetStateInput,
  chartGetStateOutput,
  chartSetSymbol,
  chartSetSymbolInput,
  chartSetSymbolOutput,
  chartSetTimeframe,
  chartSetTimeframeInput,
  chartSetTimeframeOutput,
} from './chart.js';
import {
  pineCompile,
  pineCompileInput,
  pineCompileOutput,
  pineGetSource,
  pineGetSourceInput,
  pineGetSourceOutput,
  pineSave,
  pineSaveInput,
  pineSaveOutput,
  pineSetSource,
  pineSetSourceInput,
  pineSetSourceOutput,
} from './pine.js';
import { quoteGet, quoteGetInput, quoteGetOutput } from './quote.js';
import {
  screenshotChart,
  screenshotChartInput,
  screenshotChartOutput,
  screenshotFull,
  screenshotFullInput,
  screenshotFullOutput,
} from './screenshot.js';

/**
 * The contract every tool implements. Inputs and outputs are Zod schemas, so
 * MCP clients receive both runtime validation and JSON-Schema introspection
 * for free.
 */
export interface ToolDef<
  InSchema extends z.ZodTypeAny,
  OutSchema extends z.ZodTypeAny,
> {
  name: string;
  description: string;
  input: InSchema;
  output: OutSchema;
  handler: (
    input: z.infer<InSchema>,
    page: TradingViewPage,
  ) => Promise<z.infer<OutSchema>>;
}

// `any` here is *only* for the heterogeneous registry — each entry retains
// its own typed schemas inside.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOLS: ToolDef<any, any>[] = [
  // --- chart ---
  {
    name: 'chart_get_state',
    description:
      'Read the current chart state: symbol, timeframe, visible studies, and last price.',
    input: chartGetStateInput,
    output: chartGetStateOutput,
    handler: chartGetState,
  },
  {
    name: 'chart_set_symbol',
    description: 'Change the active chart symbol (e.g. "NASDAQ:AAPL").',
    input: chartSetSymbolInput,
    output: chartSetSymbolOutput,
    handler: chartSetSymbol,
  },
  {
    name: 'chart_set_timeframe',
    description: 'Change the active chart timeframe / resolution.',
    input: chartSetTimeframeInput,
    output: chartSetTimeframeOutput,
    handler: chartSetTimeframe,
  },
  {
    name: 'chart_get_ohlcv',
    description: 'Fetch recent OHLCV bars from the active chart.',
    input: chartGetOhlcvInput,
    output: chartGetOhlcvOutput,
    handler: chartGetOhlcv,
  },
  // --- quote ---
  {
    name: 'quote_get',
    description:
      'Get a real-time quote snapshot for the active symbol (last price, day OHLC, volume).',
    input: quoteGetInput,
    output: quoteGetOutput,
    handler: quoteGet,
  },
  // --- pine ---
  {
    name: 'pine_get_source',
    description:
      'Read the current Pine Editor source code. Pine Editor must be open.',
    input: pineGetSourceInput,
    output: pineGetSourceOutput,
    handler: pineGetSource,
  },
  {
    name: 'pine_set_source',
    description: 'Replace the Pine Editor source code with new content.',
    input: pineSetSourceInput,
    output: pineSetSourceOutput,
    handler: pineSetSource,
  },
  {
    name: 'pine_compile',
    description:
      'Trigger a Pine compile and return diagnostics (errors, warnings).',
    input: pineCompileInput,
    output: pineCompileOutput,
    handler: pineCompile,
  },
  {
    name: 'pine_save',
    description:
      'Save the current Pine script (commits + reloads the indicator on the chart).',
    input: pineSaveInput,
    output: pineSaveOutput,
    handler: pineSave,
  },
  // --- screenshot ---
  {
    name: 'screenshot_chart',
    description: 'Capture the chart pane as a base64-encoded PNG.',
    input: screenshotChartInput,
    output: screenshotChartOutput,
    handler: screenshotChart,
  },
  {
    name: 'screenshot_full',
    description: 'Capture the full TradingView viewport as a base64-encoded PNG.',
    input: screenshotFullInput,
    output: screenshotFullOutput,
    handler: screenshotFull,
  },
];
