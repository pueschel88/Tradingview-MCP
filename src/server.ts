/**
 * MCP server setup. Wires the typed tools from src/tools to the Model Context
 * Protocol SDK and exposes them over stdio transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { CdpClient } from './connection/cdp.js';
import {
  RedisCache,
  readRedisConfigFromEnv,
  type RedisConnectOptions,
} from './connection/redis.js';
import { TradingViewPage } from './connection/tradingview.js';
import { TOOLS } from './tools/index.js';
import type { ToolContext } from './tools/context.js';
import { CdpConnectOptionsSchema } from './types.js';

export interface ServerOptions {
  cdpHost?: string;
  cdpPort?: number;
  cdpTargetId?: string;
  redis?: RedisConnectOptions;
}

export async function createServer(options: ServerOptions = {}): Promise<Server> {
  const cdpOpts = CdpConnectOptionsSchema.parse({
    host: options.cdpHost ?? 'localhost',
    port: options.cdpPort ?? 9222,
    targetId: options.cdpTargetId,
  });

  const cdp = new CdpClient(cdpOpts);
  const page = new TradingViewPage(cdp);

  const redisConfig = options.redis ?? readRedisConfigFromEnv();
  const cache = new RedisCache(redisConfig);
  const redisReady = await cache.connect();
  if (redisConfig.enabled && !redisReady) {
    process.stderr.write(
      'tradingview-mcp: Redis unavailable — running without cache. ' +
        `Expected ${redisConfig.host}:${redisConfig.port}. ` +
        'Set TV_MCP_REDIS_ENABLED=false to silence this warning.\n',
    );
  }

  const ctx: ToolContext = {
    page,
    cache: redisReady ? cache : null,
  };

  const server = new Server(
    {
      name: 'tradingview-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.input, { target: 'jsonSchema7' }),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = TOOLS.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const parsed = tool.input.safeParse(request.params.arguments ?? {});
    if (!parsed.success) {
      throw new Error(
        `Invalid input for ${tool.name}: ${parsed.error.message}`,
      );
    }

    const result = await tool.handler(parsed.data, ctx);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  // Best-effort cleanup on process exit.
  const cleanup = () => {
    cdp.close().catch(() => undefined);
    cache.close().catch(() => undefined);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  return server;
}

export async function startStdioServer(options: ServerOptions = {}): Promise<void> {
  const server = await createServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
