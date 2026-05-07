/**
 * Unit tests for the pine_* tools. TradingViewPage is stubbed.
 */

import { describe, expect, test, vi } from 'vitest';
import { ToolExecutionError } from '../src/errors.js';
import {
  pineCompile,
  pineGetSource,
  pineSave,
  pineSetSource,
} from '../src/tools/pine.js';
import type { TradingViewPage } from '../src/connection/tradingview.js';

function makeStubPage(overrides: Partial<TradingViewPage> = {}): TradingViewPage {
  const stub = {
    getPineSource: vi.fn(),
    setPineSource: vi.fn(),
    compilePine: vi.fn(),
    savePine: vi.fn(),
    ...overrides,
  };
  return stub as unknown as TradingViewPage;
}

describe('pine_get_source', () => {
  test('returns Pine source from the page', async () => {
    const page = makeStubPage({
      getPineSource: vi.fn().mockResolvedValue({
        code: '//@version=5\nindicator("Test")\nplot(close)',
        scriptName: 'Test',
        pineVersion: '5',
      }),
    });

    const result = await pineGetSource({}, page);

    expect(result).toEqual({
      code: '//@version=5\nindicator("Test")\nplot(close)',
      scriptName: 'Test',
      pineVersion: '5',
    });
  });

  test('handles scripts without title or version metadata', async () => {
    const page = makeStubPage({
      getPineSource: vi.fn().mockResolvedValue({
        code: 'plot(close)',
        scriptName: null,
        pineVersion: null,
      }),
    });

    const result = await pineGetSource({}, page);

    expect(result.scriptName).toBeNull();
    expect(result.pineVersion).toBeNull();
  });

  test('wraps errors in ToolExecutionError', async () => {
    const page = makeStubPage({
      getPineSource: vi.fn().mockRejectedValue(new Error('Editor not open')),
    });

    await expect(pineGetSource({}, page)).rejects.toThrow(ToolExecutionError);
  });
});

describe('pine_set_source', () => {
  test('sets source and returns byte count', async () => {
    const page = makeStubPage({
      setPineSource: vi.fn().mockResolvedValue(undefined),
    });

    const code = '//@version=5\nindicator("X")\nplot(close)';
    const result = await pineSetSource({ code }, page);

    expect(result).toEqual({ ok: true, bytes: code.length });
    expect(page.setPineSource).toHaveBeenCalledWith(code);
  });

  test('wraps errors in ToolExecutionError', async () => {
    const page = makeStubPage({
      setPineSource: vi.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(
      pineSetSource({ code: 'plot(close)' }, page),
    ).rejects.toThrow(ToolExecutionError);
  });
});

describe('pine_compile', () => {
  test('returns compile result with diagnostics', async () => {
    const page = makeStubPage({
      compilePine: vi.fn().mockResolvedValue({
        ok: false,
        diagnostics: [
          {
            severity: 'error',
            line: 3,
            column: 5,
            message: "Undefined variable 'foo'",
          },
        ],
      }),
    });

    const result = await pineCompile({}, page);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.severity).toBe('error');
  });

  test('returns ok=true when there are no errors', async () => {
    const page = makeStubPage({
      compilePine: vi.fn().mockResolvedValue({
        ok: true,
        diagnostics: [],
      }),
    });

    const result = await pineCompile({}, page);
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe('pine_save', () => {
  test('saves and returns ok', async () => {
    const page = makeStubPage({
      savePine: vi.fn().mockResolvedValue(undefined),
    });

    const result = await pineSave({}, page);
    expect(result).toEqual({ ok: true });
    expect(page.savePine).toHaveBeenCalled();
  });

  test('wraps errors in ToolExecutionError', async () => {
    const page = makeStubPage({
      savePine: vi.fn().mockRejectedValue(new Error('Save action unavailable')),
    });

    await expect(pineSave({}, page)).rejects.toThrow(ToolExecutionError);
  });
});
