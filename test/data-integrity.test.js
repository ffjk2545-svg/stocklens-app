import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoPayload } from '../src/services/demo-provider.js';
import { decodeFinancials, valuationNotes } from '../src/analysis/financial-summary.js';

test('demo provider is marked synthetic and does not invent news or fund flows', () => {
  const payload = makeDemoPayload(['NVDA'], true);
  assert.equal(payload.mode, 'demo');
  assert.match(payload.warnings[0], /NOT LIVE MARKET DATA/);
  assert.equal(payload.news, undefined);
  assert.equal(payload.fundFlows, undefined);
  assert.equal(payload.equities[0].source, 'DEMO SYNTHETIC');
});

test('financial summary only describes entered period values', () => {
  const summary = decodeFinancials({ revenue:{previous:100,current:110},netIncome:{previous:10,current:8},operatingCashFlow:{previous:12,current:9} },'QoQ');
  assert.match(summary.headline,/รายได้เพิ่มขึ้น 10.0%/);
  assert.match(summary.quality,/รายได้เพิ่มขึ้น/);
  assert.match(valuationNotes({pe:22}),/ไม่มี peer/);
});
