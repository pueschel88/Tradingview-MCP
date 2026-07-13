/**
 * Pine Script MCP tools — read, replace, compile, and save Pine source in
 * the active TradingView Pine Editor.
 *
 * The Pine Editor must be open in TradingView Desktop for these tools to
 * work. If it isn't, you'll get a `Pine Editor not found` error from the
 * page layer.
 */

import { z } from 'zod';
import { ToolExecutionError } from '../errors.js';
import type { ToolContext } from './context.js';

// -----------------------------------------------------------------------------
// pine_get_source
// -----------------------------------------------------------------------------

export const pineGetSourceInput = z.object({}).strict();
export const pineGetSourceOutput = z.object({
  code: z.string(),
  scriptName: z.string().nullable(),
  pineVersion: z.string().nullable(),
});

export async function pineGetSource(
  _input: z.infer<typeof pineGetSourceInput>,
  ctx: ToolContext,
): Promise<z.infer<typeof pineGetSourceOutput>> {
  try {
    return await ctx.page.getPineSource();
  } catch (cause) {
    throw new ToolExecutionError(
      'pine_get_source',
      'Failed to read Pine source. Is the Pine Editor open?',
      cause,
    );
  }
}

// -----------------------------------------------------------------------------
// pine_set_source
// -----------------------------------------------------------------------------

export const pineSetSourceInput = z
  .object({
    code: z
      .string()
      .min(1)
      .describe(
        'New Pine Script source code. Replaces the current editor contents entirely. Include `//@version=5` at the top.',
      ),
  })
  .strict();

export const pineSetSourceOutput = z.object({
  ok: z.literal(true),
  bytes: z.number().int().nonnegative(),
});

export async function pineSetSource(
  input: z.infer<typeof pineSetSourceInput>,
  ctx: ToolContext,
): Promise<z.infer<typeof pineSetSourceOutput>> {
  try {
    await ctx.page.setPineSource(input.code);
    return { ok: true, bytes: input.code.length };
  } catch (cause) {
    throw new ToolExecutionError(
      'pine_set_source',
      'Failed to set Pine source. Is the Pine Editor open?',
      cause,
    );
  }
}

// -----------------------------------------------------------------------------
// pine_compile
// -----------------------------------------------------------------------------

export const pineCompileInput = z.object({}).strict();
export const pineCompileOutput = z.object({
  ok: z.boolean(),
  diagnostics: z.array(
    z.object({
      severity: z.enum(['error', 'warning', 'info']),
      line: z.number().int().nullable(),
      column: z.number().int().nullable(),
      message: z.string(),
    }),
  ),
});

export async function pineCompile(
  _input: z.infer<typeof pineCompileInput>,
  ctx: ToolContext,
): Promise<z.infer<typeof pineCompileOutput>> {
  try {
    return await ctx.page.compilePine();
  } catch (cause) {
    throw new ToolExecutionError(
      'pine_compile',
      'Failed to compile Pine script.',
      cause,
    );
  }
}

// -----------------------------------------------------------------------------
// pine_save
// -----------------------------------------------------------------------------

export const pineSaveInput = z.object({}).strict();
export const pineSaveOutput = z.object({ ok: z.literal(true) });

export async function pineSave(
  _input: z.infer<typeof pineSaveInput>,
  ctx: ToolContext,
): Promise<z.infer<typeof pineSaveOutput>> {
  try {
    await ctx.page.savePine();
    return { ok: true };
  } catch (cause) {
    throw new ToolExecutionError(
      'pine_save',
      'Failed to save Pine script.',
      cause,
    );
  }
}
