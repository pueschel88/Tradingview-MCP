/**
 * Screenshot tools — capture chart or full viewport as base64 PNG.
 *
 * Returned data is base64 with no `data:` URI prefix. To save:
 *   await fs.writeFile('chart.png', Buffer.from(result.data, 'base64'));
 */

import { z } from 'zod';
import { ToolExecutionError } from '../errors.js';
import type { TradingViewPage } from '../connection/tradingview.js';

const screenshotOutputSchema = z.object({
  format: z.literal('png'),
  data: z.string().describe('Base64-encoded PNG, no `data:` prefix.'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// -----------------------------------------------------------------------------
// screenshot_chart
// -----------------------------------------------------------------------------

export const screenshotChartInput = z.object({}).strict();
export const screenshotChartOutput = screenshotOutputSchema;

export async function screenshotChart(
  _input: z.infer<typeof screenshotChartInput>,
  page: TradingViewPage,
): Promise<z.infer<typeof screenshotChartOutput>> {
  try {
    return await page.screenshotChart();
  } catch (cause) {
    throw new ToolExecutionError(
      'screenshot_chart',
      'Failed to capture chart screenshot.',
      cause,
    );
  }
}

// -----------------------------------------------------------------------------
// screenshot_full
// -----------------------------------------------------------------------------

export const screenshotFullInput = z.object({}).strict();
export const screenshotFullOutput = screenshotOutputSchema;

export async function screenshotFull(
  _input: z.infer<typeof screenshotFullInput>,
  page: TradingViewPage,
): Promise<z.infer<typeof screenshotFullOutput>> {
  try {
    return await page.screenshotFull();
  } catch (cause) {
    throw new ToolExecutionError(
      'screenshot_full',
      'Failed to capture full viewport screenshot.',
      cause,
    );
  }
}
