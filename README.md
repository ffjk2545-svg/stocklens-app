# StockLens Radar

**See the Flow. Read the Market. Find Your Setup.**

StockLens Radar is a Thai-first, single-page market research workspace for US equities. It combines market context, ETF price proxies, sector rotation, a bounded stock screener, technical analysis, manual financial comparisons, a local watchlist, and a portfolio journal. It provides research context only; it does not place trades or issue Buy/Sell recommendations.

## Data integrity

- The default **Demo mode** uses deterministic synthetic OHLCV data. A visible `DEMO DATA — NOT LIVE MARKET DATA` banner remains on screen. Demo mode creates no fake news, earnings, financial statements, or fund flows.
- **Live mode** requests adjusted daily OHLCV through the Vercel `/api/market` function and headlines through `/api/news`. Provider failures are shown as unavailable; previous or demo values are not presented as live values.
- Yahoo Finance's chart endpoint is undocumented, can delay or rate-limit data, and may change. Treat prices as delayed and verify them with a licensed broker or exchange source before making decisions.
- Google News RSS headlines link to their publishers. Headline availability and timestamps depend on the feed.
- Market breadth only describes the app's selected Watchlist universe. The screener currently covers 12 named US tickers. Sector rotation uses the 11 US sector ETFs against SPY.
- Market Flow compares price returns and recent relative-volume proxies for ETF/asset instruments. These are **not actual fund flows**. Actual flows, economic calendar events, analyst estimates, peer valuation datasets, and provider-sourced company fundamentals are not connected.
- Financial comparisons and valuation fields are user-entered. The app labels them as such and produces simple rule-based descriptions, not accounting advice. Verify filing period, currency, and units before entry.
- The Technical Setup Score weights trend, relative strength, RSI, and EMA distance. Business quality and valuation scores are unavailable, and no composite Buy/Sell rating is produced.
- Alerts are evaluated when the user refreshes market data; there are no background or push notifications. Watchlist, journal, alerts, settings, financial entries, and valuation notes are stored in that browser's `localStorage`; they do not sync across devices.

## Features

- Overview with rule-based market regime from S&P 500, Nasdaq Composite, Russell 2000, EMA 200, VIX, and small/large relative strength; factual rule-driven brief; Watchlist-universe breadth; sector pulse; RSS headlines.
- Market Flow with 1D, 1W, 1M, 3M, and 6M relative-return views. Each series is a price proxy and is compared with SPY.
- Sector Rotation quadrant: 3M relative strength versus SPY and 20-session change in that relative strength. This is a simplified custom quadrant, not standard StockCharts RRG.
- Stock Screener with search, trend/pullback/breakout presets, EMA and return filters, sorting, ticker analysis, Watchlist add, and CSV export. Quality Growth is marked unavailable because financial data is not connected.
- Stock Analysis with adjusted daily bars, EMA 20/50/200, RSI 14, ATR 14, relative strength versus SPY, swing-based support/resistance heuristic, as-of/source labels, and a position risk/reward calculator.
- Earnings & Financials with user-entered period values and explicit source/unit fields.
- Watchlist with local groups, status filtering, sorting, and refresh-time price alerts.
- Portfolio Journal CRUD and JSON workspace export/import.
- Settings for Demo/Live mode, API origin, source checks, data export, import, and clearing local data.

## Run locally

Requires a current Node.js runtime for the built-in test runner. The app itself is vanilla HTML, CSS, and ES modules; it has no framework or build step.

```sh
npm test
```

For a static Demo-mode preview, serve the repository root over HTTP (ES modules do not load reliably from `file://`):

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. Demo mode works as a static site. Live mode needs the Vercel functions below.

For local Vercel functions, install the Vercel CLI and run:

```sh
vercel dev
```

## Deploy

- **Vercel:** import the repository. `/api/market`, `/api/news`, and `/api/health` run as serverless functions. The app defaults to Demo mode; select Live mode in Settings to call the same-origin API.
- **GitHub Pages:** serve the static files with relative paths; Demo mode works. GitHub Pages cannot run the `/api/*` serverless functions, so Live mode will report the endpoints unavailable unless an API origin is configured in Settings. The configured API must allow browser CORS from the Pages origin.
- **Secrets:** no provider key is required for market/news endpoints. The legacy optional `/api/analyze` Gemini endpoint, if used independently, reads `GEMINI_API_KEY` only on the server. Never put secrets in client files or commit `.env` files.

## Source layout

```text
index.html                  Single-page app shell
styles.css                  Responsive dark interface
src/main.js                 UI state, page rendering, and interactions
src/analysis/indicators.js  EMA, RSI, ATR, regime, structure, risk sizing
src/analysis/financial-summary.js
src/services/                Demo, market, and news providers
src/state/storage.js         Versioned localStorage and workspace import/export
src/ui/charts.js             Lightweight SVG charts
api/market.js                Vercel Yahoo Finance chart proxy
api/news.js                  Vercel Google News RSS endpoint
api/health.js                Deployment health response
test/                        Node built-in unit tests
```

## Security and reliability

The browser calls only the app's configured API origin; API credentials stay server-side. User-provided text is escaped before rendering in HTML, news links are restricted to HTTP(S), and workspace imports validate the supported top-level data shapes before writing. The API caps ticker count and fetch concurrency and caches successful charts briefly. Provider terms, availability, and licensing can change; the Yahoo endpoint is not a guaranteed production feed.

## Roadmap / provider requirements

To make fundamentals, actual ETF flows, economic events, and valuation comparisons live, connect a licensed provider behind server-side API functions, add source/as-of metadata and per-field missing-data behavior, and expand tests around its response schema. Do not infer these fields from price proxies.
