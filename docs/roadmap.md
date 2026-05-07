# Roadmap

Stable, no-promises, opinionated. Subject to drift as TradingView's internal API drifts.

## v0.1 — shipped

- [x] Connection layer: `chrome-remote-interface`, typed errors, auto-detect TradingView page
- [x] Doctor CLI for diagnostics
- [x] Chart tools: `chart_get_state`, `chart_set_symbol`, `chart_set_timeframe`, `chart_get_ohlcv`
- [x] Quote tool: `quote_get`
- [x] Pine tools: `pine_get_source`, `pine_set_source`, `pine_compile`, `pine_save`
- [x] Screenshot tools: `screenshot_chart`, `screenshot_full`
- [x] Strict TypeScript, Zod end-to-end, vitest coverage

## v0.2 — soon

- [ ] **Indicators (studies)** — `study_add`, `study_remove`, `study_set_inputs`, `study_list`
- [ ] **Drawings** — `draw_horizontal_line`, `draw_trendline`, `draw_text`, `draw_rectangle`, `draw_remove`, `draw_list`
- [ ] **Watchlist** — `watchlist_add`, `watchlist_remove`, `watchlist_get`
- [ ] **Layouts** — `layout_save`, `layout_load`, `layout_list`
- [ ] **Screenshot — chart-only clipping** — currently full viewport; switch to `Page.captureScreenshot { clip }` once we standardize the chart-canvas selector across TradingView Desktop versions

## v0.3 — exploring

- [ ] **Alerts** — `alert_create`, `alert_list`, `alert_delete`, `alert_modify`
- [ ] **Replay mode** — `replay_start`, `replay_step`, `replay_stop`, `replay_status`
- [ ] **Pine library import** — push a Pine library by ID into the editor
- [ ] **Strategy tester** — read backtest results from the Strategy Tester pane

## v1.0 — hardening

- [ ] **Cross-platform doctor** — install hints per OS (macOS / Windows / Linux)
- [ ] **Multi-target support** — run multiple TradingView windows behind one MCP, route by `target_id`
- [ ] **Reconnection** — auto-reconnect when CDP socket drops mid-session
- [ ] **Schema versioning** — bump output schemas only on majors; tools become idempotent across minor TV releases
- [ ] **Integration test suite** — opt-in tests against a real TradingView Desktop, gated on `INTEGRATION=1`

## Not on the roadmap

- Headless TradingView (TV doesn't support it; no path)
- Bypassing TradingView paywalls or scraping non-Desktop endpoints
- Embedding TradingView charts in your own app (use TV's official widget)
- Trading execution (this is a chart-control MCP — execution belongs in your broker's MCP)

## How to suggest something

- Open an issue with the use case + the smallest tool surface that would unlock it.
- "Wrap every TradingView API" is not a use case. "I want to compare 50 symbols across 3 timeframes from Claude" is.
