export function ema(values, period = 20) {
  const output = Array(values.length).fill(null);
  if (!Number.isInteger(period) || period < 1 || values.length < period) return output;
  const seed = values.slice(0, period);
  if (seed.some(value => !Number.isFinite(value))) return output;
  let current = seed.reduce((sum, value) => sum + value, 0) / period;
  output[period - 1] = current;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i += 1) {
    if (!Number.isFinite(values[i])) continue;
    current += alpha * (values[i] - current);
    output[i] = current;
  }
  return output;
}

export function rsi(values, period = 14) {
  const output = Array(values.length).fill(null);
  if (!Number.isInteger(period) || period < 2 || values.length <= period) return output;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = values[i] - values[i - 1];
    gain += Math.max(0, delta);
    loss += Math.max(0, -delta);
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const value = () => avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
  output[period] = value();
  for (let i = period + 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, delta)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -delta)) / period;
    output[i] = value();
  }
  return output;
}

export function atr(bars, period = 14) {
  const output = Array(bars.length).fill(null);
  if (!Number.isInteger(period) || period < 1 || bars.length <= period) return output;
  const ranges = bars.map((bar, index) => {
    if (index === 0) return bar.high - bar.low;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - bars[index - 1].close), Math.abs(bar.low - bars[index - 1].close));
  });
  let current = ranges.slice(1, period + 1).reduce((sum, value) => sum + value, 0) / period;
  output[period] = current;
  for (let i = period + 1; i < bars.length; i += 1) {
    current = (current * (period - 1) + ranges[i]) / period;
    output[i] = current;
  }
  return output;
}

export function findStructure(bars, window = 60) {
  const sample = bars.slice(-window);
  const price = sample.at(-1)?.close;
  const lows = [];
  const highs = [];
  for (let i = 2; i < sample.length - 2; i += 1) {
    const bar = sample[i];
    if ([sample[i - 2], sample[i - 1], sample[i + 1], sample[i + 2]].every(item => bar.low < item.low)) lows.push(bar.low);
    if ([sample[i - 2], sample[i - 1], sample[i + 1], sample[i + 2]].every(item => bar.high > item.high)) highs.push(bar.high);
  }
  const dedupe = values => [...new Set(values.map(value => Number(value.toFixed(2))))];
  return {
    supports: dedupe(lows).filter(value => value < price).sort((a, b) => b - a).slice(0, 3),
    resistances: dedupe(highs).filter(value => value > price).sort((a, b) => a - b).slice(0, 3),
    method: `Swing low/high: 2 bars on each side, trailing ${sample.length} bars`
  };
}

export function marketRegime(metrics = {}) {
  const symbols = ['sp500', 'nasdaq', 'russell'];
  const reasons = [];
  let score = 0;
  let available = 0;
  for (const key of symbols) {
    const item = metrics[key];
    if (!item || item.aboveEma200 == null) continue;
    available += 1;
    score += item.aboveEma200 ? 1 : -1;
    if (Number.isFinite(item.emaSlope20dPct)) score += item.emaSlope20dPct > 0 ? 0.5 : -0.5;
    reasons.push(`${item.label || key}: ${item.aboveEma200 ? 'เหนือ' : 'ต่ำกว่า'} EMA 200${Number.isFinite(item.emaSlope20dPct) ? ` · slope ${item.emaSlope20dPct > 0 ? 'ขึ้น' : 'ลง'}` : ''}`);
  }
  if (available < 2) return { label: 'ข้อมูลไม่พอ', tone: 'neutral', score: null, reasons: ['ต้องมีข้อมูลอย่างน้อย 2 ดัชนี'] };
  const vix = metrics.vix?.last;
  if (Number.isFinite(vix)) {
    if (vix >= 30) { score -= 1.5; reasons.push(`VIX ${vix.toFixed(1)} · volatility สูง`); }
    else if (vix < 20) { score += 0.5; reasons.push(`VIX ${vix.toFixed(1)} · ต่ำกว่า 20`); }
    else reasons.push(`VIX ${vix.toFixed(1)} · volatility กลาง`);
  }
  const small = metrics.russell;
  const large = metrics.sp500;
  if (Number.isFinite(small?.return20dPct) && Number.isFinite(large?.return20dPct)) {
    const relative = small.return20dPct - large.return20dPct;
    score += relative > 0 ? 0.5 : -0.5;
    reasons.push(`Small vs large cap (20D): ${relative > 0 ? 'แข็งกว่า' : 'อ่อนกว่า'} ${Math.abs(relative).toFixed(1)} pp`);
  }
  let label = 'Mixed';
  let tone = 'neutral';
  if (score >= 3) { label = 'Risk-on'; tone = 'positive'; }
  else if (score >= 1) { label = 'Selective Risk-on'; tone = 'positive'; }
  else if (score <= -2.5) { label = 'Risk-off'; tone = 'negative'; }
  return { label, tone, score: Math.max(-5, Math.min(5, score)), reasons };
}

export function marketScore(metrics = {}) {
  const regime = marketRegime(metrics);
  if (!Number.isFinite(regime.score)) return null;
  return Math.round((regime.score + 5) * 10);
}

export function riskReward({ entry, stop, target, portfolio, riskPct, maxPosition }) {
  const values = [entry, stop, target, portfolio, riskPct, maxPosition];
  if (values.some(value => !Number.isFinite(value)) || entry <= 0 || stop <= 0 || target <= 0 || portfolio < 0 || riskPct < 0 || maxPosition < 0) return { error: 'กรอกค่าบวกให้ครบ ยกเว้น Portfolio value ใช้ 0 ได้' };
  if (stop >= entry) return { error: 'จุดตัดขาดทุนต้องต่ำกว่าราคาเข้า สำหรับแผนซื้อ' };
  if (target <= entry) return { error: 'ราคาเป้าหมายต้องสูงกว่าราคาเข้า สำหรับแผนซื้อ' };
  const riskPerShare = entry - stop;
  const rewardPerShare = target - entry;
  const budget = portfolio * riskPct / 100;
  const byRisk = budget / riskPerShare;
  const byLimit = maxPosition > 0 ? Math.floor(maxPosition / entry) : byRisk;
  const shares = Math.max(0, Math.floor(Math.min(byRisk, byLimit)));
  return { riskPerShare, rewardPerShare, riskPct: riskPerShare / entry * 100, rewardPct: rewardPerShare / entry * 100, ratio: rewardPerShare / riskPerShare, budget, shares, positionValue: shares * entry, maxLoss: shares * riskPerShare };
}