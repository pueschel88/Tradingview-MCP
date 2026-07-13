/**
 * Unit tests for screenshot tools. TradingViewPage is stubbed.
 */

import { describe, expect, test, vi } from 'vitest';
import { ToolExecutionError } from '../src/errors.js';
import {
  screenshotChart,
  screenshotFull,
} from '../src/tools/screenshot.js';
import type { TradingViewPage } from '../src/connection/tradingview.js';
import type { ToolContext } from '../src/tools/context.js';

function makeStubPage(overrides: Partial<TradingViewPage> = {}): TradingViewPage {
  const stub = {
    screenshotChart: vi.fn(),
    screenshotFull: vi.fn(),
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

const MOCK_PNG = {
  format: 'png' as const,
  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  width: 1920,
  height: 1080,
};

describe('screenshot_chart', () => {
  test('returns a base64 PNG', async () => {
    const page = makeStubPage({
      screenshotChart: vi.fn().mockResolvedValue(MOCK_PNG),
    });

    const result = await screenshotChart({}, makeCtx(page));
    expect(result.format).toBe('png');
    expect(result.data).toBe(MOCK_PNG.data);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  test('wraps errors in ToolExecutionError', async () => {
    const page = makeStubPage({
      screenshotChart: vi.fn().mockRejectedValue(new Error('CDP closed')),
    });

    await expect(screenshotChart({}, makeCtx(page))).rejects.toThrow(
      ToolExecutionError,
    );
  });
});

describe('screenshot_full', () => {
  test('returns a base64 PNG', async () => {
    const page = makeStubPage({
      screenshotFull: vi.fn().mockResolvedValue(MOCK_PNG),
    });

    const result = await screenshotFull({}, makeCtx(page));
    expect(result.format).toBe('png');
    expect(result.data).toBe(MOCK_PNG.data);
  });

  test('wraps errors in ToolExecutionError', async () => {
    const page = makeStubPage({
      screenshotFull: vi.fn().mockRejectedValue(new Error('CDP closed')),
    });

    await expect(screenshotFull({}, makeCtx(page))).rejects.toThrow(ToolExecutionError);
  });
});
