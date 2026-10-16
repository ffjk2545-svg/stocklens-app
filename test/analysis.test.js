import test from 'node:test';
import assert from 'node:assert/strict';
import { ema, rsi, atr, findStructure, marketRegime, riskReward } from '../src/analysis/indicators.js';

test('EMA starts at the first-period SMA and uses the standard smoothing factor', () => {
  const result = ema([10,20,30,40],3);
  assert.equal(result[1],null);
  assert.equal(result[2],20);
  assert.equal(result[3],30);
});
test('RSI and ATR return null until the initial lookback is available', () => {
  const prices = Array.from({length:20},(_,i)=>100+i);
  const rsiLine = rsi(prices,14);
  assert.equal(rsiLine[13],null);
  assert.equal(rsiLine[14],100);
  const bars = prices.map(close=>({high:close+2,low:close-2,close}));
  const atrLine = atr(bars,14);
  assert.equal(atrLine[13],null);
  assert.equal(atrLine[14],4);
});
test('support and resistance identify confirmed swing points within the lookback', () => {
  const lows = [10,9,8,9,10,11,10,9,8,9,10,11,10,9,8];
  const bars = lows.map((low,i)=>({low,high:low+3,close:low+1,timestamp:String(i)}));
  const result = findStructure(bars,15);
  assert.ok(result.supports.length > 0);
  assert.ok(result.resistances.length > 0);
  assert.match(result.method,/Swing low\/high/);
});
test('market regime uses at least two indices and multiple volatility/trend inputs', () => {
  const up = {label:'index',aboveEma200:true,emaSlope20dPct:1,return20dPct:3};
  const regime = marketRegime({sp500:up,nasdaq:up,russell:up,vix:{last:16}});
  assert.equal(regime.label,'Risk-on');
  assert.ok(regime.reasons.length>=4);
  assert.equal(marketRegime({sp500:up}).label,'ข้อมูลไม่พอ');
});
test('risk reward rejects invalid long levels and respects position value cap', () => {
  assert.match(riskReward({entry:100,stop:105,target:120,portfolio:10000,riskPct:1,maxPosition:2000}).error,/ต่ำกว่า Entry/);
  const result = riskReward({entry:100,stop:90,target:120,portfolio:10000,riskPct:1,maxPosition:2000});
  assert.equal(result.ratio,2);
  assert.equal(result.shares,10);
  assert.equal(result.maxLoss,100);
});
