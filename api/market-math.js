export function emaSeries(values, period = 200) {
  const result = Array(values.length).fill(null);
  if (!Number.isInteger(period) || period <= 0 || values.length < period) return result;
  const seed = values.slice(0, period);
  if (seed.some(value => !Number.isFinite(value))) return result;
  let current = seed.reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = current;
  const multiplier = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) continue;
    current = (value - current) * multiplier + current;
    result[index] = current;
  }
  return result;
}

export function summarizeCloses(closes) {
  const clean = closes.filter(Number.isFinite);
  const ema = emaSeries(clean, 200);
  const last = clean.at(-1);
  const latestEma = ema.at(-1);
  const slopeBase = ema.at(-21);
  const ago20 = clean.at(-21);
  const previous = clean.at(-2);
  const ago50 = clean.at(-51);
  const ago200 = clean.at(-201);
  const highs = clean.slice(-252);
  return {
    last,
    dailyChangePct: Number.isFinite(previous) && previous !== 0 ? (last / previous - 1) * 100 : null,
    ema200: latestEma,
    emaSlope20dPct: Number.isFinite(slopeBase) && slopeBase !== 0 && Number.isFinite(latestEma) ? (latestEma / slopeBase - 1) * 100 : null,
    return20dPct: Number.isFinite(ago20) && ago20 !== 0 ? (last / ago20 - 1) * 100 : null,
    return50dPct: Number.isFinite(ago50) && ago50 !== 0 ? (last / ago50 - 1) * 100 : null,
    return200dPct: Number.isFinite(ago200) && ago200 !== 0 ? (last / ago200 - 1) * 100 : null,
    high52w: highs.length ? Math.max(...highs) : null,
    low52w: highs.length ? Math.min(...highs) : null,
    aboveEma200: Number.isFinite(last) && Number.isFinite(latestEma) ? last > latestEma : null
  };
}

export function classifyMarket(metrics) {
  const sp = metrics?.sp500;
  const nasdaq = metrics?.nasdaq;
  const vix = metrics?.vix?.last;
  if (Number.isFinite(vix) && vix >= 30) return { label: 'High Volatility', reason: `VIX ${vix.toFixed(1)} อยู่ที่หรือสูงกว่า 30` };
  if (!sp || !nasdaq || sp.aboveEma200 == null || nasdaq.aboveEma200 == null) return { label: 'Data unavailable', reason: 'ข้อมูล S&P 500 หรือ Nasdaq ยังไม่ครบสำหรับจัด regime' };
  const bothAbove = sp.aboveEma200 && nasdaq.aboveEma200;
  const bothBelow = !sp.aboveEma200 && !nasdaq.aboveEma200;
  const bothRising = sp.emaSlope20dPct > 0 && nasdaq.emaSlope20dPct > 0;
  const bothFalling = sp.emaSlope20dPct < 0 && nasdaq.emaSlope20dPct < 0;
  if (bothAbove && bothRising) return { label: 'Bullish Trend', reason: 'S&P 500 และ Nasdaq อยู่เหนือ EMA 200 และ EMA 200 สูงขึ้นเมื่อเทียบกับ 20 วันซื้อขายก่อน' };
  if (bothAbove) return { label: 'Weakening Uptrend', reason: 'ดัชนีทั้งคู่ยังอยู่เหนือ EMA 200 แต่ความชันของ EMA ไม่ได้เพิ่มขึ้นพร้อมกัน' };
  if (bothBelow && bothFalling) return { label: 'Bearish Trend', reason: 'S&P 500 และ Nasdaq อยู่ต่ำกว่า EMA 200 และ EMA 200 ลดลงเมื่อเทียบกับ 20 วันซื้อขายก่อน' };
  return { label: 'Sideways / Mixed', reason: 'ทิศทางหรือความชันของ S&P 500 และ Nasdaq ยังไม่สอดคล้องกัน' };
}
