import { summarizeCloses, classifyMarket } from './market-math.js';

const BENCHMARKS = [
  { key: 'sp500', symbol: '^GSPC', label: 'S&P 500', kind: 'index' },
  { key: 'nasdaq', symbol: '^IXIC', label: 'Nasdaq Composite', kind: 'index' },
  { key: 'russell', symbol: '^RUT', label: 'Russell 2000', kind: 'index' },
  { key: 'vix', symbol: '^VIX', label: 'VIX', kind: 'volatility' },
  { key: 'yield10y', symbol: '^TNX', label: 'US 10Y yield', kind: 'yield' },
  { key: 'dxy', symbol: 'DX-Y.NYB', label: 'US Dollar Index', kind: 'index' }
];
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

function validTicker(value) {
  return /^[A-Z0-9.^_=-]{1,15}$/.test(value) && !value.includes('=') && !value.startsWith('^');
}
async function fetchChart(symbol) {
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - 400 * 86400;
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.search = new URLSearchParams({ period1: String(period1), period2: String(now), interval: '1d', events: 'div,splits', includeAdjustedClose: 'true' });
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 StockLensBooji/5.0' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Yahoo Finance returned ${response.status}`);
  const payload = await response.json();
  const chart = payload?.chart?.result?.[0];
  if (!chart || payload?.chart?.error) throw new Error(payload?.chart?.error?.description || 'No chart data');
  const timestamps = chart.timestamp || [];
  const quote = chart.indicators?.adjclose?.[0]?.adjclose || chart.indicators?.quote?.[0]?.close || [];
  const rows = timestamps.map((timestamp, index) => ({ timestamp, close: Number(quote[index]) })).filter(row => Number.isFinite(row.close));
  if (rows.length < 200) throw new Error('Fewer than 200 daily closes are available');
  const summary = summarizeCloses(rows.map(row => row.close));
  return { ...summary, symbol, label: BENCHMARKS.find(item => item.symbol === symbol)?.label || symbol, asOf: new Date(rows.at(-1).timestamp * 1000).toISOString(), source: 'Yahoo Finance', currency: chart.meta?.currency || null };
}

async function cachedChart(symbol) {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.value;
  const value = await fetchChart(symbol);
  cache.set(symbol, { time: Date.now(), value });
  return value;
}

async function settleChart(symbol) {
  try { return { symbol, ok: true, data: await cachedChart(symbol) }; }
  catch (error) { return { symbol, ok: false, error: error?.message || 'Market data unavailable' }; }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const rawTickers = String(req.query?.symbols || '').split(/[\s,]+/).map(value => value.trim().toUpperCase()).filter(Boolean);
  const tickers = [...new Set(rawTickers)].filter(validTicker).slice(0, 12);
  const symbols = [...new Set([...BENCHMARKS.map(item => item.symbol), ...tickers])];
  const results = await Promise.all(symbols.map(settleChart));
  const bySymbol = Object.fromEntries(results.map(item => [item.symbol, item]));
  const metrics = Object.fromEntries(BENCHMARKS.map(item => [item.key, bySymbol[item.symbol]?.ok ? bySymbol[item.symbol].data : null]));
  const equities = tickers.map(symbol => bySymbol[symbol]?.ok ? bySymbol[symbol].data : { symbol, label: symbol, error: bySymbol[symbol]?.error || 'Data unavailable' });
  const regime = classifyMarket(metrics);
  const breadth = equities.filter(item => item.aboveEma200 != null);
  const watchlistBreadth = breadth.length ? { aboveEma200Pct: breadth.filter(item => item.aboveEma200).length / breadth.length * 100, sampleSize: breadth.length, universe: 'requested scanner symbols' } : null;
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  return res.status(200).json({ ok: true, provider: 'Yahoo Finance chart endpoint', fetchedAt: new Date().toISOString(), cacheSeconds: 300, metrics, equities, regime, watchlistBreadth, warnings: ['Daily prices may be delayed. Yahoo Finance chart endpoint is undocumented and may rate-limit requests.', 'Index membership breadth and fundamentals are not provided by this endpoint.'] });
}
