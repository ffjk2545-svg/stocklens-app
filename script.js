/* StockLens Booji v3 — vanilla JS, Vercel serverless API + official TradingView embeds */
const $ = (id) => document.getElementById(id);
const today = new Date();
$('todayLabel').textContent = today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

const STORE = {
  watchlist: 'slb-watchlist-v3',
  history: 'slb-history-v3',
  checklist: 'slb-checklist-v3'
};
const DEFAULT_HISTORY = ['NVDA', 'KO', 'PTT'];
let searchHistory = readStore(STORE.history, DEFAULT_HISTORY);
let watchlist = readStore(STORE.watchlist, []);
let activeSymbol = '';
let toastTimer;

function readStore(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback.slice(); }
  catch { return fallback.slice(); }
}
function saveStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode/storage disabled */ } }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function notify(message) {
  const box = $('toast'); box.textContent = message; box.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('show'), 3000);
}
function formatMoney(n) {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n);
}
function formatSigned(n) {
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}
function plainTicker() { return $('ticker').value.trim().toUpperCase(); }

const NASDAQ = new Set(['NVDA','AAPL','MSFT','GOOGL','GOOG','AMZN','META','TSLA','AMD','AVGO','NFLX','COST','ADBE','PLTR','INTC','QCOM','CSCO','PEP','TXN','MU','SMCI','ARM','PANW','CRWD','PYPL','SHOP','UBER','ISRG','BKNG','MELI','TSM']);
const NYSE = new Set(['KO','JPM','BAC','WMT','XOM','CVX','V','MA','MCD','DIS','NKE','ORCL','T','F','GM','IBM','GE','CAT','BA','PFE','JNJ','LLY','ABBV','MRK','C','GS','MS','BLK','UNH','HD','LOW','DE','WFC','CRM','ACN','NOW','SPOT']);
function getTvSymbol(ticker = plainTicker(), market = $('market').value) {
  const value = ticker.trim().toUpperCase();
  if (value.includes(':')) return value;
  if (market === 'TH') return `SET:${value.replace(/\.BK$/i, '')}`;
  if (market === 'US') {
    if (NYSE.has(value)) return `NYSE:${value}`;
    if (NASDAQ.has(value)) return `NASDAQ:${value}`;
    return `NASDAQ:${value}`; // users may enter EXCHANGE:TICKER when the default exchange differs
  }
  return value;
}
function tradingViewUrl(symbol = getTvSymbol()) { return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`; }
function updateSourceLinks(symbol) {
  const link = tradingViewUrl(symbol);
  $('tvSymbolLink').href = link;
  $('chartExternalLink').href = link;
  $('chartSymbolLabel').textContent = symbol;
  $('quoteTitle').textContent = plainTicker();
}

function mountWidget(containerId, scriptName, config, minHeight = 180, showCredit = true) {
  const target = $(containerId);
  if (!target) return;
  target.replaceChildren();
  target.style.minHeight = `${minHeight}px`;
  const wrapper = document.createElement('div');
  wrapper.className = 'tradingview-widget-container';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.minHeight = `${minHeight}px`;
  const inner = document.createElement('div');
  inner.className = 'tradingview-widget-container__widget';
  inner.style.width = '100%'; inner.style.height = '100%'; inner.style.minHeight = `${minHeight}px`;
  wrapper.appendChild(inner);
  if (showCredit) {
    const credit = document.createElement('div');
    credit.className = 'tv-copyright';
    const link = document.createElement('a');
    link.href = config.symbol ? tradingViewUrl(config.symbol) : 'https://www.tradingview.com/markets/';
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = 'ข้อมูลตลาดและกราฟโดย TradingView';
    credit.appendChild(link); wrapper.appendChild(credit);
  }
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = `https://s3.tradingview.com/external-embedding/${scriptName}`;
  script.async = true;
  script.textContent = JSON.stringify(config);
  script.onerror = () => {
    target.innerHTML = '<div class="widget-placeholder"><div><strong>วิดเจ็ตโหลดไม่สำเร็จ</strong>ลองรีเฟรชหน้า หรือเปิดข้อมูลจากลิงก์ TradingView ด้านบน</div></div>';
  };
  wrapper.appendChild(script);
  target.appendChild(wrapper);
}

