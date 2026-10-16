import { ema, marketRegime } from '../analysis/indicators.js';

const names = { SPY:'S&P 500 ETF', QQQ:'Nasdaq 100 ETF', IWM:'Russell 2000 ETF', '^GSPC':'S&P 500', '^IXIC':'Nasdaq Composite', '^RUT':'Russell 2000', '^VIX':'Volatility Index', '^TNX':'US 10Y yield', 'DX-Y.NYB':'US Dollar Index', XLK:'Technology', XLC:'Communication Services', XLY:'Consumer Discretionary', XLP:'Consumer Staples', XLV:'Healthcare', XLF:'Financials', XLI:'Industrials', XLE:'Energy', XLB:'Materials', XLU:'Utilities', XLRE:'Real Estate', ACWX:'International equities', TLT:'Long Treasury', SGOV:'Short Treasury', GLD:'Gold', DBC:'Commodities', UUP:'US Dollar', VNQ:'REITs', 'BTC-USD':'Bitcoin' };
const anchors = { SPY:560, QQQ:485, IWM:220, XLK:270, XLC:110, XLY:210, XLP:80, XLV:140, XLF:55, XLI:150, XLE:95, XLB:90, XLU:75, XLRE:45, ACWX:68, TLT:92, SGOV:100, GLD:250, DBC:28, UUP:28, VNQ:100, 'BTC-USD':108000, '^GSPC':6500, '^IXIC':22000, '^RUT':2300, '^VIX':18, '^TNX':4.1, 'DX-Y.NYB':102 };
function seed(symbol) { return [...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0); }
export function demoBars(symbol, count = 300) {
  const base = anchors[symbol] || 75 + seed(symbol) % 300;
  const s = seed(symbol);
  let close = base * (0.75 + (s % 35) / 100);
  const bars = [];
  for (let i = 0; i < count; i += 1) {
    const phase = (i + s) / (13 + s % 11);
    const drift = (0.0003 + ((s % 7) - 2) * 0.00015);
    const move = drift + Math.sin(phase) * 0.006 + Math.cos(phase * 0.53) * 0.003;
    const open = close * (1 + Math.sin(phase * 1.7) * 0.003);
    close = Math.max(base * 0.45, close * (1 + move));
    const high = Math.max(open, close) * (1 + 0.003 + Math.abs(Math.sin(phase)) * 0.003);
    const low = Math.min(open, close) * (1 - 0.003 - Math.abs(Math.cos(phase)) * 0.003);
    const date = new Date(); date.setUTCDate(date.getUTCDate() - (count - i));
    bars.push({ timestamp: date.toISOString(), open, high, low, close, volume: Math.round((700000 + s * 3000) * (1 + Math.abs(Math.sin(phase * 2)))) });
  }
  return bars;
}
function summarize(symbol) {
  const bars = demoBars(symbol);
  const closes = bars.map(bar => bar.close);
  const ema200 = ema(closes, 200);
  const last = closes.at(-1);
  const value = ema200.at(-1);
  const slope = (value / ema200.at(-21) - 1) * 100;
  return { symbol, label: names[symbol] || symbol, last, dailyChangePct: (last / closes.at(-2) - 1) * 100, return20dPct: (last / closes.at(-21) - 1) * 100, return50dPct: (last / closes.at(-51) - 1) * 100, return200dPct: (last / closes.at(-201) - 1) * 100, ema200: value, emaSlope20dPct: slope, aboveEma200: last > value, high52w: Math.max(...closes.slice(-252)), low52w: Math.min(...closes.slice(-252)), asOf: bars.at(-1).timestamp, source: 'DEMO SYNTHETIC', bars };
}
export function makeDemoPayload(symbols = [], includeBenchmarks = false) {
  const benchmarkSymbols = ['^GSPC','^IXIC','^RUT','^VIX','^TNX','DX-Y.NYB'];
  const all = [...new Set([...(includeBenchmarks ? benchmarkSymbols : []), ...symbols])];
  const data = Object.fromEntries(all.map(symbol => [symbol, summarize(symbol)]));
  const metrics = includeBenchmarks ? { sp500: data['^GSPC'], nasdaq: data['^IXIC'], russell: data['^RUT'], vix: data['^VIX'], yield10y: data['^TNX'], dxy: data['DX-Y.NYB'] } : {};
  return { ok: true, mode: 'demo', provider: 'Synthetic demo dataset', fetchedAt: new Date().toISOString(), metrics, equities: symbols.map(symbol => data[symbol] || summarize(symbol)), regime: includeBenchmarks ? marketRegime(metrics) : null, watchlistBreadth: null, warnings: ['DEMO DATA — NOT LIVE MARKET DATA'] };
}
export function demoCompanyName(symbol) { return names[symbol] || `${symbol} (Demo instrument)`; }
