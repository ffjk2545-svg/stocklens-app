StockLens Booji v4 — Thai-first daily investing desk

WHAT'S NEW
- Larger Thai typography, clearer spacing, and short summary cards before the long AI report.
- Full AI research report is collapsed by default, reducing the initial scroll while preserving deeper detail.
- Ticker-specific recent headlines through a server-side Google News RSS endpoint (/api/news), with publisher, relative time and a link out to the source.
- Market-wide TradingView Top Stories widget.
- Asset rotation view based on TradingView ETF/asset price proxies: US equity ETFs, tech equities, gold, long-duration Treasuries, US dollar, oil, Bitcoin, and SET index where supported.
- Clear notice: asset price movements are NOT actual net capital flows. Actual fund flows require a dedicated data provider.
- Financial comparison mini charts for prior vs latest period (revenue, net income, operating cash flow) with Thai-language heuristic interpretation. To avoid hallucinating financial data, the user enters values copied from the displayed source; iframe data cannot be read automatically by client-side JavaScript.
- TradingView widgets set to Thai locale where supported; source headlines may remain in the original publisher language.
- Vercel health endpoint version advanced to v4.
- Existing bear/base/bull portfolio calculator, local watchlist, daily checklist, chart and technical widgets retained.

FILES
  index.html
  script.js
  package.json
  api/analyze.js
  api/health.js
  api/news.js

DEPLOY
1. Upload/commit the full contents of this folder to the repository root connected to Vercel (not the parent folder).
2. Ensure api/analyze.js, api/health.js, and api/news.js are inside /api.
3. Keep GEMINI_API_KEY in Vercel Environment Variables. It should never be placed in HTML or script.js.
4. The backend pins gemini-3.8-flash in code so an old GEMINI_MODEL environment variable cannot override it. GEMINI_API_KEY is the required secret. If this Google project explicitly reports that model as unavailable, check the current Google model list and update api/analyze.js + api/health.js together.
5. Wait for the new Vercel deployment to become Ready.
6. Verify https://YOUR-DOMAIN/api/health returns version 2026-10-15-v4.
7. Test https://YOUR-DOMAIN/api/news?symbol=NVDA&market=US and check it returns {"ok":true,"items":[...]} or a meaningful error.

DATA NOTES
- TradingView widget data is provided by TradingView; availability, locale, delay, and supported symbols depend on the widget, exchange and entitlements.
- Google News RSS provides headlines and outbound links to publishers, not a verified impact analysis. Users should open the original articles before interpreting market impact.
- Forex Factory remains an external link; this app does not copy or republish its calendar content.
- The asset rotation widget compares prices of representative instruments and does not measure capital flows. True net inflows/outflows require an actual fund-flow data provider.
- The finance comparison chart is based only on values the user types in. Use the same currency, unit, and reporting period type for both columns. The text is a heuristic explanation, not accounting advice.
- AI does not automatically read the content inside TradingView widgets. Optional pasted evidence is passed to Gemini; it should not be treated as a source of verified live facts.
- All projections are hypothetical and not a price target or investment advice.
