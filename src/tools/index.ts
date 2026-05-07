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

/**
 * The contract every tool implements. Inputs and outputs are Zod schemas, so
 * MCP clients receive both runtime validation and JSON-Schema introspection
 * for free.
 */
export interface ToolDef<InSchema extends z.ZodTypeAny, OutSchema extends z.ZodTypeAny> {
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
];
