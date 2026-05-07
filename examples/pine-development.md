# Pine Script Development with Claude

This walks through using `tradingview-mcp` for AI-assisted Pine Script work — reading the editor, iterating on indicator code, and saving when it compiles cleanly.

## Prerequisites

In addition to the [basic setup](basic-usage.md):

- The **Pine Editor** must be open in TradingView. Bottom panel → **Pine Editor**, or `View → Pine Editor`.
- A script loaded in the editor. New empty script is fine.

Verify with `tradingview-mcp doctor` plus a quick check:

> **You:** Read the Pine Editor.
>
> **Claude:** *[calls `pine_get_source`]*
> The editor has 12 lines of Pine v5 — `indicator("Test", overlay=true)` plotting `close`.

If you get "Pine Editor not found" — open the Pine Editor pane in TradingView and try again.

---

## Workflow 1 — review and refactor

> **You:** Read the current indicator. Suggest cleanups.
>
> **Claude:** *[calls `pine_get_source`]*
>
> Three things:
> 1. The `len = input.int(20)` lacks a `title` and a `tooltip`. Future-you will thank you.
> 2. You're computing `rsi(close, len)` twice in different branches. Extract to a single variable.
> 3. The `plot(rsi_val, color=color.purple)` would be more readable with `color=#9333ea` and a named `display=display.all`.
>
> Want me to apply those changes?

> **You:** Yes.
>
> **Claude:** *[calls `pine_set_source` with the refactored code, then `pine_compile`]*
>
> Compiled clean. No errors, no warnings.

---

## Workflow 2 — write from scratch

> **You:** Build me a Bollinger Band breakout indicator. 20-period basis, 2σ bands, signal on close above upper or below lower.
>
> **Claude:** *[calls `pine_set_source` with a freshly-written script]*
>
> Written. Calling `pine_compile` to verify…
>
> *[calls `pine_compile`]*
>
> ```
> ok: true
> diagnostics: []
> ```
>
> Compiled clean on the first pass. The script:
> - Plots the basis (20 SMA) in blue
> - Plots the upper/lower bands in muted gray
> - Marks breakout candles with a triangle below/above
> - Has a `breakout_strength` plot for the value distance (close - band) for backtesting
>
> Run `pine_save` when you want to apply it to the chart.

---

## Workflow 3 — debug and iterate

> **You:** This script throws "Undefined variable 'rsi_len'". Fix it.
>
> **Claude:** *[calls `pine_get_source`, `pine_compile`]*
>
> Confirmed — line 14 references `rsi_len` but the input is named `len_rsi`. I'll rename and recompile.
>
> *[calls `pine_set_source`, `pine_compile`]*
>
> Compiled clean. One step ahead — there was also an unused `bias` variable on line 22 that I removed while I was in there.

---

## Tips

- **`pine_compile` is best-effort.** It triggers TradingView's save action and reads diagnostics from Monaco's marker model. If the marker pane doesn't populate within ~600ms, the result may say `ok: true` even when there's a runtime issue. Always run `pine_save` and visually inspect the chart for the first version of any indicator.

- **Don't `pine_set_source` your only copy.** Treat the editor like a working buffer. Keep authoritative versions in your own files or a Pine Library.

- **Pine version detection.** `pine_get_source` parses `//@version=N` from the source. If your script has no version directive (uncommon), the response field will be `null` — assume v5.

- **Performance.** Each Pine round-trip is ~600-1000ms because we wait for compile diagnostics. Don't loop `pine_compile` in a tight cycle.
