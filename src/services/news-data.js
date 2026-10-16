import { getSettings } from '../state/storage.js';

export async function fetchNews({ symbol = '', market = false } = {}) {
  const settings = getSettings();
  if (settings.mode !== 'live') return { ok:true, items:[], mode:'demo', provider:null, message:'Demo mode ไม่แสดงข่าวจำลอง' };
  const base = settings.apiBase.replace(/\/$/,'').replace(/\/api$/i,'');
  const root = base ? `${base}/api/news` : './api/news';
  const query = new URLSearchParams(market ? { mode:'market' } : { symbol, market:'US' });
  const response = await fetch(`${root}?${query}`,{headers:{Accept:'application/json'}});
  const payload = await response.json().catch(()=>({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error || `News API returned ${response.status}`);
  return payload;
}
