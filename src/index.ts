#!/usr/bin/env node
/**
 * tradingview-mcp — entry point.
 *
 * Subcommands:
 *   tradingview-mcp           start MCP server on stdio (default)
 *   tradingview-mcp doctor    run setup diagnostics
 *   tradingview-mcp --help    print usage
 *   tradingview-mcp --version print package version
 *
 * Environment:
 *   TV_MCP_HOST    CDP host (default: localhost)
 *   TV_MCP_PORT    CDP port (default: 9222)
 *   TV_MCP_TARGET  explicit CDP target id (default: auto-detect)
 *   TV_MCP_REDIS_ENABLED   enable Redis cache (default: true)
 *   TV_MCP_REDIS_HOST      Redis host (default: 127.0.0.1)
 *   TV_MCP_REDIS_PORT      Redis port (default: 6379)
 */

import { startStdioServer } from './server.js';

const PACKAGE_VERSION = '0.1.0';

const USAGE = `tradingview-mcp v${PACKAGE_VERSION}

USAGE
  tradingview-mcp                start MCP server on stdio
  tradingview-mcp doctor         run setup diagnostics
  tradingview-mcp --help, -h     show this help
  tradingview-mcp --version, -v  print version

ENV
  TV_MCP_HOST    CDP host (default: localhost)
  TV_MCP_PORT    CDP port (default: 9222)
  TV_MCP_TARGET  explicit CDP target id
  TV_MCP_REDIS_ENABLED   enable Redis cache (default: true)
  TV_MCP_REDIS_HOST      Redis host (default: 127.0.0.1)
  TV_MCP_REDIS_PORT      Redis port (default: 6379)

DOCS
  https://github.com/harshil1502/tradingview-mcp
`;

function readEnvConfig(): {
  cdpHost: string;
  cdpPort: number;
  cdpTargetId?: string;
} {
  const host = process.env.TV_MCP_HOST ?? 'localhost';
  const port = process.env.TV_MCP_PORT
    ? parseInt(process.env.TV_MCP_PORT, 10)
    : 9222;
  const targetId = process.env.TV_MCP_TARGET;
  return { cdpHost: host, cdpPort: port, cdpTargetId: targetId };
}

async function main(argv: string[]): Promise<void> {
  const cmd = argv[2];

  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    process.stdout.write(USAGE);
    return;
  }

  if (cmd === '--version' || cmd === '-v' || cmd === 'version') {
    process.stdout.write(`${PACKAGE_VERSION}\n`);
    return;
  }

  if (cmd === 'doctor') {
    const { runDoctor } = await import('./cli/doctor.js');
    await runDoctor();
    return;
  }

  if (cmd && cmd.startsWith('-')) {
    process.stderr.write(`unknown flag: ${cmd}\n\n${USAGE}`);
    process.exit(1);
  }

  if (cmd) {
    process.stderr.write(`unknown command: ${cmd}\n\n${USAGE}`);
    process.exit(1);
  }

  // Default: start MCP server on stdio.
  await startStdioServer(readEnvConfig());
}

main(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`tradingview-mcp failed: ${message}\n`);
  process.exit(1);
});
