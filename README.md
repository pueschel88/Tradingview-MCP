# tradingview-mcp

```
tradingview-mcp/  v0.1   ──────────────────────────────────────────────────
```

A focused, type-safe **MCP server** that lets [Claude Code](https://claude.ai/code) (or any MCP-compatible client) drive a locally-running **TradingView Desktop** application — read chart state, change symbols and timeframes, fetch OHLCV bars, capture screenshots.

> [!IMPORTANT]
> **This project is not affiliated with, endorsed by, or associated with TradingView Inc.** It is a personal-use bridge that interacts with your locally running TradingView Desktop application via the Chrome DevTools Protocol — the same standard debug interface built into Slack, VS Code, Discord, and every other Electron app.

> [!IMPORTANT]
> **Requires a valid TradingView subscription.** This tool does not bypass, scrape, or circumvent any TradingView paywall or access control. Everything happens on your machine, against the TradingView Desktop instance you have already logged into and paid for.

> [!NOTE]
> **All processing is local.** No TradingView data is transmitted, stored, or redistributed by this tool. Your charts, your data, your machine.

> [!CAUTION]
> TradingView's internal page API is undocumented. It can change between Desktop releases. Pin a working TradingView Desktop version if you want stability, and check the [version compatibility](#version-compatibility) note before upgrading.

---

## What it does

Wraps the TradingView Desktop chart in a small set of well-defined MCP tools. Tools are typed end-to-end with [Zod](https://zod.dev) schemas, validated at the boundary, and surface useful error messages when something goes wrong.

```
                  ┌───────────────┐
                  │ Claude Code   │
                  │ (or any MCP   │
                  │  client)      │
                  └───────┬───────┘
                          │ stdio (MCP)
                          ▼
                  ┌───────────────┐
                  │tradingview-mcp│
                  └───────┬───────┘
                          │ Chrome DevTools Protocol
                          ▼
                  ┌───────────────┐
                  │ TradingView   │
                  │ Desktop       │
                  │ (--remote-    │
                  │  debugging-   │
                  │  port=9222)   │
                  └───────────────┘
```

---

## Why another TradingView integration?

Existing TradingView automation projects exist. This one is deliberately scoped down:

- **12 tools, not 78.** Every tool is documented, typed, and tested.
- **Strict TypeScript.** No `any`, no implicit returns, `noUncheckedIndexedAccess` on.
- **One responsibility per file.** Connection, page, tools, and server are separate layers — version drift only requires fixing one spot.
- **Typed errors.** `ConnectionError`, `ToolExecutionError`, `ChartStateError` etc. with actionable messages.
- **`tradingview-mcp doctor`.** A diagnostic command that tells you exactly what's wrong with your setup.

Use this if you want a small, predictable surface you can read in an afternoon. Use the kitchen-sink alternatives if you want every TradingView feature wrapped.

---

## Install

Requires Node.js 20+.

```bash
npm install -g tradingview-mcp
# or, in a project:
npm install tradingview-mcp
```

For development:

```bash
git clone https://github.com/harshil1502/tradingview-mcp.git
cd tradingview-mcp
npm install
npm run build
```

---

## Setup — three steps

### 1. Quit any running TradingView Desktop

Otherwise the debug port can't be enabled.

### 2. Launch TradingView Desktop with the debug port enabled

**macOS:**

```bash
open -a "TradingView" --args --remote-debugging-port=9222
```

**Windows:**

```powershell
& "C:\Users\<you>\AppData\Local\Programs\TradingView\TradingView.exe" --remote-debugging-port=9222
```

**Linux:**

```bash
tradingview --remote-debugging-port=9222
```

> [!NOTE]
> The `--remote-debugging-port` flag is a standard Chromium debug flag. It is opt-in and disabled by default. Nothing happens without you explicitly passing it.

### 3. Verify the connection

```bash
tradingview-mcp doctor
```

If everything is wired up, you'll see something like:

```
tradingview-mcp · doctor
─────────────────────────────────────────────
[ok]  CDP endpoint reachable on localhost:9222
[ok]  TradingView page found (NASDAQ:AAPL · 1h)
[ok]  tvWidget detected — chart state readable
─────────────────────────────────────────────
ready.
```

---

## Use with Claude Code

Add this to your Claude Code MCP config (`~/.claude/mcp.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "tradingview": {
      "command": "tradingview-mcp",
      "env": {
        "TV_MCP_PORT": "9222"
      }
    }
  }
}
```

Restart Claude Code. The tools below will be available.

---

## Tools

| Tool | Description |
|---|---|
| `chart_get_state` | Read current symbol, timeframe, visible studies, last price |
| `chart_set_symbol` | Change the active symbol (e.g. `NASDAQ:AAPL`, `NSE:RELIANCE`) |
| `chart_set_timeframe` | Change resolution (`1m`, `5m`, `1h`, `1d`, etc.) |
| `chart_get_ohlcv` | Fetch up to 5,000 most-recent OHLCV bars from the active chart |

More tools coming — see [`docs/roadmap.md`](docs/roadmap.md).

### Example session

```
You:    What's the chart showing?
Claude: [calls chart_get_state]
        Showing NASDAQ:AAPL on 1h timeframe with EMA20, EMA50.
        Last price 187.42.

You:    Switch to BTCUSDT 4h and pull the last 200 bars.
Claude: [calls chart_set_symbol, chart_set_timeframe, chart_get_ohlcv]
        Done. Range: 187 days. Open at start: 62,440.
        Close at end: 67,830. +8.6%.
```

---

## Configuration

| Env var | Default | Description |
|---|---|---|
| `TV_MCP_HOST` | `localhost` | CDP host |
| `TV_MCP_PORT` | `9222` | CDP debug port |
| `TV_MCP_TARGET` | (auto-detect) | Explicit CDP target ID — only needed if you have multiple TradingView windows open |

---

## Development

```bash
npm install
npm run build         # tsc to dist/
npm run dev           # tsc --watch
npm test              # vitest run
npm run test:coverage # with v8 coverage report
npm run typecheck     # tsc --noEmit
```

The codebase has four layers:

```
src/
├── index.ts              entry — reads env, starts stdio server
├── server.ts             MCP server, tool registration, request handlers
├── errors.ts             typed error classes
├── types.ts              shared types + Zod schemas
├── connection/
│   ├── cdp.ts            CDP client wrapper (chrome-remote-interface)
│   └── tradingview.ts    TradingView-page interactions (all evaluated JS lives here)
└── tools/
    ├── index.ts          tool registry
    └── chart.ts          chart_* tools
```

To add a tool:

1. Create a new file under `src/tools/` (or extend an existing one).
2. Export `<name>Input` and `<name>Output` Zod schemas plus the handler function.
3. Add the entry to `TOOLS` in `src/tools/index.ts`.
4. Add a test under `tests/`.

That's it — auto-registered, auto-validated, auto-introspectable.

---

## Version compatibility

| TradingView Desktop | tradingview-mcp | Status |
|---|---|---|
| 2026.x.x | 0.1.x | Tested |

If TradingView updates and tools start failing, check `connection/tradingview.ts` first — that's the single file that knows about TradingView's internal API.

---

## Disclaimer

This software is provided "as is" without warranty of any kind. By running it, you acknowledge:

- You are using your own paid TradingView Desktop instance, against your own data.
- You enabled the Chrome DevTools debug port yourself.
- TradingView's internal API is undocumented and may break.
- Nothing in this software guarantees correctness of trading decisions made by an AI agent on top of it. **Use it on a paper account before letting it touch real capital.**

---

## License

[MIT](LICENSE) © 2026 Harshil Patel

---

## Acknowledgments

This is a fresh implementation — built from scratch with the goal of being small, well-typed, and easy to read. If you've worked on similar tools in this space, thanks for paving the way.
