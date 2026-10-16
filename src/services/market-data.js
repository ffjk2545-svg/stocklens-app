import { getSettings } from '../state/storage.js';
import { makeDemoPayload } from './demo-provider.js';

const pending = new Map();
const endpoint = (path, settings) => {
  const base = settings.apiBase.replace(/\/$/,'').replace(/\/api$/i,'');
  return base ? `${base}/api/${path}` : `./api/${path}`;
};
export function dataMode() { return getSettings().mode; }
export async function fetchMarket(symbols = [], includeBenchmarks = false, force = false) {
  const settings = getSettings();
  if (settings.mode === 'demo') return makeDemoPayload(symbols,includeBenchmarks);
  const unique = [...new Set(symbols.map(value=>value.toUpperCase()).filter(Boolean))].slice(0,20);
  const query = new URLSearchParams();
  if (unique.length) query.set('symbols',unique.join(','));
  if (!includeBenchmarks) query.set('benchmarks','0');
  const url = `${endpoint('market',settings)}${query.size?`?${query}`:''}`;
  const cacheKey = `${url}:${force?Date.now():'pending'}`;
  if (pending.has(cacheKey)) return pending.get(cacheKey);
  const request = fetch(url,{headers:{Accept:'application/json'},cache:force?'no-store':'default'}).then(async response=>{
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.ok)throw new Error(payload.error||`Market API returned ${response.status}`);
    return {...payload,mode:'live'};
  }).finally(()=>pending.delete(cacheKey));
  pending.set(cacheKey,request);return request;
}
