import test from 'node:test';
import assert from 'node:assert/strict';
import { emaSeries, summarizeCloses, classifyMarket } from '../api/market-math.js';

test('EMA seeds with the first-period SMA, then applies the standard multiplier', () => {
  const result = emaSeries([10, 20, 30, 40], 3);
  assert.equal(result[1], null);
  assert.equal(result[2], 20);
  assert.equal(result[3], 30);
});

test('summary reports EMA 200, 20-session return and 52-week range from chronological closes', () => {
  const closes = Array.from({ length: 252 }, (_, index) => 100 + index);
  const summary = summarizeCloses(closes);
  assert.equal(summary.last, 351);
  assert.equal(summary.return20dPct, (351 / 331 - 1) * 100);
  assert.equal(summary.high52w, 351);
  assert.equal(summary.low52w, 100);
  assert.equal(summary.aboveEma200, true);
});

test('regime is based on observable index EMA states and gives high VIX priority', () => {
  const bullish = { aboveEma200: true, emaSlope20dPct: 1 };
  assert.equal(classifyMarket({ sp500: bullish, nasdaq: bullish, vix: { last: 17 } }).label, 'Bullish Trend');
  assert.equal(classifyMarket({ sp500: bullish, nasdaq: bullish, vix: { last: 31 } }).label, 'High Volatility');
});
