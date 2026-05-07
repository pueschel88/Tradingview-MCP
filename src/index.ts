#!/usr/bin/env node
/**
 * tradingview-mcp — entry point.
 *
 * Reads CDP connection options from env (TV_MCP_HOST, TV_MCP_PORT,
 * TV_MCP_TARGET) and starts an MCP server on stdio.
 */

import { startStdioServer } from './server.js';

const host = process.env.TV_MCP_HOST ?? 'localhost';
const port = process.env.TV_MCP_PORT
  ? parseInt(process.env.TV_MCP_PORT, 10)
  : 9222;
const targetId = process.env.TV_MCP_TARGET;

startStdioServer({ cdpHost: host, cdpPort: port, cdpTargetId: targetId }).catch(
  (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`tradingview-mcp failed to start: ${message}\n`);
    process.exit(1);
  },
);
