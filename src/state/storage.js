const KEYS = { settings: 'stocklens-radar-settings-v1', watchlist: 'stocklens-radar-watchlist-v1', journal: 'stocklens-radar-journal-v1', alerts: 'stocklens-radar-alerts-v1', financials: 'stocklens-radar-financials-v1', valuation: 'stocklens-radar-valuation-v1', screener: 'stocklens-radar-screener-v1', paper: 'stocklens-radar-paper-v1' };

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(KEYS[key] || key);
    return raw == null ? structuredClone(fallback) : JSON.parse(raw);
  } catch { return structuredClone(fallback); }
}
export function write(key, value) {
  try { localStorage.setItem(KEYS[key] || key, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function getSettings() { return { mode: 'demo', apiBase: '', ...read('settings', {}) }; }
export function setSettings(value) { return write('settings', value); }
export function getWatchlist() {
  const current = read('watchlist', null);
  if (Array.isArray(current)) return current.map(item => typeof item === 'string' ? { symbol: item, group: 'ไม่จัดกลุ่ม', addedAt: new Date().toISOString(), status: 'กำลังติดตาม' } : item).filter(item => item?.symbol);
  try {
    const old = JSON.parse(localStorage.getItem('slb-watchlist-v3') || '[]');
    return Array.isArray(old) ? old.map(symbol => ({ symbol: String(symbol).toUpperCase(), group: 'ไม่จัดกลุ่ม', addedAt: new Date().toISOString(), status: 'กำลังติดตาม' })) : [];
  } catch { return []; }
}
export function setWatchlist(value) { return write('watchlist', value); }
export function snapshotWorkspace() {
  return { version: 1, exportedAt: new Date().toISOString(), settings: getSettings(), watchlist: getWatchlist(), journal: read('journal', []), alerts: read('alerts', []), financials: read('financials', {}), valuation: read('valuation', {}), screener: read('screener', {}), paper: read('paper', {startingCash:100000,trades:[]}) };
}
export function importWorkspace(value) {
  if (!value || value.version !== 1) throw new Error('ไฟล์ Workspace version ไม่รองรับ');
  const validators = {
    settings: item => item && typeof item === 'object' && ['demo','live'].includes(item.mode) && typeof (item.apiBase ?? '') === 'string',
    watchlist: item => Array.isArray(item) && item.every(row => row && typeof row.symbol === 'string' && /^[A-Z0-9.^_-]{1,15}$/.test(row.symbol)),
    journal: item => Array.isArray(item) && item.every(row => row && typeof row.id === 'string' && typeof (row.ticker ?? row.symbol) === 'string'),
    alerts: item => Array.isArray(item) && item.every(row => row && typeof row.id === 'string' && typeof row.symbol === 'string'),
    financials: item => item && typeof item === 'object' && !Array.isArray(item),
    valuation: item => item && typeof item === 'object' && !Array.isArray(item),
    screener: item => item && typeof item === 'object' && !Array.isArray(item),
    paper: item => item && typeof item === 'object' && Number.isFinite(item.startingCash) && item.startingCash >= 0 && Array.isArray(item.trades) && item.trades.every(row => row && typeof row.symbol === 'string' && ['buy','sell'].includes(row.side) && Number.isFinite(row.quantity) && row.quantity > 0 && Number.isFinite(row.price) && row.price > 0)
  };
  for (const [key, validate] of Object.entries(validators)) {
    if (key in value) {
      if (!validate(value[key])) throw new Error(`ข้อมูล ${key} ในไฟล์ไม่ถูกต้อง`);
    }
  }
  for (const key of Object.keys(validators)) if (key in value) write(key, value[key]);
}
export function clearWorkspace() { Object.values(KEYS).forEach(key => localStorage.removeItem(key)); }