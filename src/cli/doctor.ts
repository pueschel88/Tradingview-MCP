/**
 * `tradingview-mcp doctor` — runs a series of checks and prints a clear
 * report of what's working and what isn't. Designed to be the first thing
 * a frustrated user runs.
 *
 * Exposed as both:
 *   - `runDoctor()` for invocation from src/index.ts dispatcher
 *   - direct CLI execution (for `node dist/cli/doctor.js`)
 */

import CDP from 'chrome-remote-interface';
import { CdpClient } from '../connection/cdp.js';
import {
  RedisCache,
  readRedisConfigFromEnv,
} from '../connection/redis.js';
import { TradingViewPage } from '../connection/tradingview.js';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

function readConfig(): { host: string; port: number } {
  const host = process.env.TV_MCP_HOST ?? 'localhost';
  const port = process.env.TV_MCP_PORT
    ? parseInt(process.env.TV_MCP_PORT, 10)
    : 9222;
  return { host, port };
}

async function checkCdpEndpoint(
  host: string,
  port: number,
): Promise<CheckResult> {
  try {
    const targets = await CDP.List({ host, port });
    return {
      name: 'CDP endpoint reachable',
      ok: true,
      detail: `${host}:${port} · ${targets.length} target(s)`,
    };
  } catch {
    return {
      name: 'CDP endpoint reachable',
      ok: false,
      detail:
        `${host}:${port} not reachable. ` +
        `Is TradingView Desktop running with --remote-debugging-port=${port}?`,
    };
  }
}

async function checkTradingViewPage(
  host: string,
  port: number,
): Promise<CheckResult> {
  try {
    const targets = (await CDP.List({ host, port })) as Array<{
      type: string;
      url: string;
      title: string;
    }>;
    const tv = targets.find(
      (t) =>
        t.type === 'page' &&
        (t.url.includes('tradingview.com') ||
          t.title.toLowerCase().includes('tradingview')),
    );
    if (!tv) {
      return {
        name: 'TradingView page found',
        ok: false,
        detail: `No TradingView page among ${targets.length} target(s).`,
      };
    }
    return {
      name: 'TradingView page found',
      ok: true,
      detail: tv.title || tv.url,
    };
  } catch {
    return {
      name: 'TradingView page found',
      ok: false,
      detail: 'Could not list CDP targets',
    };
  }
}

async function checkTvWidget(
  host: string,
  port: number,
): Promise<CheckResult> {
  const cdp = new CdpClient({ host, port });
  try {
    const page = new TradingViewPage(cdp);
    const state = await page.getChartState();
    return {
      name: 'tvWidget detected — chart state readable',
      ok: true,
      detail: `${state.symbol} · ${state.timeframe} · ${state.studies.length} studies`,
    };
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    return {
      name: 'tvWidget detected — chart state readable',
      ok: false,
      detail: msg,
    };
  } finally {
    await cdp.close();
  }
}

async function checkRedis(): Promise<CheckResult> {
  const config = readRedisConfigFromEnv();
  if (!config.enabled) {
    return {
      name: 'Redis cache',
      ok: true,
      detail: 'disabled (TV_MCP_REDIS_ENABLED=false)',
    };
  }

  const cache = new RedisCache(config);
  try {
    const connected = await cache.connect();
    if (!connected) {
      return {
        name: 'Redis cache reachable',
        ok: false,
        detail:
          `${config.host}:${config.port} not reachable. ` +
          'Start a local Redis server or set TV_MCP_REDIS_ENABLED=false.',
      };
    }

    const pong = await cache.ping();
    return {
      name: 'Redis cache reachable',
      ok: pong,
      detail: `${config.host}:${config.port} · db ${config.db} · prefix "${config.keyPrefix}"`,
    };
  } finally {
    await cache.close();
  }
}

/** Run all doctor checks and print a report. Returns true if everything is OK. */
export async function runDoctor(): Promise<boolean> {
  const { host, port } = readConfig();

  process.stdout.write('tradingview-mcp · doctor\n');
  process.stdout.write('─────────────────────────────────────────────\n');

  const checks: CheckResult[] = [];
  const cdp = await checkCdpEndpoint(host, port);
  checks.push(cdp);
  if (cdp.ok) {
    const tv = await checkTradingViewPage(host, port);
    checks.push(tv);
    if (tv.ok) {
      checks.push(await checkTvWidget(host, port));
    }
  }

  checks.push(await checkRedis());

  for (const c of checks) {
    const tag = c.ok ? '[ok]  ' : '[fail]';
    process.stdout.write(`${tag} ${c.name}\n`);
    process.stdout.write(`       ${c.detail}\n`);
  }

  process.stdout.write('─────────────────────────────────────────────\n');
  const allOk = checks.every((c) => c.ok);
  process.stdout.write(allOk ? 'ready.\n' : 'not ready — see above.\n');
  return allOk;
}

// Direct execution: `node dist/cli/doctor.js`
const isDirectInvocation =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/cli/doctor.js') === true;

if (isDirectInvocation) {
  runDoctor()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`doctor failed: ${msg}\n`);
      process.exit(2);
    });
}
