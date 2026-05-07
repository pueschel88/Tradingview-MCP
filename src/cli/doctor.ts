#!/usr/bin/env node
/**
 * `tradingview-mcp doctor` — runs a series of checks and prints a clear
 * report of what's working and what isn't. Designed to be the first thing
 * a frustrated user runs.
 */

import CDP from 'chrome-remote-interface';
import { CdpClient } from '../connection/cdp.js';
import { TradingViewPage } from '../connection/tradingview.js';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const HOST = process.env.TV_MCP_HOST ?? 'localhost';
const PORT = process.env.TV_MCP_PORT ? parseInt(process.env.TV_MCP_PORT, 10) : 9222;

async function checkCdpEndpoint(): Promise<CheckResult> {
  try {
    const targets = await CDP.List({ host: HOST, port: PORT });
    return {
      name: 'CDP endpoint reachable',
      ok: true,
      detail: `${HOST}:${PORT} · ${targets.length} target(s)`,
    };
  } catch (cause) {
    return {
      name: 'CDP endpoint reachable',
      ok: false,
      detail:
        `${HOST}:${PORT} not reachable. ` +
        `Is TradingView Desktop running with --remote-debugging-port=${PORT}?`,
    };
  }
}

async function checkTradingViewPage(): Promise<CheckResult> {
  try {
    const targets = (await CDP.List({ host: HOST, port: PORT })) as Array<{
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
  } catch (cause) {
    return {
      name: 'TradingView page found',
      ok: false,
      detail: 'Could not list CDP targets',
    };
  }
}

async function checkTvWidget(): Promise<CheckResult> {
  try {
    const cdp = new CdpClient({ host: HOST, port: PORT });
    const page = new TradingViewPage(cdp);
    const state = await page.getChartState();
    await cdp.close();
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
  }
}

async function main(): Promise<void> {
  process.stdout.write('tradingview-mcp · doctor\n');
  process.stdout.write('─────────────────────────────────────────────\n');

  const checks: CheckResult[] = [];
  checks.push(await checkCdpEndpoint());
  if (checks[0]?.ok) {
    checks.push(await checkTradingViewPage());
    if (checks[1]?.ok) {
      checks.push(await checkTvWidget());
    }
  }

  for (const c of checks) {
    const tag = c.ok ? '[ok]  ' : '[fail]';
    process.stdout.write(`${tag} ${c.name}\n`);
    process.stdout.write(`       ${c.detail}\n`);
  }

  process.stdout.write('─────────────────────────────────────────────\n');
  const allOk = checks.every((c) => c.ok);
  process.stdout.write(allOk ? 'ready.\n' : 'not ready — see above.\n');
  process.exit(allOk ? 0 : 1);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`doctor failed: ${msg}\n`);
  process.exit(2);
});