function mountTickerTape() {
  mountWidget('tickerTape', 'embed-widget-ticker-tape.js', {
    symbols: [
      {proName:'NASDAQ:NVDA',title:'NVIDIA'},
      {proName:'NASDAQ:AAPL',title:'Apple'},
      {proName:'NASDAQ:MSFT',title:'Microsoft'},
      {proName:'NYSE:KO',title:'Coca-Cola'},
      {proName:'SET:PTT',title:'PTT'}
    ], showSymbolLogo:true, colorTheme:'light', isTransparent:true, displayMode:'adaptive', locale:'en'
  }, 44, false);
  const wrapper = $('tickerTape').querySelector('.tradingview-widget-container');
  if (wrapper) wrapper.style.minHeight = '44px';
}
function mountEconomicCalendar() {
  mountWidget('economicCalendarWidget', 'embed-widget-events.js', {
    colorTheme:'light', isTransparent:true, locale:'en',
    countryFilter:'au,ca,cn,de,eu,gb,id,in,it,jp,kr,th,us',
    importanceFilter:'-1,0,1', width:'100%', height:'500'
  }, 500);
}
function mountStockWidgets(symbol) {
  updateSourceLinks(symbol);
  mountWidget('symbolInfoWidget', 'embed-widget-symbol-info.js', {
    symbol, width:'100%', colorTheme:'light', isTransparent:true, locale:'en'
  }, 185);
  mountWidget('advancedChartWidget', 'embed-widget-advanced-chart.js', {
    autosize:true, symbol, interval:'D', timezone:'Asia/Bangkok', theme:'light', style:'1', locale:'en',
    allow_symbol_change:true, calendar:false, support_host:'https://www.tradingview.com',
    withdateranges:true, details:true, hotlist:true, hide_side_toolbar:false, save_image:false,
    studies:['Volume@tv-basicstudies','MASimple@tv-basicstudies'], width:'100%', height:570
  }, 570);
  mountWidget('technicalWidget', 'embed-widget-technical-analysis.js', {
    interval:'1D', width:'100%', isTransparent:true, height:450, symbol,
    showIntervalTabs:true, displayMode:'multiple', locale:'en', colorTheme:'light'
  }, 450);
  mountWidget('companyProfileWidget', 'embed-widget-symbol-profile.js', {
    width:'100%', height:300, colorTheme:'light', isTransparent:true, symbol, locale:'en'
  }, 300);
  mountWidget('financialsWidget', 'embed-widget-financials.js', {
    symbol, colorTheme:'light', isTransparent:true, displayMode:'adaptive',
    width:'100%', height:500, locale:'en'
  }, 500);
  mountWidget('newsWidget', 'embed-widget-timeline.js', {
    feedMode:'symbol', symbol, colorTheme:'light', isTransparent:true,
    displayMode:'regular', width:'100%', height:460, locale:'en'
  }, 460);
}

