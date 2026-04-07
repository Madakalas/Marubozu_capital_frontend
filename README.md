# Marubozu Capital v4 — React Frontend

## Install & run
```bash
npm install
npm start    # → http://localhost:3000
npm run build
```

## Key architecture decisions (v4)

### Global shared state (AppContext)
All pages share one ticker, interval, fromDate, toDate via React Context.
Changes on any page immediately reflect on every other page.
State is persisted to sessionStorage — survives page switches.
Default: last 30 days, 4hour interval.

### Page state persistence (keep-alive)
All pages are mounted simultaneously in the DOM.
Active page shown via display:block, inactive via display:none.
This means switching tabs does NOT destroy state — data stays loaded.

### Critical API field names
- `/getData`             → uses `interval` (NOT chart_interval)
- `/gapAnalysis`         → uses `interval` (NOT chart_interval)
- `/recomputeTechnicals` → uses `interval` (NOT chart_interval)
- `/backtest-results`    → uses `chart_interval` (correct)
- `/backtest`            → uses `chart_interval` (correct)

### MTF Analysis
Uses `chartjs-adapter-date-fns` for real time-scale X axis.
Fetches price data + all timeframe signals in parallel (Promise.all).
Dot radius scales with timeframe duration (matching HTML source).
Signal stacking prevents overlap at same timestamp.

### Assets & Timeframes
ManageAssets reloads both global context AND local hooks on save/delete.
All dropdowns across all pages update immediately without page refresh.
