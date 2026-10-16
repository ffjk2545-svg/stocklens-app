import { ema, marketRegime } from '../src/analysis/indicators.js';

const BENCHMARKS = [
  { key:'sp500', symbol:'^GSPC', label:'S&P 500', kind:'index' },
  { key:'nasdaq', symbol:'^IXIC', label:'Nasdaq Composite', kind:'index' },
  { key:'russell', symbol:'^RUT', label:'Russell 2000', kind:'index' },
  { key:'vix', symbol:'^VIX', label:'VIX', kind:'volatility' },
  { key:'yield10y', symbol:'^TNX', label:'US 10Y yield', kind:'yield' },
  { key:'dxy', symbol:'DX-Y.NYB', label:'US Dollar Index', kind:'index' }
];
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

function validTicker(value) { return /^[A-Z0-9.^_=-]{1,20}$/.test(value) && !value.includes('=') && !value.startsWith('^'); }
function summarizeBars(rows, symbol, meta = {}) {
  const closes = rows.map(row => row.close);
  const ema200 = ema(closes, 200);
  const last = closes.at(-1);
  const previous = closes.at(-2);
  const emaNow = ema200.at(-1);
  const emaPast = ema200.at(-21);
  const at = offset => closes.at(-offset);
  const range = rows.slice(-252);
  const result = {
    symbol,
    label: BENCHMARKS.find(item => item.symbol === symbol)?.label || meta.shortName || meta.longName || symbol,
    last,
    dailyChangePct: previous ? (last / previous - 1) * 100 : null,
    ema200: emaNow,
    emaSlope20dPct: emaPast ? (emaNow / emaPast - 1) * 100 : null,
    return20dPct: at(21) ? (last / at(21) - 1) * 100 : null,
    return50dPct: at(51) ? (last / at(51) - 1) * 100 : null,
    return200dPct: at(201) ? (last / at(201) - 1) * 100 : null,
    high52w: range.length ? Math.max(...range.map(row => row.high)) : null,
    low52w: range.length ? Math.min(...range.map(row => row.low)) : null,
    aboveEma200: Number.isFinite(last) && Number.isFinite(emaNow) ? last > emaNow : null,
    asOf: rows.at(-1)?.timestamp || null,
    source:'Yahoo Finance', currency:meta.currency || null, exchange:meta.exchangeName || null,
    bars:rows
  };
  return result;
}

async function fetchChart(symbol) {
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - 400 * 86400;
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.search = new URLSearchParams({ period1:String(period1), period2:String(now), interval:'1d', events:'div,splits', includeAdjustedClose:'true' });
  const response = await fetch(url, { headers:{ 'User-Agent':'Mozilla/5.0 StockLensRadar/1.0' }, signal:AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`Yahoo Finance returned ${response.status}`);
  const payload = await response.json();
  const chart = payload?.chart?.result?.[0];
  if (!chart || payload?.chart?.error) throw new Error(payload?.chart?.error?.description || 'No chart data');
  const quote = chart.indicators?.quote?.[0] || {};
  const adjClose = chart.indicators?.adjclose?.[0]?.adjclose || quote.close || [];
  const timestamps = chart.timestamp || [];
  const rows = timestamps.map((timestamp,index) => {
    const rawClose = Number(quote.close?.[index]);
    const close = Number(adjClose[index]);
    if (!Number.isFinite(close) || !Number.isFinite(rawClose) || rawClose === 0) return null;
    const factor = close / rawClose;
    const adjusted = key => Number.isFinite(Number(quote[key]?.[index])) ? Number(quote[key][index]) * factor : close;
    return { timestamp:new Date(timestamp * 1000).toISOString(), open:adjusted('open'), high:adjusted('high'), low:adjusted('low'), close, volume:Number(quote.volume?.[index]) || 0 };
  }).filter(Boolean);
  if (rows.length < 200) throw new Error('Fewer than 200 daily bars are available for EMA 200');
  return summarizeBars(rows, symbol, chart.meta || {});
}
async function cachedChart(symbol) {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.value;
  const value = await fetchChart(symbol);
  cache.set(symbol,{ time:Date.now(), value });
  return value;
}
async function settleChart(symbol) {
  try { return { symbol, ok:true, data:await cachedChart(symbol) }; }
  catch (error) { return { symbol, ok:false, error:error?.message || 'Market data unavailable' }; }
}

export default async function handler(req,res) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({ error:'Method not allowed' }); }
  const raw = String(req.query?.symbols || '').split(/[\s,]+/).map(value => value.trim().toUpperCase()).filter(Boolean);
  const symbols = [...new Set(raw.filter(validTicker))].slice(0,20);
  const wantBenchmarks = req.query?.benchmarks !== '0';
  const selected = symbols.length ? symbols : [];
  const requested = [...new Set([...(wantBenchmarks ? BENCHMARKS.map(item => item.symbol) : []), ...selected])];
  const results = [];
  for (let i=0;i<requested.length;i+=6) results.push(...await Promise.all(requested.slice(i,i+6).map(settleChart)));
  const bySymbol = Object.fromEntries(results.map(item => [item.symbol,item]));
  const metrics = Object.fromEntries(BENCHMARKS.map(item => [item.key,bySymbol[item.symbol]?.ok ? bySymbol[item.symbol].data : null]));
  const equities = selected.map(symbol => bySymbol[symbol]?.ok ? bySymbol[symbol].data : { symbol,label:symbol,error:bySymbol[symbol]?.error || 'Data unavailable' });
  const universe = equities.filter(item => item.aboveEma200 != null);
  const watchlistBreadth = universe.length ? { aboveEma200Pct:universe.filter(item => item.aboveEma200).length / universe.length * 100,sampleSize:universe.length,universe:'requested ticker set' } : null;
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
  return res.status(200).json({
    ok:true, mode:'live', provider:'Yahoo Finance chart endpoint', fetchedAt:new Date().toISOString(), cacheSeconds:300,
    metrics, equities, regime:wantBenchmarks ? marketRegime(metrics) : null, watchlistBreadth,
    coverage:{ requested:selected.length, returned:equities.filter(item => !item.error).length, benchmarks:wantBenchmarks },
    warnings:['Daily adjusted OHLCV from Yahoo Finance can be delayed. This endpoint is undocumented and may rate-limit requests.','Market breadth covers only requested symbols, not the full exchange. Fundamentals and actual fund flows are not available.']
  });
}
