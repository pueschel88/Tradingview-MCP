# Basic Usage

This walks through reading and controlling a TradingView chart from Claude Code via `tradingview-mcp`.

## Prerequisites

1. TradingView Desktop running with `--remote-debugging-port=9222` (see [README — Setup](../README.md#setup--three-steps)).
2. `tradingview-mcp` installed and registered in your Claude Code MCP config.
3. A chart open. Any symbol, any timeframe.

Verify with:

```bash
tradingview-mcp doctor
```

You should see three `[ok]` lines and `ready.`

---

## What Claude Code can now do

Once registered, Claude Code has access to these tools:

| Tool | Purpose |
|---|---|
| `chart_get_state` | Read symbol, timeframe, studies, last price |
| `chart_set_symbol` | Switch symbol |
| `chart_set_timeframe` | Switch timeframe |
| `chart_get_ohlcv` | Pull OHLCV bars |
| `quote_get` | Real-time quote snapshot |
| `pine_get_source` | Read the Pine Editor |
| `pine_set_source` | Replace Pine source |
| `pine_compile` | Compile + read diagnostics |
| `pine_save` | Save Pine script |
| `screenshot_chart` | Capture chart pane |
| `screenshot_full` | Capture full viewport |

---

## Sample sessions

### Read what's on screen

> **You:** What's on the chart right now?
>
> **Claude:** *[calls `chart_get_state`]*
> Showing **NASDAQ:AAPL** on **1h** timeframe with EMA20, EMA50, and RSI(14). Last price 187.42.

### Switch context and pull data

> **You:** Switch to BTCUSDT 4h and grab the last 200 bars.
>
> **Claude:** *[calls `chart_set_symbol`, `chart_set_timeframe`, `chart_get_ohlcv`]*
>
> Done. 200 bars from 2026-04-25 to 2026-05-07. Open at start: 62,440. Close at end: 67,830. Range high 68,210, low 60,180. The 4h candles show three notable consolidations around 64k, 66k, and 68k.

### Snapshot for visual review

> **You:** Take a screenshot and tell me what jumps out.
>
> **Claude:** *[calls `screenshot_chart`]*
>
> *[Claude analyzes the returned base64 PNG.]* The chart shows a clean trend break above the 67k resistance with healthy volume. EMA20 has crossed above EMA50 — bullish cross — within the last six bars.

### Multi-symbol comparison loop

> **You:** Compare last-bar momentum across AAPL, MSFT, GOOGL, NVDA on the daily.
>
> **Claude:** *[loops over symbols, calling `chart_set_symbol` and `chart_get_ohlcv` for each]*
>
> | Symbol | Last % | 5d % | 20d % |
> |---|---|---|---|
> | AAPL | +0.42 | +2.1 | +5.4 |
> | MSFT | +0.18 | +1.7 | +3.9 |
> | GOOGL | -0.12 | +0.8 | -1.2 |
> | NVDA | +1.84 | +6.3 | +11.7 |
>
> NVDA is leading by a wide margin on both 5d and 20d momentum.

---

## Tips

- **Speed:** every tool round-trips through the page, so chained calls are sequential. For batch comparisons, ask Claude to keep its own working set in memory rather than re-querying.
- **State:** `chart_set_symbol` and `chart_set_timeframe` mutate the actual chart. If you switch symbols mid-investigation, you've lost the previous chart's drawings.
- **Errors:** every error message includes which tool failed and a usable hint. If `pine_get_source` fails with "Pine Editor not found", open the Pine Editor pane in TradingView.