function renderHistory() {
  const container = $('history'); container.replaceChildren();
  searchHistory.forEach(symbol => {
    const btn = document.createElement('button'); btn.className = 'chip'; btn.type = 'button'; btn.textContent = symbol;
    btn.addEventListener('click', () => { $('ticker').value = symbol; $('analyzeBtn').click(); });
    container.appendChild(btn);
  });
}
function renderWatchlist() {
  const container = $('watchlistItems'); container.replaceChildren();
  $('watchlistEmpty').classList.toggle('hidden', watchlist.length > 0);
  $('watchlistHeroCount').textContent = `${watchlist.length} หุ้น`;
  watchlist.forEach(symbol => {
    const chip = document.createElement('div'); chip.className = 'watch-item';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'watch-open'; open.textContent = symbol;
    open.addEventListener('click', () => { $('ticker').value = symbol; $('analyzeBtn').click(); window.scrollTo({top:0,behavior:'smooth'}); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'watch-remove'; remove.setAttribute('aria-label', `นำ ${symbol} ออกจากรายการ`); remove.textContent = '×';
    remove.addEventListener('click', () => { watchlist = watchlist.filter(s => s !== symbol); saveStore(STORE.watchlist, watchlist); renderWatchlist(); notify(`นำ ${symbol} ออกจากรายการติดตามแล้ว`); });
    chip.append(open, remove); container.appendChild(chip);
  });
}
function addWatchlist() {
  const ticker = plainTicker(); if (!ticker) { notify('กรอกชื่อหุ้นก่อนเพิ่มรายการ'); return; }
  if (!/^[A-Z0-9.^_:\-]{1,30}$/.test(ticker)) { notify('รูปแบบ ticker ไม่ถูกต้อง'); return; }
  if (watchlist.includes(ticker)) { notify(`${ticker} อยู่ในรายการติดตามแล้ว`); return; }
  watchlist.unshift(ticker); watchlist = watchlist.slice(0,20); saveStore(STORE.watchlist,watchlist); renderWatchlist(); notify(`เพิ่ม ${ticker} ใน Watchlist แล้ว`);
}

function promptTemplate(ticker, market, horizon, tvSymbol, evidence) {
  return `คุณเป็นผู้ช่วยวิเคราะห์หุ้น StockLens Booji ที่เน้นความรอบคอบ อธิบายให้มือใหม่เข้าใจเป็นภาษาไทย
หุ้น: ${ticker}
ตลาด: ${market}
ระยะมองลงทุนที่ผู้ใช้สนใจ: ${horizon}
สัญลักษณ์สำหรับตรวจข้อมูลภายนอก: ${tvSymbol}

ข้อมูลตัวเลขที่ผู้ใช้คัดลอกจาก TradingView มาให้ (อาจว่างเปล่า):
${evidence || '(ผู้ใช้ยังไม่ได้ให้ตัวเลขจากวิดเจ็ต)'}

ข้อจำกัดข้อมูลสำคัญ:
- คุณไม่ได้รับราคาสดหรืองบล่าสุดจาก TradingView และคุณไม่สามารถเปิดเว็บไซต์ TradingView หรือ Forex Factory จากคำขอนี้ได้เอง ห้ามอ้างว่าได้ตรวจเว็บสดหรืออ้างว่าใช้ข้อมูลล่าสุดแล้ว
- ห้ามแต่งตัวเลขราคา Market Cap, P/E, รายได้, กำไร, หนี้, Dividend Yield, ผลประกอบการล่าสุด, วันที่งบ หรือราคาเป้าหมาย
- ถ้ามีตัวเลขจากผู้ใช้ ให้วิเคราะห์เฉพาะตามสิ่งที่ระบุ พร้อมบอกว่าข้อมูลนั้นผู้ใช้เป็นผู้ป้อนและต้องตรวจวันที่/หน่วย/งวดรายงาน
- หากยังขาดข้อมูล อย่าตอบสั้น ๆ ว่า “ไม่มีข้อมูล” ให้บอกว่าควรไปดูบรรทัดไหนในวิดเจ็ต TradingView และตัวเลขนั้นช่วยตอบคำถามอะไร
- แยกข้อเท็จจริงทั่วไปของธุรกิจออกจากสมมติฐาน/ความเสี่ยง และไม่ให้คำสั่งซื้อหรือขายแบบฟันธง
- อธิบายคำศัพท์การเงินเป็นภาษาไทยง่าย ๆ และระบุกรอบเวลาเมื่อมีการพูดถึงสิ่งที่ต้องติดตาม
- ห้ามอ้างว่า Forex Factory หรือ TradingView ยืนยันข้อมูลที่ไม่ได้ส่งมาให้

ตอบเป็น JSON เท่านั้น ตาม schema ต่อไปนี้ ใช้ string หรือ array of strings ตามตัวอย่าง:
{
  "company": {"businessModel":"...", "revenueDrivers":"...", "competitiveEdge":"...", "industryContext":"..."},
  "thesis": {"bullCase":"...", "baseCase":"...", "bearCase":"...", "catalysts":"...", "whatWouldChangeMyMind":"..."},
  "financials": {"revenue":"...", "profitability":"...", "cashFlow":"...", "balanceSheet":"...", "beginnerVerdict":"..."},
  "valuation": {"metricsToCheck":"...", "interpretation":"...", "peerComparison":"..."},
  "risks": ["...", "...", "..."],
  "watchNext": ["...", "...", "...", "..."],
  "investorFit": "...",
  "dataNote": "ระบุว่าข้อมูลตัวเลขใดมาจากผู้ใช้ และข้อมูลใดควรตรวจจากวิดเจ็ตภายนอก ห้ามอ้างแหล่งที่ไม่ได้เปิดดู"
}
แต่ละหัวข้อควรมีรายละเอียดที่นำไปใช้คิดต่อได้ ไม่ใช่คำโฆษณาหรือคำตอบกำปั้นทุบดิน หากไม่แน่ใจในข้อเท็จจริงเฉพาะบริษัท ให้บอกว่าเป็นประเด็นที่ควรตรวจสอบแทนการเดา`;
}
function asText(value, fallback='') {
  if (Array.isArray(value)) return value.map(x => String(x ?? '')).filter(Boolean).join('\n');
  if (value && typeof value === 'object') return Object.entries(value).map(([k,v]) => `${k}: ${v}`).join('\n');
  return String(value ?? fallback);
}
function block(title, icon, content, wide=false, list=false) {
  const text = Array.isArray(content) ? content : null;
  const guidance = {
    'โมเดลธุรกิจ':'ตรวจ Company Profile widget เพื่ออ่านว่าบริษัทขายอะไร ให้ใคร และอยู่ในอุตสาหกรรมใด',
    'รายได้มาจากไหน':'เปิด Financials แล้วดูรายได้แยกตามงวด พร้อมอ่าน Company Profile เพื่อเข้าใจแหล่งรายได้',
    'จุดแข็ง / ความได้เปรียบ':'ลองตรวจว่าบริษัทมีต้นทุนต่ำกว่า เครือข่าย ลูกค้าเหนียวแน่น เทคโนโลยี หรือแบรนด์ที่คู่แข่งเลียนแบบยากจริงหรือไม่',
    'รายได้และการเติบโต':'ดูรายได้รายไตรมาสและรายปีใน Financials เปรียบเทียบหลายงวดและแยกการเติบโตแบบปกติออกจากรายการพิเศษ',
    'กำไรและคุณภาพกำไร':'เปรียบเทียบ gross margin, operating margin และ net margin หลายงวด แล้วหาสาเหตุหากอัตรากำไรเปลี่ยน',
    'กระแสเงินสด':'ดู cash flow from operations และ free cash flow เทียบกับกำไรสุทธิ เพื่อเช็กว่ากำไรแปลงเป็นเงินสดได้จริงหรือไม่',
    'หนี้และสภาพคล่อง':'ตรวจเงินสด หนี้ที่มีดอกเบี้ย กำหนดชำระ และความสามารถจ่ายดอกเบี้ย โดยเปรียบเทียบกับบริษัทในอุตสาหกรรมเดียวกัน',
    'ตัวชี้วัดมูลค่าที่ควรดู':'ตรวจ P/E, forward P/E, EV/EBITDA, P/S หรือ P/B ตามลักษณะธุรกิจ และเทียบกับการเติบโตกับคู่แข่ง',
    'ความเสี่ยงหลัก':'ระบุความเสี่ยงทางธุรกิจ การแข่งขัน กฎระเบียบ หนี้ ค่าเงิน และความเสี่ยงที่ความคาดหวังในราคาสูงเกินไป',
    'สิ่งที่ต้องติดตามต่อ':'ติดตามงบครั้งถัดไป แนวโน้มรายได้/กำไร กระแสเงินสด หนี้ และข่าวที่เปลี่ยนสมมติฐานการลงทุน'
  };
  const fallback = guidance[title] || 'หัวข้อนี้ยังไม่ได้รับการยืนยันจากข้อมูลที่ส่งให้ AI — ตรวจตัวเลขจริงในวิดเจ็ต TradingView และตรวจงวดรายงานก่อนตัดสินใจ ไม่ควรแทนข้อมูลที่ขาดด้วยการเดา';
  const inside = list && text
    ? `<ul>${text.filter(Boolean).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : `<p>${escapeHtml(asText(content, fallback)).replace(/\n/g,'<br>')}</p>`;
  return `<section class="report-block${wide?' wide':''}"><h3><span>${icon}</span>${escapeHtml(title)}</h3>${inside}</section>`;
}
function renderReport(data, ticker, tvSymbol, evidenceProvided) {
  const company = data.company || {};
  const thesis = data.thesis || {};
  const financials = data.financials || {};
  const valuation = data.valuation || {};
  // Compatibility with the previous report schema while safely rendering the model's text.
  const old = !data.company && (data.A_CompanyProfile || data.B_MarketSnapshot);
  const sections = old ? [
    block('รู้จักบริษัท','🏢',data.A_CompanyProfile,true),
    block('ภาพรวมตลาดที่ควรตรวจ','📊',data.B_MarketSnapshot,true),
    block('สุขภาพการเงิน','💰',data.C_Financial),
    block('การประเมินมูลค่า','🏷️',data.D_Valuation),
    block('Booji Insight','🐱',data.E_BoojiInsight,true),
    block('แหล่งที่มาและข้อจำกัด','🔎',data.F_Sources,true)
  ].join('') : [
    block('โมเดลธุรกิจ','🏢',company.businessModel || 'ตรวจที่ Company Profile widget เพื่อดูธุรกิจและอุตสาหกรรม',true),
    block('รายได้มาจากไหน','💸',company.revenueDrivers),
    block('จุดแข็ง / ความได้เปรียบ','🛡️',company.competitiveEdge),
    block('บริบทอุตสาหกรรม','🌐',company.industryContext),
    block('กรณีบวก (Bull case)','🟢',thesis.bullCase),
    block('กรณีฐาน (Base case)','⚖️',thesis.baseCase),
    block('กรณีลบ (Bear case)','🔴',thesis.bearCase),
    block('ตัวเร่งที่ควรติดตาม','⚡',thesis.catalysts,true),
    block('อะไรจะทำให้เราเปลี่ยนใจ?','🧭',thesis.whatWouldChangeMyMind,true),
    block('รายได้และการเติบโต','📈',financials.revenue),
    block('กำไรและคุณภาพกำไร','🧾',financials.profitability),
    block('กระแสเงินสด','💵',financials.cashFlow),
    block('หนี้และสภาพคล่อง','🏦',financials.balanceSheet),
    block('สรุปให้อ่านง่าย','💡',financials.beginnerVerdict,true),
    block('ตัวชี้วัดมูลค่าที่ควรดู','🏷️',valuation.metricsToCheck),
    block('แปลความถูก/แพงอย่างไร','🧮',valuation.interpretation),
    block('เทียบกับคู่แข่ง','🧩',valuation.peerComparison),
    block('ความเสี่ยงหลัก','🚧',data.risks,true,true),
    block('สิ่งที่ต้องติดตามต่อ','🔭',data.watchNext,true,true),
    block('หุ้นนี้เหมาะกับนักลงทุนแบบไหน?','👤',data.investorFit,true),
    block('ขอบเขตของข้อมูล','🔎',data.dataNote,true)
  ].join('');
  $('analysisCard').innerHTML = `<div class="ai-output"><div class="ai-banner"><span class="badge">🐱 Booji Research Brief</span><span class="badge tag">${escapeHtml(ticker)} · ${escapeHtml($('analysisHorizon').value)}</span><span class="micro-label">สร้างเมื่อ ${new Date().toLocaleString('th-TH')}</span></div><div class="report-grid">${sections}</div><div class="ai-disclaimer"><b>อ่านให้ถูก:</b> ข้อความนี้เป็นคำอธิบายเชิงคุณภาพจาก AI ไม่ใช่ข้อมูลตลาดสด ตัวเลขที่คุณกรอก: ${evidenceProvided ? 'มี — ตรวจวัน/หน่วย/งวดที่มาของตัวเลขด้วย' : 'ไม่มี — โปรดอ่านค่าจริงจาก TradingView widgets บนหน้านี้ก่อนตัดสินใจ'}. กราฟและข้อมูลพื้นฐานแสดงจากวิดเจ็ตภายนอกและอาจล่าช้าตามสิทธิ์ข้อมูลของตลาด · ไม่ใช่คำแนะนำซื้อขาย</div></div>`;
}

async function analyze() {
  const ticker = plainTicker();
  const market = $('market').value;
  const horizon = $('analysisHorizon').value;
  const evidence = $('evidenceInput').value.trim();
  if (!ticker) { notify('กรอกชื่อหุ้นก่อนครับ'); $('ticker').focus(); return; }
  if (!/^[A-Z0-9.^_:\-]{1,30}$/.test(ticker)) { notify('รูปแบบ ticker ไม่ถูกต้อง — ลองใช้ NASDAQ:NVDA หรือ SET:PTT'); return; }
  const btn = $('analyzeBtn'); const oldText = $('btnText').innerHTML;
  btn.disabled = true; $('btnText').innerHTML = '<span class="spinner"></span> กำลังเรียบเรียงข้อมูล…';
  $('errorText').classList.add('hidden');
  const tvSymbol = getTvSymbol(ticker,market); activeSymbol = tvSymbol;
  mountStockWidgets(tvSymbol);
  try {
    const response = await fetch('/api/analyze', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:promptTemplate(ticker,market,horizon,tvSymbol,evidence)}]}]})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Server Error: ${response.status}`);
    const raw = payload.candidates?.[0]?.content?.parts?.map(p=>p.text || '').join('').trim();
    if (!raw) throw new Error(payload.promptFeedback?.blockReason ? `คำขอถูกปฏิเสธ: ${payload.promptFeedback.blockReason}` : 'โมเดลไม่ได้ส่งข้อความกลับมา ลองใหม่อีกครั้ง');
    const clean = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { throw new Error('AI ส่งข้อมูลกลับมาในรูปแบบที่อ่านไม่ได้ ลองกดวิเคราะห์อีกครั้ง'); }
    renderReport(parsed,ticker,tvSymbol,Boolean(evidence));
    if (!searchHistory.includes(ticker)) { searchHistory.unshift(ticker); searchHistory = searchHistory.slice(0,6); saveStore(STORE.history,searchHistory); renderHistory(); }
    $('aiAnalysis').scrollIntoView({behavior:'smooth',block:'start'});
    notify(`สร้าง Research Brief สำหรับ ${ticker} แล้ว`);
  } catch (error) {
    console.error('StockLens Booji analysis error:',error);
    $('errorText').textContent = `วิเคราะห์ไม่สำเร็จ: ${error.message}\n\nกราฟและวิดเจ็ต TradingView ยังคงใช้งานแยกจาก AI ได้ ลองเปิดจากลิงก์ TradingView หรือเช็กการตั้งค่า GEMINI_API_KEY บน Vercel`;
    $('errorText').classList.remove('hidden');
  } finally { btn.disabled = false; $('btnText').innerHTML = oldText; }
}

// Editable what-if calculator: monthly compounding with contributions at the end of each month.
function portfolioValue(initial, monthly, annualRate, years) {
  const months = years * 12; const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
  if (Math.abs(monthlyRate) < 1e-9) return initial + monthly * months;
  const growth = Math.pow(1 + monthlyRate, months);
  return initial * growth + monthly * ((growth - 1) / monthlyRate);
}
function scenarioPath(initial, monthly, rate, years) {
  const values=[]; for(let y=0;y<=years;y++) values.push(portfolioValue(initial,monthly,rate,y)); return values;
}
function renderForecast() {
  const initial = Math.max(0,Number($('initialCapital').value)||0);
  const monthly = Math.max(0,Number($('monthlyContribution').value)||0);
  const years = Math.max(1,Number($('projectionYears').value)||5);
  const scenarios = [
    {key:'bear',name:'กรณีแย่',rate:Number($('bearRate').value),className:'bear',color:'#e36d74'},
    {key:'base',name:'กรณีฐาน',rate:Number($('baseRate').value),className:'base',color:'#16a875'},
    {key:'bull',name:'กรณีดี',rate:Number($('bullRate').value),className:'bull',color:'#4d89e7'}
  ];
  const safeScenarios = scenarios.map(s=>({...s,rate:Number.isFinite(s.rate)?Math.max(-80,Math.min(100,s.rate)):0}));
  const totalContribution = initial + monthly * years * 12;
  $('forecastSubtitle').textContent = `จำลอง ${years} ปี · เงินสะสมที่ใส่เข้าไป ${formatMoney(totalContribution)} หน่วยเงิน`;
  $('scenarioCards').innerHTML = safeScenarios.map(s=>{
    const value=portfolioValue(initial,monthly,s.rate/100,years); const difference=value-totalContribution;
    const deltaColor=difference>=0?'#0b8f69':'#c74750';
    return `<div class="scenario ${s.className}"><div class="scenario-name">${s.name}</div><div class="scenario-rate">${formatSigned(s.rate)} / ปี</div><div class="scenario-value">${formatMoney(value)}</div><div class="scenario-delta" style="color:${deltaColor}">${difference>=0?'+':''}${formatMoney(difference)} เทียบเงินที่ใส่</div></div>`;
  }).join('');
  drawForecastChart(initial,monthly,years,safeScenarios);
  const price = Number($('referencePrice').value);
  if (Number.isFinite(price) && price > 0) {
    const targets = safeScenarios.map(s=>`${s.name}: ${(price*Math.pow(1+s.rate/100,years)).toLocaleString('th-TH',{maximumFractionDigits:2})}`).join(' · ');
    $('priceTargetNote').textContent = `ถ้าราคาอ้างอิง ${price.toLocaleString('th-TH')} และผลตอบแทนทบต้นตามสมมติฐานตลอด ${years} ปี ราคาสมมติจะเป็น ${targets} — ไม่ใช่เป้าหมายราคาจากนักวิเคราะห์ และไม่รวมปันผล/ค่าเงิน/ภาษี/ค่าธรรมเนียม`;
  } else {
    $('priceTargetNote').textContent = 'กรอกราคาอ้างอิงจาก TradingView หากต้องการดู “ราคาสมมติ” ของหุ้นภายใต้ CAGR ที่ตั้งไว้ ราคาจะไม่ถูกดึงอัตโนมัติจากวิดเจ็ต';
  }
}
function drawForecastChart(initial,monthly,years,scenarios) {
  const svg=$('forecastChart'); const W=760,H=310,L=62,R=18,T=18,B=38, plotW=W-L-R,plotH=H-T-B;
  const allValues=scenarios.flatMap(s=>scenarioPath(initial,monthly,s.rate/100,years));
  let min=0,max=Math.max(1,...allValues); if(min===max) max=min+1;
  const y=(v)=>T+(max-v)/(max-min)*plotH; const x=(yr)=>L+(yr/years)*plotW;
  let markup='';
  for(let i=0;i<5;i++) { const val=min+(max-min)*i/4, yy=y(val); markup+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e5ede9" stroke-width="1"/><text x="${L-9}" y="${yy+4}" text-anchor="end" fill="#73867e" font-size="10">${formatCompact(val)}</text>`; }
  for(let i=0;i<=years;i++) { if(years>5 && i%Math.ceil(years/5)!==0 && i!==years) continue; const xx=x(i); markup+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#eff3f1" stroke-width="1"/><text x="${xx}" y="${H-13}" text-anchor="middle" fill="#73867e" font-size="10">ปี ${i}</text>`; }
  scenarios.forEach(s=>{const vals=scenarioPath(initial,monthly,s.rate/100,years);const d=vals.map((v,i)=>`${i?'L':'M'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');markup+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;const end=vals[vals.length-1];markup+=`<circle cx="${x(years)}" cy="${y(end)}" r="4" fill="${s.color}" stroke="white" stroke-width="1.5"/>`;});
  svg.innerHTML=markup;
}
function formatCompact(v){ if (Math.abs(v)>=1e9) return `${(v/1e9).toFixed(1)}B`; if(Math.abs(v)>=1e6)return `${(v/1e6).toFixed(1)}M`;if(Math.abs(v)>=1e3)return `${(v/1e3).toFixed(0)}k`;return `${Math.round(v)}`; }

function setupChecklist() {
  const key = STORE.checklist;
  const todayKey = new Date().toLocaleDateString('en-CA');
  let saved; try { saved=JSON.parse(localStorage.getItem(key)||'null'); } catch { saved=null; }
  if (!saved || saved.date!==todayKey) saved={date:todayKey,checked:{}};
  document.querySelectorAll('.daily-check').forEach(box=>{
    box.checked=Boolean(saved.checked[box.dataset.key]);
    box.addEventListener('change',()=>{
      const checked={};document.querySelectorAll('.daily-check').forEach(item=>checked[item.dataset.key]=item.checked);
      try{localStorage.setItem(key,JSON.stringify({date:todayKey,checked}));}catch{}
    });
  });
}

$('analyzeBtn').addEventListener('click',analyze);
$('addWatchBtn').addEventListener('click',addWatchlist);
$('clearEvidenceBtn').addEventListener('click',()=>{$('evidenceInput').value='';notify('ล้างตัวเลขที่วางแล้ว');});
$('ticker').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();analyze();}});
['initialCapital','monthlyContribution','projectionYears','referencePrice','bearRate','baseRate','bullRate'].forEach(id=>$(id).addEventListener('input',renderForecast));
$('market').addEventListener('change',()=>{if(activeSymbol){mountStockWidgets(getTvSymbol());}});
$('menuBtn').addEventListener('click',()=>{$('mainNav').classList.toggle('open');});
document.querySelectorAll('#mainNav a').forEach(a=>a.addEventListener('click',()=>$('mainNav').classList.remove('open')));

renderHistory(); renderWatchlist(); renderForecast(); setupChecklist(); mountTickerTape(); mountEconomicCalendar();
// Load a starter symbol on initial view so the page is useful before requesting an AI report.
mountStockWidgets(getTvSymbol('NVDA','US'));
