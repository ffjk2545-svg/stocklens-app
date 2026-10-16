import { atr, ema, findStructure, marketRegime, riskReward, rsi } from './analysis/indicators.js';
import { decodeFinancials, valuationNotes } from './analysis/financial-summary.js';
import { fetchMarket, dataMode } from './services/market-data.js';
import { fetchNews } from './services/news-data.js';
import { getSettings, setSettings, getWatchlist, setWatchlist, read, write, snapshotWorkspace, importWorkspace, clearWorkspace } from './state/storage.js';
import { lineChart, sparkline } from './ui/charts.js';
import { calculatePaperPortfolio, validatePaperTrade } from './analysis/paper-portfolio.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const tickers = ['NVDA','AAPL','MSFT','AMZN','GOOGL','META','AVGO','COST','JPM','LLY','WMT','TSLA'];
const sectorDefs = [
  ['XLK','เทคโนโลยี','เทคโนโลยี'],['XLC','บริการสื่อสาร','สื่อสาร'],['XLY','สินค้าอุปโภคบริโภคฟุ่มเฟือย','ฟุ่มเฟือย'],['XLP','สินค้าอุปโภคบริโภคจำเป็น','จำเป็น'],['XLV','สุขภาพ','สุขภาพ'],['XLF','การเงิน','การเงิน'],['XLI','อุตสาหกรรม','อุตสาหกรรม'],['XLE','พลังงาน','พลังงาน'],['XLB','วัสดุ','วัสดุ'],['XLU','สาธารณูปโภค','สาธารณูปโภค'],['XLRE','อสังหาริมทรัพย์','อสังหาฯ']
];
const flowDefs = [['SPY','หุ้นสหรัฐฯ'],['ACWX','หุ้นต่างประเทศ'],['QQQ','หุ้นเทคโนโลยีขนาดใหญ่'],['IWM','หุ้นขนาดเล็ก'],['TLT','พันธบัตรรัฐบาลระยะยาว'],['SGOV','ตั๋วเงินคลังระยะสั้น'],['GLD','ทองคำ'],['DBC','สินค้าโภคภัณฑ์'],['UUP','ดอลลาร์สหรัฐ'],['VNQ','กองทุนอสังหาริมทรัพย์'],['BTC-USD','บิตคอยน์']];
const state = { page:'overview', mode:'demo', market:null, marketError:'', watchData:[], sectors:[], flow:[], flowSpy:null, flowRange:'1m', scanData:[], preset:'trend', sort:{key:'return20dPct',direction:-1}, analysisSymbol:'NVDA', analysis:null, rangeDays:252, indicators:{ema20:true,ema50:true,ema200:true}, financialSummary:null, news:[], paperQuotes:[] };
let toastTimer;

function money(value,digits=2){return Number.isFinite(value)?value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';}
function pct(value,digits=1){return Number.isFinite(value)?`${value>0?'+':''}${value.toFixed(digits)}%`:'—';}
function timeLabel(value){if(!value)return 'เวลาไม่พร้อม';const d=new Date(value);if(Number.isNaN(d.valueOf()))return 'เวลาไม่พร้อม';return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'America/New_York'}).format(d);}
function fullTime(value){if(!value)return 'ไม่พร้อม';const d=new Date(value);if(Number.isNaN(d.valueOf()))return 'ไม่พร้อม';return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'}).format(d)+' · เวลานิวยอร์ก';}
function uiError(error){const message=String(error?.message||'');return /[ก-๙]/.test(message)?message:'เกิดข้อผิดพลาดในการเชื่อมต่อ โปรดตรวจการตั้งค่าแล้วลองอีกครั้ง';}
function regimeThai(label){return ({'Risk-on':'รับความเสี่ยงได้มากขึ้น','Selective Risk-on':'เลือกลงทุนอย่างระมัดระวัง','Risk-off':'ระวังความเสี่ยง','Mixed':'สัญญาณผสม','ข้อมูลไม่พอ':'ข้อมูลยังไม่พอ'})[label]||label;}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
function safeLink(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch{return '#';}}
function setBusy(id,busy,label){const el=$(`#${id}`);if(!el)return;el.disabled=busy;el.dataset.original??=el.textContent;el.textContent=busy?label:el.dataset.original;}
function settings(){return getSettings();}
function currentWatchSymbols(){return getWatchlist().map(item=>item.symbol).filter((value,index,array)=>array.indexOf(value)===index).slice(0,12);}
function findEquity(payload,symbol){return payload?.equities?.find(item=>item.symbol===symbol)||null;}
function modeName(){return dataMode()==='demo'?'ข้อมูลสาธิต':'ข้อมูลจริง · อาจล่าช้า';}
function updateModeUI(){
  const isDemo=dataMode()==='demo';
  $('#modeChip').innerHTML=`<i style="background:${isDemo?'var(--amber)':'var(--teal)'}"></i><span>${isDemo?'ข้อมูลสาธิต':'ข้อมูลจริง · อาจล่าช้า'}</span><b>⌄</b>`;
  $('#dataBanner').classList.toggle('live-banner',!isDemo);
  $('#dataBanner strong').textContent=isDemo?'ข้อมูลสาธิต — ไม่ใช่ข้อมูลตลาดจริง':'ข้อมูลจากแหล่งจริง · ราคาอาจล่าช้า';
  $('#dataBanner span').textContent=isDemo?'ตัวเลขจำลองเพื่อทดลองใช้งานเท่านั้น':'แสดงชื่อแหล่งข้อมูลและเวลาล่าสุดตามที่มี';
  $('#sidebarMode').textContent=isDemo?'โหมดสาธิต':'โหมดข้อมูลจริง';
  $('#sidebarSource').textContent=isDemo?'ข้อมูลจำลอง · ไม่ซิงก์ข้ามเครื่อง':'Yahoo Finance · Google News · Vercel';
  $$('#page-settings input[name="dataMode"]').forEach(input=>input.checked=input.value===settings().mode);
  $('#apiBase').value=settings().apiBase;
}

function goPage(name){
  if(!['overview','watchlist','paper','settings'].includes(name)||!document.querySelector(`#page-${name}`))name='overview';
  state.page=name;
  $$('.page').forEach(page=>page.classList.toggle('active',page.id===`page-${name}`));
  $$('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.page===name));
  $('#pageCrumb').textContent=document.querySelector(`#page-${name}`).dataset.title;
  history.replaceState(null,'',`#${name}`);
  $('#sidebar').classList.remove('open');$('#mobileNavBtn').setAttribute('aria-expanded','false');
  if(name==='flow')loadFlow();
  if(name==='sectors')loadSectors();
  if(name==='screener')loadScreener();
  if(name==='analysis')loadAnalysis();
  if(name==='watchlist')loadWatchlist();
  if(name==='earnings')renderFinancialInputs();
  if(name==='journal')renderJournal();
  if(name==='settings')renderSourceList();
  if(name==='paper')loadPaper();
}

function metricValue(item,key){
  if(!item)return {value:'ไม่มีข้อมูล',detail:'แหล่งข้อมูลไม่พร้อมใช้งาน',tone:'neutral'};
  const isYield=key==='yield10y';
  const value=key==='vix'?money(item.last,2):isYield?`${money(item.last,2)}%`:money(item.last,2);
  const status=item.aboveEma200==null?'':`${item.aboveEma200?'เหนือ':'ต่ำกว่า'} EMA 200`;
  return {value,detail:`${pct(item.dailyChangePct)} · ${status||'ราคาปิดรายวัน'} · ${timeLabel(item.asOf)}`,tone:item.dailyChangePct>0?'positive':item.dailyChangePct<0?'negative':'neutral'};
}
function computeBreadth(items){const valid=items.filter(item=>item&&!item.error&&item.aboveEma200!=null);return valid.length?{sample:valid.length,above:valid.filter(item=>item.aboveEma200).length,pct:valid.filter(item=>item.aboveEma200).length/valid.length*100}:null;}

async function loadOverview(force=false){
  $('#marketUpdated').textContent='กำลังโหลดข้อมูล…';
  state.marketError='';
  try{
    const [market,watch]=await Promise.all([
      fetchMarket([],true,force),
      currentWatchSymbols().length?fetchMarket(currentWatchSymbols(),false,force):Promise.resolve({equities:[]})
    ]);
    state.market=market;state.watchData=watch.equities||[];
    if(dataMode()==='live'){
      state.newsError='';
      try{const news=await fetchNews({market:true});state.news=news.items||[];}catch(error){state.news=[];state.newsError=error.message;}
    }else{state.news=[];state.newsError='โหมดสาธิตไม่มีข่าวจำลอง';}
    renderOverview();
    evaluateAlerts(state.watchData);
  }catch(error){state.marketError=error.message;state.market=null;state.watchData=[];state.sectors=[];state.news=[];renderOverview();}
}

function renderOverview(){
  const date=new Intl.DateTimeFormat('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  $('#overviewDate').textContent=date;
  const metrics=state.market?.metrics||{};
  const regime=state.market?.regime||marketRegime(metrics);
  $('#regimeLabel').textContent=state.marketError?'ยังไม่มีข้อมูล':regimeThai(regime.label);
  $('#regimeChip').textContent=dataMode()==='demo'?'ข้อมูลสาธิต · คำนวณตามกฎ':'คำนวณตามกฎ';
  $('#regimeCopy').textContent=state.marketError?`โหลดข้อมูลไม่สำเร็จ: ${uiError({message:state.marketError})}`:'สรุปจากดัชนีตลาดหลักและระดับความผันผวน เพื่อเช็กภาพรวมก่อนเริ่มวัน';
  $('#regimeScoreBar').style.width=Number.isFinite(regime.score)?`${Math.max(5,Math.min(100,(regime.score+5)*10))}%`:'0%';
  $('#regimePressure').textContent=Number.isFinite(regime.score)?`${regime.score>0?'+':''}${regime.score.toFixed(1)} / 5`:'—';
  $('#regimeReasons').innerHTML=(regime.reasons||[]).slice(0,5).map(reason=>`<span class="reason">${escape(translateReason(reason))}</span>`).join('')||'<span class="reason">ข้อมูลไม่พอสำหรับจัดภาวะตลาด</span>';
  $('#regimeLabel').className=regime.tone==='positive'?'positive':regime.tone==='negative'?'negative':'';
  const keys=[['sp500','S&P 500'],['nasdaq','Nasdaq'],['vix','VIX · ความผันผวน']];
  $('#marketMetrics').innerHTML=keys.map(([key,label])=>{const m=metricValue(metrics[key],key);return `<article class="metric-card"><div class="metric-card-head"><span>${label}</span><span class="trend-arrow">${m.tone==='positive'?'↗':m.tone==='negative'?'↘':'·'}</span></div><strong>${escape(m.value)}</strong><span class="metric-change ${m.tone}">${escape(m.detail.split(' · ')[0])}</span></article>`;}).join('');
  const breadth=computeBreadth(state.watchData);
  renderBrief(regime,metrics);renderImportantAlerts(regime,metrics,breadth);renderNewsSummary();renderOverviewWatch();
  $('#marketUpdated').textContent=state.marketError?`ไม่มีข้อมูล · ${uiError({message:state.marketError})}`:`${state.market?.provider||'—'} · อัปเดต ${fullTime(state.market?.fetchedAt)}`;
}
function renderBrief(regime,metrics){
  const items=[];
  if(!state.marketError)items.push(`ตลาด ${regimeThai(regime.label)}${regime.reasons?.[0]?` · ${translateReason(regime.reasons[0])}`:''}`);
  if(metrics.sp500&&metrics.nasdaq)items.push(`S&P 500 ${pct(metrics.sp500.dailyChangePct)} · Nasdaq ${pct(metrics.nasdaq.dailyChangePct)} เมื่อปิดตลาดล่าสุด`);
  if(metrics.vix)items.push(`VIX ${money(metrics.vix.last,2)} · ${metrics.vix.last>=30?'ความผันผวนสูง':'ความผันผวนยังไม่ถึงระดับสูง'}`);
  if(state.marketError)items.push(`ข้อมูลตลาดไม่พร้อม: ${uiError({message:state.marketError})}`);
  $('#briefList').innerHTML=items.map(item=>`<div class="brief-item"><i>›</i><span>${escape(item)}</span></div>`).join('');
  $('#briefStatus').textContent=state.marketError?'ไม่มีข้อมูล':'สรุปตามกฎ';
}
function translateReason(value){return String(value).replace('Small vs large cap (20D): แข็งกว่า','หุ้นขนาดเล็กแข็งกว่าหุ้นใหญ่ใน 20 วัน').replace('Small vs large cap (20D): อ่อนกว่า','หุ้นขนาดเล็กอ่อนกว่าหุ้นใหญ่ใน 20 วัน').replace('VIX volatility สูง','ดัชนี VIX มีความผันผวนสูง').replace('VIX volatility กลาง','ดัชนี VIX มีความผันผวนปานกลาง').replace('VIX','ดัชนี VIX').replace('slope ขึ้น','แนวโน้มเฉลี่ยกำลังขึ้น').replace('slope ลง','แนวโน้มเฉลี่ยกำลังลง').replace('EMA 200','เส้น EMA 200').replace('pp','จุดเปอร์เซ็นต์').replace('volatility สูง','ความผันผวนสูง').replace('volatility กลาง','ความผันผวนปานกลาง').replace('Data unavailable','ข้อมูลไม่พร้อมใช้งาน');}
function renderImportantAlerts(regime,metrics,breadth){
  const alerts=[];
  if(state.marketError)alerts.push(['warning','ข้อมูลตลาดยังโหลดไม่สำเร็จ',uiError({message:state.marketError})]);
  if(regime.label==='Risk-off')alerts.push(['danger','สัญญาณตลาดอ่อนแอ','ดัชนีและความผันผวนเข้าเกณฑ์ภาวะระวังความเสี่ยงตามกฎของระบบ']);
  if(metrics.vix?.last>=30)alerts.push(['danger','ความผันผวนตลาดสูง',`VIX อยู่ที่ ${money(metrics.vix.last,1)} สูงกว่าเกณฑ์ 30`]);
  if(breadth&&breadth.sample>=5&&breadth.pct<30)alerts.push(['warning','หุ้นในรายการติดตามส่วนใหญ่อยู่ใต้ EMA 200',`${breadth.above} จาก ${breadth.sample} หุ้นอยู่เหนือเส้นค่าเฉลี่ยระยะยาว`]);
  const unusual=(state.watchData||[]).filter(item=>item.bars?.length>=20&&item.bars.at(-1).volume>0&&item.bars.slice(-20).reduce((sum,bar)=>sum+(bar.volume||0),0)/20>0&&item.bars.at(-1).volume/(item.bars.slice(-20).reduce((sum,bar)=>sum+(bar.volume||0),0)/20)>=2&&Math.abs(item.dailyChangePct||0)>=3).slice(0,3);
  for(const item of unusual)alerts.push(['notice',`${item.symbol} มีปริมาณซื้อขายสูงกว่าปกติ`, `ปริมาณล่าสุดอย่างน้อย 2 เท่าค่าเฉลี่ย 20 วัน และราคาเปลี่ยน ${pct(item.dailyChangePct)} · ควรตรวจข่าวต้นทาง`]);
  if(!alerts.length)alerts.push(['clear','ยังไม่พบสัญญาณที่เข้าเกณฑ์แจ้งเตือน','เฝ้าดูจากข้อมูลล่าสุดที่โหลดได้ · เกณฑ์นี้ไม่ใช่การแจ้งข่าวแบบเรียลไทม์']);
  $('#importantAlertCount').textContent=`${alerts.length} รายการ`;
  $('#importantAlerts').innerHTML=alerts.map(([level,title,detail])=>`<article class="important-alert ${level}"><b>${escape(title)}</b><span>${escape(detail)}</span></article>`).join('');
}
function renderNewsSummary(){
  const el=$('#newsSummary');
  if(dataMode()==='demo'){el.innerHTML='<div class="news-empty">โหมดสาธิตไม่มีข่าวจำลอง เพื่อไม่ให้สับสนกับข่าวจริง</div>';return;}
  if(state.newsError){el.innerHTML=`<div class="news-empty">โหลดข่าวไม่สำเร็จ: ${escape(state.newsError)}</div>`;return;}
  if(!state.news?.length){el.innerHTML='<div class="news-empty">ไม่พบข่าวในฟีดช่วงเวลาที่ร้องขอ</div>';return;}
  el.innerHTML=`<div class="news-caption">หัวข้อข่าวจาก Google News RSS · กดเพื่ออ่านต้นฉบับ</div>`+state.news.slice(0,3).map(item=>`<a class="news-item" href="${escape(safeLink(item.link))}" target="_blank" rel="noopener noreferrer"><span>${escape(item.title)}</span><small>${escape(item.source)} · ${escape(fullTime(item.publishedAt))}</small></a>`).join('');
}
function renderSectorPulse(){
  const sorted=[...state.sectors].sort((a,b)=>(b.return20dPct||0)-(a.return20dPct||0)).slice(0,4);
  $('#sectorPulse').innerHTML=sorted.length?sorted.map((item,i)=>`<button class="pulse-row" data-sector="${escape(item.symbol)}"><span class="pulse-icon">${String(i+1).padStart(2,'0')}</span><span><b>${escape(item.name)}</b><small>${pct(item.return20dPct)} · ผลตอบแทนราคา 20 วัน</small></span>${sparkline(item.bars?.slice(-20).map(bar=>bar.close),item.return20dPct>=0?'#44d7b5':'#f17883')}</button>`).join(''):'<div class="news-empty">ยังไม่มีข้อมูล ETF อุตสาหกรรม</div>';
}
function setupFor(item){
  if(!item||item.error)return 'ไม่มีข้อมูล';
  const dist=(item.last/item.ema200-1)*100;
  if(!item.aboveEma200)return 'Below EMA 200';
  if(dist>12)return 'Extended';
  if(item.high52w&&item.last/item.high52w>.97)return 'Breakout Watch';
  if(item.emaSlope20dPct>0&&Math.abs(dist)<2)return 'Pullback';
  if(item.emaSlope20dPct>0)return 'Trend Strong';
  return 'Base Building';
}
function renderOverviewWatch(){
  const items=state.watchData||[];
  $('#overviewEmpty').classList.toggle('hidden',items.length>0);
  $('#overviewWatchRows').innerHTML=items.slice(0,5).map(item=>`<tr><td><b>${escape(item.symbol)}</b></td><td>${money(item.last)}</td><td class="${item.dailyChangePct>=0?'positive':'negative'}">${pct(item.dailyChangePct)}</td><td><a class="chart-link" href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(item.symbol)}" target="_blank" rel="noopener noreferrer">เปิดกราฟ ↗</a></td></tr>`).join('');
}
function translateSetup(value){return ({'Below EMA 200':'ต่ำกว่า EMA 200','Extended':'ราคายืดตัวมาก','Breakout Watch':'เฝ้าดูการทะลุกรอบ','Pullback':'ย่อตัวใกล้แนวโน้ม','Trend Strong':'แนวโน้มแข็งแรง','Base Building':'สร้างฐานราคา','Unavailable':'ไม่มีข้อมูล'})[value]||value;}

const returns=(item,n)=>item?.bars?.length>n?(item.bars.at(-1).close/item.bars.at(-1-n).close-1)*100:null;
const relativeReturn=(item,benchmark,n)=>Number.isFinite(returns(item,n))&&Number.isFinite(returns(benchmark,n))?returns(item,n)-returns(benchmark,n):null;
async function loadFlow(){
  $('#flowCards').innerHTML='<div class="news-empty">กำลังโหลดข้อมูลเปรียบเทียบ…</div>';
  try{const payload=await fetchMarket([...flowDefs.map(item=>item[0]),'SPY'],false);const spy=findEquity(payload,'SPY');state.flowSpy=spy;state.flow=flowDefs.map(([symbol,label])=>({...(findEquity(payload,symbol)||{}),symbol,label}));renderFlow(spy);}
  catch(error){state.flow=[];$('#flowCards').innerHTML=`<div class="news-empty">โหลดข้อมูลแรงซื้อขายไม่สำเร็จ: ${escape(uiError(error))}</div>`;}
}
function renderFlow(spy){
  const days={'1d':1,'1w':5,'1m':21,'3m':63,'6m':126}[state.flowRange]||21;
  const rows=state.flow.map(item=>{const volumes=item.bars?.slice(-20).map(bar=>bar.volume).filter(Number.isFinite)||[];const avgVolume=volumes.length?volumes.reduce((sum,value)=>sum+value,0)/volumes.length:null;return {...item,periodReturn:returns(item,days),relative:relativeReturn(item,spy,days),relativeVolume:avgVolume&&item.bars?.at(-1)?.volume?item.bars.at(-1).volume/avgVolume:null};}).filter(item=>item.last);
  rows.sort((a,b)=>(b.relative||0)-(a.relative||0));
  $('#flowCards').innerHTML=rows.map((item,index)=>`<button class="flow-card" data-flow-symbol="${escape(item.symbol)}"><div><span>${escape(item.label)}</span><span class="flow-rank">อันดับ ${index+1}</span></div><strong class="${item.periodReturn>=0?'positive':'negative'}">${pct(item.periodReturn)}</strong><small>เทียบ SPY ${pct(item.relative)} · ปริมาณ ${item.relativeVolume?`${item.relativeVolume.toFixed(2)} เท่าของค่าเฉลี่ย 20 วัน`:'—'} · ${escape(timeLabel(item.asOf))}</small></button>`).join('')||'<div class="news-empty">ไม่มีข้อมูลราคาเพื่อเปรียบเทียบ</div>';
  const spyBars=spy?.bars||[];const series=rows.slice(0,5).map((item,index)=>{
    const n=Math.min(days,item.bars.length-1,spyBars.length-1);const a=item.bars.slice(-n-1),b=spyBars.slice(-n-1);const base=a[0].close,spyBase=b[0].close;
    return {name:item.symbol,color:['#44d7b5','#7bb8ff','#b4a0ff','#eab96b','#f17883'][index],values:a.map((bar,i)=>((bar.close/base-1)-(b[i].close/spyBase-1))*100)};
  });
  lineChart('flowChart',series,{percent:true,height:225,aria:'ผลตอบแทนของสินทรัพย์เทียบกับ SPY'});
  $$('#flowTimeframes button').forEach(button=>button.classList.toggle('selected',button.dataset.range===state.flowRange));
}

function sectorRelative(item,spy){return relativeReturn(item,spy,63);}
function sectorMomentum(item,spy){
  if(!item?.bars||!spy?.bars||item.bars.length<85||spy.bars.length<85)return null;
  const curr=relativeReturn(item,spy,63);const pastN=20;const a=item.bars,b=spy.bars;
  const currRel=a.at(-1).close/b.at(-1).close/(a.at(-1-63).close/b.at(-1-63).close)-1;
  const pastRel=a.at(-1-pastN).close/b.at(-1-pastN).close/(a.at(-1-pastN-63).close/b.at(-1-pastN-63).close)-1;
  return Number.isFinite(curr)&&Number.isFinite(currRel)&&Number.isFinite(pastRel)?(currRel-pastRel)*100:null;
}
function sectorQuadrant(relative,momentum){if(relative>=0&&momentum>=0)return 'Leading';if(relative<0&&momentum>=0)return 'Improving';if(relative>=0&&momentum<0)return 'Weakening';return 'Lagging';}
async function loadSectors(){
  if(state.sectors.length&&state.sectors.some(item=>item.quadrant))return;
  $('#sectorStamp').textContent='กำลังโหลดข้อมูล ETF…';
  try{const payload=await fetchMarket([...sectorDefs.map(item=>item[0]),'SPY'],false);const spy=findEquity(payload,'SPY');state.sectors=sectorDefs.map(([symbol,name,short])=>{const item=findEquity(payload,symbol);return item?{...item,name,short,relative:sectorRelative(item,spy),momentum:sectorMomentum(item,spy)}:{symbol,name,short,error:'ไม่มีข้อมูล'};}).map(item=>({...item,quadrant:item.relative!=null&&item.momentum!=null?sectorQuadrant(item.relative,item.momentum):'ไม่มีข้อมูล'}));renderSectors();$('#sectorStamp').textContent=`${payload.provider} · ข้อมูล ${fullTime(payload.fetchedAt)}`;}
  catch(error){$('#sectorStamp').textContent=`ไม่มีข้อมูล · ${uiError(error)}`;$('#sectorHeatmap').innerHTML='<div class="news-empty">ไม่มีข้อมูลอุตสาหกรรม · โหมดข้อมูลจริงจะไม่ใช้ตัวเลขสาธิตแทน</div>';}
}
function renderSectors(){
  const valid=state.sectors.filter(item=>Number.isFinite(item.relative)&&Number.isFinite(item.momentum));
  const xMax=Math.max(5,...valid.map(item=>Math.abs(item.relative)))*1.3,yMax=Math.max(2,...valid.map(item=>Math.abs(item.momentum)))*1.3;
  $('#quadrantDots').innerHTML=valid.map(item=>{const x=Math.max(7,Math.min(93,50+item.relative/xMax*42)),y=Math.max(10,Math.min(88,50-item.momentum/yMax*38));return `<button class="quad-dot ${item.quadrant.toLowerCase()}" style="left:${x}%;top:${y}%" data-sector="${escape(item.symbol)}" title="${escape(item.name)} · ความแข็งแกร่ง ${pct(item.relative)} · โมเมนตัม ${pct(item.momentum)}">${escape(item.short)}</button>`;}).join('');
  const tone=value=>value>0?'positive':value<0?'negative':'neutral';
  $('#sectorHeatmap').innerHTML=state.sectors.map(item=>`<button class="sector-tile" data-sector="${escape(item.symbol)}" style="background:${item.return20dPct>2?'#163c37':item.return20dPct< -2?'#3a242d':'#172536'}"><b>${escape(item.short)} <small>${escape(item.symbol)}</small></b><span class="${tone(item.return20dPct)}">${pct(item.return20dPct)} · 1 เดือน</span><small>${translateQuadrant(item.quadrant)}</small></button>`).join('');
  $('#sectorRows').innerHTML=state.sectors.map(item=>`<tr><td><button class="ticker-link" data-sector="${escape(item.symbol)}">${escape(item.symbol)}</button> · ${escape(item.name)}</td><td class="${tone(item.dailyChangePct)}">${pct(item.dailyChangePct)}</td><td class="${tone(item.return20dPct)}">${pct(item.return20dPct)}</td><td class="${tone(item.return50dPct)}">${pct(item.return50dPct)}</td><td>${item.aboveEma200==null?'—':item.aboveEma200?'เหนือ':'ต่ำกว่า'}</td><td>${translateQuadrant(item.quadrant)}</td></tr>`).join('')||'<tr><td colspan="6" class="no-data">ไม่มีข้อมูล</td></tr>';
}
function translateQuadrant(value){return ({Leading:'นำตลาดและกำลังดีขึ้น',Improving:'กำลังฟื้นตัว',Weakening:'เริ่มอ่อนแรง',Lagging:'ตามตลาดและยังอ่อนแรง',Unavailable:'ไม่มีข้อมูล'})[value]||value;}
function showSector(symbol){
  const item=state.sectors.find(sector=>sector.symbol===symbol);if(!item)return;
  $('#sectorDetail').innerHTML=`<div class="panel-top"><div><span class="eyebrow">${escape(item.symbol)} · ${escape(item.name)}</span><h2>${translateQuadrant(item.quadrant)}</h2></div><button class="text-button" data-analysis-symbol="${escape(item.symbol)}">ดูกราฟ ETF →</button></div><div class="detail-stats"><div class="detail-stat"><small>ความแข็งแกร่ง 3 เดือนเทียบ SPY</small><b class="${item.relative>=0?'positive':'negative'}">${pct(item.relative)}</b></div><div class="detail-stat"><small>การเปลี่ยนโมเมนตัมใน 20 วัน</small><b class="${item.momentum>=0?'positive':'negative'}">${pct(item.momentum)}</b></div><div class="detail-stat"><small>ราคาเทียบ EMA 200</small><b>${item.aboveEma200==null?'ไม่มีข้อมูล':item.aboveEma200?'เหนือ':'ต่ำกว่า'}</b></div><div class="detail-stat"><small>แหล่งข้อมูล Yahoo Finance · ล่าสุด</small><b>${escape(timeLabel(item.asOf))}</b></div></div><p class="panel-foot">ใช้ ETF เป็นตัวแทนของอุตสาหกรรม · ไม่มีข้อมูลหุ้นองค์ประกอบและปัจจัยผลประกอบการ</p>`;
}

async function loadScreener(){
  $('#screenCoverage').textContent=`ครอบคลุมหุ้นสหรัฐฯ ${tickers.length} บริษัท · ใช้เฉพาะข้อมูลราคา`;
  if(state.scanData.length)return renderScreener();
  $('#screenRows').innerHTML='<tr><td colspan="7" class="no-data">กำลังค้นหาหุ้นในรายชื่อที่กำหนด…</td></tr>';
  try{const payload=await fetchMarket(tickers,false);state.scanData=(payload.equities||[]).map(item=>item.error?item:{...item,distanceEmaPct:(item.last/item.ema200-1)*100});renderScreener();}
  catch(error){state.scanData=[];$('#screenRows').innerHTML=`<tr><td colspan="7" class="no-data">โหลดตัวกรองหุ้นไม่สำเร็จ: ${escape(uiError(error))}</td></tr>`;}
}
function filteredScreen(){
  let items=state.scanData.filter(item=>!item.error);
  const search=$('#screenSearch').value.trim().toUpperCase();if(search)items=items.filter(item=>item.symbol.includes(search)||item.label?.toUpperCase().includes(search));
  if($('#filterEma').checked)items=items.filter(item=>item.aboveEma200);
  const min=Number($('#filterReturn').value);if(Number.isFinite(min))items=items.filter(item=>item.return20dPct>=min);
  const maxDist=Number($('#filterDistance').value);if(Number.isFinite(maxDist))items=items.filter(item=>Math.abs(item.distanceEmaPct)<=maxDist);
  if(state.preset==='trend')items=items.filter(item=>item.aboveEma200&&item.emaSlope20dPct>0);
  if(state.preset==='pullback')items=items.filter(item=>item.aboveEma200&&Math.abs(item.distanceEmaPct)<=5&&item.emaSlope20dPct>0);
  if(state.preset==='breakout')items=items.filter(item=>item.high52w&&item.last/item.high52w>=.95&&item.aboveEma200);
  const {key,direction}=state.sort;return items.sort((a,b)=>typeof a[key]==='string'?a[key].localeCompare(b[key])*direction:((a[key]??-Infinity)-(b[key]??-Infinity))*direction);
}
function renderScreener(){
  const rows=filteredScreen();$('#screenEmpty').classList.toggle('hidden',rows.length>0);
  $('#screenRows').innerHTML=rows.map(item=>`<tr><td><button class="ticker-link" data-analysis-symbol="${escape(item.symbol)}">${escape(item.symbol)}</button></td><td>${money(item.last)}</td><td class="${item.dailyChangePct>=0?'positive':'negative'}">${pct(item.dailyChangePct)}</td><td class="${item.aboveEma200?'positive':'negative'}">${pct(item.distanceEmaPct)}</td><td class="${item.return20dPct>=0?'positive':'negative'}">${pct(item.return20dPct)}</td><td class="${item.emaSlope20dPct>=0?'positive':'negative'}">${pct(item.emaSlope20dPct)}</td><td><button class="small-action" data-add-watch="${escape(item.symbol)}">＋ ติดตาม</button></td></tr>`).join('');
}
function applyPreset(preset){
  if(preset==='quality'){toast('ตัวกรองคุณภาพธุรกิจยังใช้ไม่ได้ เพราะไม่มีแหล่งข้อมูลงบการเงิน');return;}
  state.preset=preset;$$('.preset').forEach(button=>button.classList.toggle('selected',button.dataset.preset===preset));renderScreener();
}
function exportCsv(){
  const rows=filteredScreen();if(!rows.length){toast('ไม่มีผลลัพธ์ให้ Export');return;}
  const csv=[['Ticker','Price','Daily change %','Distance to EMA200 %','20D return %','EMA200 slope %','As-of','Source'],...rows.map(item=>[item.symbol,item.last,item.dailyChangePct,item.distanceEmaPct,item.return20dPct,item.emaSlope20dPct,item.asOf,item.source])].map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
  download(new Blob([csv],{type:'text/csv;charset=utf-8'}),'stocklens-screener.csv');
}

async function loadAnalysis(force=false){
  const symbol=state.analysisSymbol.toUpperCase();if(!symbol)return;
  $('#analysisTitle').textContent=symbol;$('#analysisMeta').textContent='กำลังโหลดราคาย้อนหลัง…';$('#analysisSummary').innerHTML='<div class="analysis-stat"><small>สถานะข้อมูล</small><strong>กำลังโหลด</strong><em>Yahoo Finance</em></div>';
  try{const payload=await fetchMarket([symbol,'SPY'],false,force);const item=findEquity(payload,symbol),spy=findEquity(payload,'SPY');if(!item||item.error)throw new Error(item?.error||'ไม่มีข้อมูลหุ้นตามชื่อย่อนี้');state.analysis={item,spy,source:payload.provider,mode:payload.mode};renderAnalysis();loadTickerNews(symbol);}
  catch(error){state.analysis=null;$('#analysisMeta').textContent=`${modeName()} · ${uiError(error)}`;$('#analysisSummary').innerHTML='<div class="analysis-stat"><small>สถานะข้อมูล</small><strong class="negative">ไม่มีข้อมูล</strong><em>จะไม่ใช้ข้อมูลเก่าหรือข้อมูลสาธิตแทน</em></div>';$('#priceChart').innerHTML=`<div class="empty-state">${escape(uiError(error))} · ตรวจการตั้งค่าและที่อยู่ API</div>`;$('#technicalFacts').innerHTML='';$('#setupLabel').textContent='ไม่มีข้อมูล';}
}
function technicalIndicators(item,spy){
  const bars=item.bars||[],closes=bars.map(bar=>bar.close);return {bars,closes,ema20:ema(closes,20),ema50:ema(closes,50),ema200:ema(closes,200),rsi:rsi(closes,14),atr:atr(bars,14),structure:findStructure(bars),rs20:relativeReturn(item,spy,20),rs63:relativeReturn(item,spy,63)};
}
function scoreParts(item,tech){
  const dist=(item.last/item.ema200-1)*100;
  const trend=item.aboveEma200?(item.emaSlope20dPct>0?100:65):0;
  const strength=Number.isFinite(tech.rs63)?Math.max(0,Math.min(100,50+tech.rs63*5)):null;
  const rv=tech.rsi.at(-1);const rsiScore=Number.isFinite(rv)?(rv>=45&&rv<=65?100:rv<30?35:rv>75?25:65):null;
  const risk=Number.isFinite(dist)?Math.max(0,100-Math.max(0,dist-3)*8):null;
  const parts=[['แนวโน้ม',trend,.35],['เทียบตลาด',strength,.3],['RSI',rsiScore,.15],['ระยะจาก EMA',risk,.2]];
  const totalWeight=parts.filter(item=>item[1]!=null).reduce((sum,item)=>sum+item[2],0);
  const score=totalWeight?Math.round(parts.reduce((sum,item)=>sum+(item[1]??0)*item[2],0)/totalWeight):null;
  return {parts,score,dist};
}
function renderAnalysis(){
  if(!state.analysis)return;const {item,spy,source,mode}=state.analysis;const tech=technicalIndicators(item,spy);state.analysis.tech=tech;
  $('#analysisMeta').textContent=`${item.label} · ${item.exchange||'ตลาดสหรัฐฯ'} · ${item.currency||'USD'} · ${source} · ล่าสุด ${fullTime(item.asOf)} · ${mode==='demo'?'ราคาจำลอง':'ราคาอาจล่าช้าตามผู้ให้บริการ'}`;
  const dist=(item.last/item.ema200-1)*100;const stats=[['ราคาล่าสุด',money(item.last),item.currency||'ดอลลาร์สหรัฐ'],['เปลี่ยนแปลงรายวัน',pct(item.dailyChangePct),timeLabel(item.asOf)],['เทียบ EMA 200',pct(dist),item.aboveEma200?'ราคาอยู่เหนือแนวโน้มระยะยาว':'ราคาอยู่ต่ำกว่าแนวโน้มระยะยาว'],['เทียบตลาดใน 63 วัน',pct(tech.rs63),'ส่วนต่างผลตอบแทนเทียบ SPY']];
  $('#analysisSummary').innerHTML=stats.map(([label,value,sub],index)=>`<div class="analysis-stat"><small>${label}</small><strong class="${index===1?(item.dailyChangePct>=0?'positive':'negative'):index===2?(dist>=0?'positive':'negative'):''}">${escape(value)}</strong><em>${escape(sub)}</em></div>`).join('');
  const days=state.rangeDays;const sliced=tech.bars.slice(-days);const offset=tech.bars.length-sliced.length;
  const chartSeries=[{name:'ราคา',color:'#d3e0e9',width:2,values:sliced.map(bar=>bar.close)}];
  for(const [key,color] of [['ema20','#eab96b'],['ema50','#b4a0ff'],['ema200','#7bb8ff']])if(state.indicators[key])chartSeries.push({name:key,color,values:tech[key].slice(offset)});
  lineChart('priceChart',chartSeries,{height:300,aria:`กราฟราคาของ ${item.symbol} และเส้นค่าเฉลี่ย`});
  $$('.indicator-toggle').forEach(button=>button.classList.toggle('selected',state.indicators[button.dataset.indicator]));
  const setup=setupFor(item);$('#setupLabel').textContent=translateSetup(setup);
  const facts=[['EMA 200',money(item.ema200),`ราคาอยู่${item.aboveEma200?'เหนือ':'ต่ำกว่า'}เส้น ${pct(dist)}`],['ความชัน EMA 200 · 20 วัน',pct(item.emaSlope20dPct),'เทียบเส้นค่าเฉลี่ยวันนี้กับเมื่อ 20 วันก่อน'],['RSI · 14 วัน',money(tech.rsi.at(-1),1),'ค่าเฉลี่ยขาขึ้นและขาลง · ไม่ใช่สัญญาณจับจังหวะ'],['ATR · 14 วัน',money(tech.atr.at(-1)),`ความผันผวนเฉลี่ยราว ${pct(tech.atr.at(-1)/item.last*100)} ของราคา`],['แนวรับใกล้สุด',tech.structure.supports.length?money(tech.structure.supports[0]):'ไม่มีข้อมูล',tech.structure.method],['แนวต้านใกล้สุด',tech.structure.resistances.length?money(tech.structure.resistances[0]):'ไม่มีข้อมูล',tech.structure.method]];
  $('#technicalFacts').innerHTML=facts.map(([label,value,detail])=>`<div class="fact-row"><span>${escape(label)}<small>${escape(detail)}</small></span><b>${escape(value)}</b></div>`).join('');
  const score=scoreParts(item,tech);$('#setupScore').textContent=score.score==null?'— / 100':`${score.score} / 100`;
  $('#scoreBreakdown').innerHTML=score.parts.map(([label,value,weight])=>`<div class="score-item"><span>${label} · ${Math.round(weight*100)}%</span><span class="score-track"><i style="width:${value==null?0:value}%"></i></span><b>${value==null?'—':Math.round(value)}</b></div>`).join('');
  renderValuation();
}
async function loadTickerNews(symbol){
  $('#tickerNewsLabel').textContent=symbol;$('#tickerNews').innerHTML='<div class="news-empty">กำลังโหลดข่าว…</div>';
  try{const data=await fetchNews({symbol});$('#tickerNews').innerHTML=data.items?.length?data.items.slice(0,5).map(item=>`<a class="news-item" href="${escape(safeLink(item.link))}" target="_blank" rel="noopener noreferrer"><span>${escape(item.title)}</span><small>${escape(item.source)} · ${escape(fullTime(item.publishedAt))}</small></a>`).join(''):`<div class="news-empty">${escape(data.message||'ไม่มีข่าวล่าสุดในฟีด')}</div>`;}
  catch(error){$('#tickerNews').innerHTML=`<div class="news-empty">โหลดข่าวไม่สำเร็จ: ${escape(uiError(error))}</div>`;}
}
function renderValuation(){const values=read('valuation',{})[state.analysisSymbol]||{};$('#valPe').value=values.pe??'';$('#valPs').value=values.ps??'';$('#valEvEbitda').value=values.evEbitda??'';$('#valFcfYield').value=values.fcfYield??'';$('#valuationReadout').textContent=valuationNotes(values);}
function saveValuation(){const all=read('valuation',{});all[state.analysisSymbol]={pe:parseNullable($('#valPe').value),ps:parseNullable($('#valPs').value),evEbitda:parseNullable($('#valEvEbitda').value),fcfYield:parseNullable($('#valFcfYield').value)};write('valuation',all);$('#valuationReadout').textContent=valuationNotes(all[state.analysisSymbol]);toast('บันทึกตัวเลขที่คุณกรอกแล้ว');}
function parseNullable(value){if(value===''||value==null)return null;const n=Number(value);return Number.isFinite(n)?n:null;}

function updateRisk(){
  const result=riskReward({entry:parseNullable($('#riskEntry').value),stop:parseNullable($('#riskStop').value),target:parseNullable($('#riskTarget').value),portfolio:parseNullable($('#portfolioValue').value),riskPct:parseNullable($('#riskBudget').value),maxPosition:parseNullable($('#maxPosition').value)??0});
  const host=$('#riskResults');if(result.error){host.classList.add('error');host.innerHTML=`<span>${escape(result.error)}</span>`;return;}
  host.classList.remove('error');host.innerHTML=`<span>ความเสี่ยงต่อหุ้น <b>${money(result.riskPerShare)}</b> · ${pct(result.riskPct)}</span><span>ผลตอบแทนต่อหุ้น <b>${money(result.rewardPerShare)}</b> · ${pct(result.rewardPct)}</span><span>อัตราผลตอบแทนต่อความเสี่ยง <b>${result.ratio.toFixed(2)} : 1</b></span><span>ขนาดสถานะ <b>${result.shares} หุ้น</b> · ${money(result.positionValue)}</span><span>ขาดทุนสูงสุด <b>${money(result.maxLoss)}</b> · งบ ${money(result.budget)}</span>`;
}

const financialFields=[['revenue','รายได้'],['grossProfit','กำไรขั้นต้น'],['operatingIncome','กำไรจากการดำเนินงาน'],['netIncome','กำไรสุทธิ'],['eps','กำไรต่อหุ้น (EPS)'],['operatingCashFlow','เงินสดจากการดำเนินงาน'],['capex','รายจ่ายลงทุน'],['freeCashFlow','กระแสเงินสดอิสระ'],['cash','เงินสดและเงินลงทุนระยะสั้น'],['totalDebt','หนี้สินรวม']];
function currentFinancialInput(){return Object.fromEntries(financialFields.map(([key])=>[key,{previous:parseNullable($(`#fin-${key}-prev`)?.value),current:parseNullable($(`#fin-${key}-current`)?.value)}]));}
function renderFinancialInputs(){
  const saved=read('financials',{});$('#periodPrevious').value=saved.periodPrevious||'';$('#periodCurrent').value=saved.periodCurrent||'';$('#financialUnit').value=saved.unit||'ล้านดอลลาร์สหรัฐ';$('#periodType').value=saved.periodType||'QoQ';
  $('#financialInputs').innerHTML=financialFields.map(([key,label])=>`<div class="financial-field"><label for="fin-${key}-prev">${label} · งวดก่อน</label><input id="fin-${key}-prev" type="number" step="any" value="${escape(saved.values?.[key]?.previous??'')}"></div><div class="financial-field"><label for="fin-${key}-current">${label} · งวดล่าสุด</label><input id="fin-${key}-current" type="number" step="any" value="${escape(saved.values?.[key]?.current??'')}"></div>`).join('');
  if(state.financialSummary)renderEarnings();
}
function saveFinancials(){
  const model={periodPrevious:$('#periodPrevious').value.trim(),periodCurrent:$('#periodCurrent').value.trim(),unit:$('#financialUnit').value.trim(),periodType:$('#periodType').value,values:currentFinancialInput()};
  write('financials',model);state.financialSummary=decodeFinancials(model.values,model.periodType);renderEarnings();toast('บันทึกตัวเลขที่กรอกไว้ในเบราว์เซอร์นี้');
}
function renderEarnings(){
  const saved=read('financials',{});const summary=state.financialSummary||decodeFinancials(saved.values||{},saved.periodType||'QoQ');state.financialSummary=summary;
  const groups=[['ผลประกอบการ',summary.headline],['คุณภาพการเติบโต',summary.quality],['ฐานะการเงิน',summary.balance],['สิ่งที่ต้องจับตา',summary.watch]];
  $('#earningsSummary').innerHTML=groups.map(([heading,text])=>`<article class="earnings-card"><small>${heading}</small><b>${escape(saved.periodPrevious||'งวดก่อน')} → ${escape(saved.periodCurrent||'งวดล่าสุด')}</b><p>${escape(text)}</p></article>`).join('');
  const valid=Object.entries(summary.comparisons).filter(([,item])=>Number.isFinite(item.previous)&&Number.isFinite(item.current)).slice(0,4);
  lineChart('financialChart',valid.filter(([,item])=>Number.isFinite(item.changePct)).map(([key,item],i)=>({name:key,color:['#44d7b5','#7bb8ff','#b4a0ff','#eab96b'][i],values:[0,item.changePct]})),{height:200,percent:true,aria:'กราฟเปอร์เซ็นต์การเปลี่ยนแปลงของตัวเลขงบที่ผู้ใช้กรอก'});
}

function renderWatchlist(){
  const items=getWatchlist();$('#watchCount').textContent=items.length;
  const groups=[...new Set(items.map(item=>item.group||'ไม่จัดกลุ่ม'))];const sel=$('#watchGroupFilter');const previous=sel.value;sel.innerHTML='<option value="all">ทุกกลุ่ม</option>'+groups.map(group=>`<option value="${escape(group)}">${escape(group)}</option>`).join('');if(groups.includes(previous))sel.value=previous;
  const group=sel.value,status=$('#watchStatusFilter').value,sort=$('#watchSort').value;
  const metrics=state.watchData||[];let rows=items.map(saved=>({...saved,data:metrics.find(item=>item.symbol===saved.symbol)}));
  if(group!=='all')rows=rows.filter(item=>(item.group||'ไม่จัดกลุ่ม')===group);
  if(status!=='all')rows=rows.filter(item=>status==='Unavailable'?!item.data||item.data.error:status==='Above EMA'?item.data?.aboveEma200:item.data?.aboveEma200===false);
  rows.sort((a,b)=>sort==='symbol'?a.symbol.localeCompare(b.symbol):((b.data?.[sort]??-Infinity)-(a.data?.[sort]??-Infinity)));
  $('#watchEmpty').classList.toggle('hidden',items.length>0);
  $('#watchRows').innerHTML=rows.map(({symbol,group,data})=>`<tr><td><button class="ticker-link" data-analysis-symbol="${escape(symbol)}">${escape(symbol)}</button></td><td><button class="small-action" data-group-symbol="${escape(symbol)}">${escape(group||'ไม่จัดกลุ่ม')} · แก้กลุ่ม</button></td><td class="${data?.dailyChangePct>=0?'positive':'negative'}">${data?.error||!data?'—':pct(data.dailyChangePct)}</td><td>${data?.error||!data?'ไม่มีข้อมูล':`${data.aboveEma200?'เหนือ':'ต่ำกว่า'} · ${pct((data.last/data.ema200-1)*100)}`}</td><td><span class="status-pill unavailable">ยังไม่มีข้อมูล</span></td><td><span class="muted">ยังไม่มีข้อมูล</span></td><td><button class="small-action" data-remove-watch="${escape(symbol)}">นำออก</button></td></tr>`).join('');
  $('#watchEmpty').classList.toggle('hidden',rows.length>0);
}
async function loadWatchlist(force=false){
  renderWatchlist();const symbols=currentWatchSymbols();if(!symbols.length){state.watchData=[];renderWatchlist();return;}
  try{const payload=await fetchMarket(symbols,false,force);state.watchData=payload.equities||[];renderWatchlist();}
  catch(error){state.watchData=symbols.map(symbol=>({symbol,error:error.message}));renderWatchlist();}
}
function paperLedger(){const value=read('paper',{startingCash:100000,trades:[]});return {startingCash:Number.isFinite(value.startingCash)&&value.startingCash>=0?value.startingCash:100000,trades:Array.isArray(value.trades)?value.trades:[]};}
async function loadPaper(force=false){
  const ledger=paperLedger();$('#paperStartingCash').value=ledger.startingCash;$('#paperStartingCash').disabled=ledger.trades.length>0;
  const symbols=[...new Set(ledger.trades.map(item=>item.symbol))];
  if(!symbols.length){state.paperQuotes=[];renderPaper();return;}
  try{const payload=await fetchMarket(symbols,false,force);state.paperQuotes=payload.equities||[];$('#paperAsOf').textContent=`${payload.provider} · ${fullTime(payload.fetchedAt)}`;}
  catch(error){state.paperQuotes=symbols.map(symbol=>({symbol,error:error.message}));$('#paperAsOf').textContent=`ราคาไม่พร้อม · ${error.message}`;}
  renderPaper();
}
function renderPaper(){
  const ledger=paperLedger(),portfolio=calculatePaperPortfolio(ledger.startingCash,ledger.trades,state.paperQuotes);const marketValue=portfolio.marketValue??0;const accountValue=portfolio.accountValue??portfolio.cash;
  const netPnl=portfolio.accountValue==null?null:portfolio.accountValue-ledger.startingCash;
  const metrics=[['เงินสดจำลอง',money(portfolio.cash),'เหลือใช้ในพอร์ต'],['มูลค่าหุ้น',portfolio.marketValue==null?'รอราคา':money(portfolio.marketValue),'อิงราคาล่าสุดที่โหลดได้'],['มูลค่าพอร์ตรวม',portfolio.accountValue==null?'รอราคา':money(portfolio.accountValue),'เงินสด + มูลค่าหุ้น'],['กำไร/ขาดทุนรวม',netPnl==null?'รอราคา':money(netPnl),`${ledger.trades.length} รายการจำลอง`]];
  $('#paperMetrics').innerHTML=metrics.map(([label,value,detail],i)=>`<article class="metric-card"><div class="metric-card-head"><span>${label}</span></div><strong class="${i===3&&netPnl!=null?(netPnl>=0?'positive':'negative'):''}">${escape(value)}</strong><small>${escape(detail)}</small></article>`).join('');
  $('#paperPortfolioRows').innerHTML=portfolio.positions.map(item=>`<tr><td><button class="ticker-link" data-analysis-symbol="${escape(item.symbol)}">${escape(item.symbol)}</button></td><td>${item.quantity.toLocaleString('th-TH',{maximumFractionDigits:4})}</td><td>${money(item.averageCost)}</td><td>${item.last==null?'ไม่มีข้อมูล':money(item.last)}</td><td>${item.marketValue==null?'—':money(item.marketValue)}</td><td class="${item.unrealizedPnl==null?'':item.unrealizedPnl>=0?'positive':'negative'}">${item.unrealizedPnl==null?'—':money(item.unrealizedPnl)}</td></tr>`).join('');
  $('#paperPortfolioEmpty').classList.toggle('hidden',portfolio.positions.length>0);
  $('#paperTrades').innerHTML=ledger.trades.length?ledger.trades.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(item=>`<div class="paper-trade-row"><span><b>${item.side==='buy'?'ซื้อ':'ขาย'} ${escape(item.symbol)}</b><small>${escape(item.createdAt?.slice(0,16).replace('T',' ')||'')}</small></span><span>${item.quantity.toLocaleString('th-TH',{maximumFractionDigits:4})} หุ้น × ${money(item.price)} · ค่าธรรมเนียม ${money(item.fee)}</span><button class="small-action" data-delete-paper="${escape(item.id)}">ลบรายการ</button></div>`).join(''):'<div class="news-empty">ยังไม่มีรายการจำลอง</div>';
  $('#paperNotice').textContent=ledger.trades.length?'เริ่มบันทึกรายการแล้ว จึงล็อกเงินตั้งต้นไว้เพื่อรักษาความถูกต้องของผลจำลอง':'คุณเปลี่ยนเงินตั้งต้นได้ก่อนบันทึกรายการแรก';
  if(portfolio.errors.length)$('#paperNotice').textContent=`มีรายการผิดพลาด: ${portfolio.errors.join(' · ')}`;
}
function savePaperCapital(){const ledger=paperLedger();if(ledger.trades.length){toast('เริ่มบันทึกรายการแล้ว จึงเปลี่ยนเงินตั้งต้นไม่ได้');return;}const amount=Number($('#paperStartingCash').value);if(!Number.isFinite(amount)||amount<0){toast('กรอกเงินตั้งต้นเป็นศูนย์หรือมากกว่า');return;}write('paper',{startingCash:amount,trades:[]});renderPaper();toast('บันทึกเงินตั้งต้นจำลองแล้ว');}
function savePaperTrade(event){event.preventDefault();const ledger=paperLedger();const trade={id:crypto.randomUUID(),symbol:$('#paperTicker').value.trim().toUpperCase(),side:$('#paperSide').value,quantity:Number($('#paperShares').value),price:Number($('#paperPrice').value),fee:Number($('#paperFee').value||0),createdAt:new Date().toISOString()};const issue=validatePaperTrade(ledger,trade);if(issue){toast(issue);return;}ledger.trades.push(trade);write('paper',ledger);$('#paperTradeForm').reset();$('#paperFee').value='0';loadPaper(true);toast('บันทึกรายการจำลองแล้ว');}
function deletePaperTrade(id){const ledger=paperLedger();ledger.trades=ledger.trades.filter(item=>item.id!==id);if(!ledger.trades.length){ledger.startingCash=Number($('#paperStartingCash').value)||ledger.startingCash;}write('paper',ledger);loadPaper(true);}
function addWatch(symbol){symbol=String(symbol||'').trim().toUpperCase();if(!/^[A-Z0-9.^_-]{1,15}$/.test(symbol)){toast('กรอกชื่อย่อหุ้นให้ถูกต้อง');return;}const items=getWatchlist();if(items.some(item=>item.symbol===symbol)){toast(`${symbol} อยู่ในรายการติดตามแล้ว`);return;}items.push({symbol,group:'ไม่จัดกลุ่ม',addedAt:new Date().toISOString()});setWatchlist(items);renderWatchlist();if(state.page==='analysis')loadAnalysis();toast(`เพิ่ม ${symbol} ในรายการติดตามแล้ว`);}
function removeWatch(symbol){setWatchlist(getWatchlist().filter(item=>item.symbol!==symbol));state.watchData=state.watchData.filter(item=>item.symbol!==symbol);renderWatchlist();renderOverviewWatch();toast(`นำ ${symbol} ออกจากรายการติดตามแล้ว`);}
function editWatchGroup(symbol){const items=getWatchlist();const item=items.find(row=>row.symbol===symbol);if(!item)return;const group=prompt('ตั้งชื่อกลุ่มสำหรับ '+symbol,item.group||'ไม่จัดกลุ่ม');if(group===null)return;item.group=group.trim().slice(0,30)||'ไม่จัดกลุ่ม';setWatchlist(items);renderWatchlist();}
async function loadFlowWatch(){return loadWatchlist(true);}

function renderJournal(){
  const rows=read('journal',[]);$('#journalEntries').innerHTML=rows.length?rows.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(item=>`<article class="journal-card"><div class="journal-head"><b>${escape(item.ticker)}</b><time>${escape(item.date)}</time></div><h3>${escape(item.thesis)}</h3><p><b>แผนเข้า:</b> ${escape(item.entry||'—')}</p><p><b>เงื่อนไขที่ทำให้แผนผิด:</b> ${escape(item.invalidation||'—')}</p><p><b>ปัจจัยที่รอติดตาม:</b> ${escape(item.catalyst||'—')}</p><p><b>บันทึกเพิ่มเติม:</b> ${escape(item.notes||'—')}</p><p><b>ผลลัพธ์ / บทเรียน:</b> ${escape(item.result||'—')}</p><div class="journal-actions"><button class="small-action" data-edit-journal="${escape(item.id)}">แก้ไข</button><button class="small-action" data-delete-journal="${escape(item.id)}">ลบ</button></div></article>`).join(''):'<article class="panel empty-state">ยังไม่มีบันทึก · จดเหตุผลก่อนตัดสินใจ แล้วกลับมาเขียนบทเรียนหลังติดตามผล</article>';
}
function openJournal(entry={}){$('#journalId').value=entry.id||'';$('#journalTicker').value=entry.ticker||state.analysisSymbol;$('#journalDate').value=entry.date||new Date().toISOString().slice(0,10);$('#journalThesis').value=entry.thesis||'';$('#journalEntry').value=entry.entry||'';$('#journalInvalidation').value=entry.invalidation||'';$('#journalCatalyst').value=entry.catalyst||'';$('#journalResult').value=entry.result||'';$('#journalNotes').value=entry.notes||'';$('#journalDialog').showModal();}
function saveJournal(event){event.preventDefault();const rows=read('journal',[]);const entry={id:$('#journalId').value||crypto.randomUUID(),ticker:$('#journalTicker').value.trim().toUpperCase(),date:$('#journalDate').value,thesis:$('#journalThesis').value.trim(),entry:$('#journalEntry').value.trim(),invalidation:$('#journalInvalidation').value.trim(),catalyst:$('#journalCatalyst').value.trim(),result:$('#journalResult').value.trim(),notes:$('#journalNotes').value.trim(),updatedAt:new Date().toISOString()};const existing=rows.findIndex(item=>item.id===entry.id);if(existing>=0)rows[existing]=entry;else rows.push(entry);write('journal',rows);$('#journalDialog').close();renderJournal();toast('บันทึกแผนเรียบร้อย');}

function renderAlerts(){const alerts=read('alerts',[]);$('#alertList').innerHTML=alerts.length?alerts.map(item=>`<div class="alert-item"><span><b>${escape(item.symbol)}</b> · ${escape(item.label)} · ${escape(item.status||'ตั้งรอไว้')}</span><button data-delete-alert="${escape(item.id)}">นำออก</button></div>`).join(''):'<div class="news-empty">ยังไม่มีการแจ้งเตือน</div>';}
function addAlert(event){event.preventDefault();const symbol=$('#alertTicker').value.trim().toUpperCase();const condition=$('#alertCondition').value;const labels={'cross-above':'ราคาตัดขึ้นเหนือ EMA 200','cross-below':'ราคาตัดลงต่ำกว่า EMA 200','near-ema':'ราคาเข้าใกล้ EMA 200 ภายใน 2%'};const rows=read('alerts',[]);rows.push({id:crypto.randomUUID(),symbol,condition,label:labels[condition],createdAt:new Date().toISOString(),status:'ตั้งรอตรวจ'});write('alerts',rows);$('#alertForm').reset();renderAlerts();toast('เพิ่มเงื่อนไขแล้ว · จะตรวจเมื่ออัปเดตราคา');}
function evaluateAlerts(items){
  const alerts=read('alerts',[]);let changed=false;const bySymbol=Object.fromEntries(items.map(item=>[item.symbol,item]));
  for(const alert of alerts){const item=bySymbol[alert.symbol];if(!item?.bars?.length)continue;const closes=item.bars.map(bar=>bar.close);const line=ema(closes,200);const last=closes.at(-1),prev=closes.at(-2),emaNow=line.at(-1),emaPrev=line.at(-2);let hit=false;
    if(alert.condition==='cross-above')hit=prev<=emaPrev&&last>emaNow;
    else if(alert.condition==='cross-below')hit=prev>=emaPrev&&last<emaNow;
    else if(alert.condition==='near-ema')hit=Math.abs(last/emaNow-1)<=.02;
    if(hit&&alert.lastTriggeredAsOf!==item.asOf){alert.status=`เข้าเงื่อนไข · ${timeLabel(item.asOf)}`;alert.lastTriggeredAsOf=item.asOf;notify(`${alert.symbol}: ${alert.label}`);changed=true;}
  }
  if(changed)write('alerts',alerts);renderAlerts();
}

function renderSourceList(){
  const live=dataMode()==='live';const base=settings().apiBase||'API ในเว็บเดียวกัน';
  $('#sourceList').innerHTML=[['ราคาหุ้นและดัชนี','Yahoo Finance','เรียกผ่าน /api/market',live?'off':'off'],['ข่าวตลาด','Google News RSS','เรียกผ่าน /api/news',live?'off':'off'],['งบการเงินบริษัท','ยังไม่เชื่อมต่อ','ใช้ตัวเลขที่ผู้ใช้กรอกเอง','off'],['เงินไหลเข้ากองทุนจริง','ยังไม่เชื่อมต่อ','ไม่มีแหล่งข้อมูล','off'],['สรุปด้วย AI','ฟังก์ชันเสริมบนเซิร์ฟเวอร์','ต้องตั้ง GEMINI_API_KEY บน Vercel','off']].map(([name,provider,detail])=>`<div class="source-row"><span><b>${escape(name)}</b><small>${escape(provider)} · ${escape(detail)}</small></span><span class="source-state ${live?'off':''}">${live?'ยังไม่ได้ตรวจ':'ยังไม่ได้ตั้งค่า'}</span></div>`).join('');
  $('#settingsNotice').textContent=live?`คำขอข้อมูลจริงใช้ ${base} · กดตรวจสอบแหล่งข้อมูลด้านล่าง`:'โหมดสาธิตทำงานบน GitHub Pages ได้โดยไม่ต้องใช้ API';
}
async function checkSources(){
  const host=$('#sourceList');host.innerHTML='<div class="news-empty">กำลังตรวจสอบแหล่งข้อมูล…</div>';
  if(dataMode()!=='live'){renderSourceList();toast('โหมดสาธิตพร้อมใช้งาน · ยังไม่ได้เรียกข้อมูลจริง');return;}
  const results=[];for(const [label,request] of [['API ราคาหุ้น',()=>fetchMarket([],true,true)],['API ข่าว',()=>fetchNews({market:true})]]){try{await request();results.push([label,true,'เชื่อมต่อสำเร็จ']);}catch(error){results.push([label,false,error.message]);}}
  const extra=[['งบการเงินบริษัท','ยังไม่มี API สำหรับข้อมูลนี้'],['เงินไหลเข้ากองทุนจริง','ยังไม่มี API สำหรับข้อมูลนี้'],['สรุปด้วย AI','ฟังก์ชันเสริม · ต้องตั้ง GEMINI_API_KEY']];
  host.innerHTML=results.map(([label,ok,message])=>`<div class="source-row"><span><b>${escape(label)}</b><small>${escape(message)}</small></span><span class="source-state ${ok?'ok':''}">${ok?'พร้อมใช้งาน':'เชื่อมต่อไม่ได้'}</span></div>`).concat(extra.map(([label,message])=>`<div class="source-row"><span><b>${escape(label)}</b><small>${escape(message)}</small></span><span class="source-state off">ยังไม่เชื่อมต่อ</span></div>`)).join('');
}
function saveSettingsClick(){const mode=$('input[name="dataMode"]:checked')?.value||'demo';const apiBase=$('#apiBase').value.trim().replace(/\/$/,'');if(apiBase&&!/^https?:\/\//i.test(apiBase)&&!apiBase.startsWith('/')){toast('ที่อยู่ API ต้องขึ้นต้นด้วย https:// หรือ /');return;}setSettings({mode,apiBase});state.market=null;state.watchData=[];state.sectors=[];state.scanData=[];state.flow=[];state.analysis=null;updateModeUI();renderSourceList();toast('บันทึกการตั้งค่าแล้ว');loadOverview(true);}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportWorkspace(){download(new Blob([JSON.stringify(snapshotWorkspace(),null,2)],{type:'application/json'}),'stocklens-radar-workspace.json');}
async function importWorkspaceFile(file){try{const data=JSON.parse(await file.text());importWorkspace(data);updateModeUI();renderWatchlist();renderJournal();renderAlerts();renderSourceList();loadPaper();toast('นำเข้าข้อมูลสำรองแล้ว');}catch(error){toast(`นำเข้าไม่สำเร็จ: ${error.message}`);}}
function clearWorkspaceData(){if(!confirm('ลบรายการหุ้น บันทึก แผนจำลอง การแจ้งเตือน และการตั้งค่าที่บันทึกในเบราว์เซอร์นี้ทั้งหมดหรือไม่?'))return;clearWorkspace();state.mode='demo';state.analysis=null;state.watchData=[];state.scanData=[];updateModeUI();renderWatchlist();renderJournal();renderAlerts();loadPaper();loadOverview(true);toast('ล้างข้อมูลในเบราว์เซอร์แล้ว');}

function bindEvents(){
  document.addEventListener('click',event=>{
    const page=event.target.closest('[data-page]');if(page){goPage(page.dataset.page);return;}
    const analysis=event.target.closest('[data-analysis-symbol]');if(analysis){window.open(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(analysis.dataset.analysisSymbol)}`,'_blank','noopener');return;}
    const sector=event.target.closest('[data-sector]');if(sector){showSector(sector.dataset.sector);return;}
    const flow=event.target.closest('[data-flow-symbol]');if(flow){state.analysisSymbol=flow.dataset.flowSymbol;$('#globalTicker').value=state.analysisSymbol;goPage('analysis');return;}
    const add=event.target.closest('[data-add-watch]');if(add){addWatch(add.dataset.addWatch);return;}
    const remove=event.target.closest('[data-remove-watch]');if(remove){removeWatch(remove.dataset.removeWatch);return;}
    const group=event.target.closest('[data-group-symbol]');if(group){editWatchGroup(group.dataset.groupSymbol);return;}
    const edit=event.target.closest('[data-edit-journal]');if(edit){const row=read('journal',[]).find(item=>item.id===edit.dataset.editJournal);if(row)openJournal(row);return;}
    const del=event.target.closest('[data-delete-journal]');if(del){write('journal',read('journal',[]).filter(item=>item.id!==del.dataset.deleteJournal));renderJournal();return;}
    const alert=event.target.closest('[data-delete-alert]');if(alert){write('alerts',read('alerts',[]).filter(item=>item.id!==alert.dataset.deleteAlert));renderAlerts();return;}
    const paperDelete=event.target.closest('[data-delete-paper]');if(paperDelete){deletePaperTrade(paperDelete.dataset.deletePaper);return;}
    const timeframe=event.target.closest('#flowTimeframes [data-range]');if(timeframe){state.flowRange=timeframe.dataset.range;renderFlow(state.flowSpy);return;}
    const days=event.target.closest('#chartRanges [data-days]');if(days){state.rangeDays=Number(days.dataset.days);$('#chartRanges').querySelectorAll('button').forEach(button=>button.classList.toggle('selected',button===days));renderAnalysis();return;}
    const indicator=event.target.closest('.indicator-toggle');if(indicator){state.indicators[indicator.dataset.indicator]=!state.indicators[indicator.dataset.indicator];renderAnalysis();return;}
    const preset=event.target.closest('[data-preset]');if(preset){applyPreset(preset.dataset.preset);return;}
    const sort=event.target.closest('[data-sort]');if(sort){const key=sort.dataset.sort;state.sort=state.sort.key===key?{key,direction:-state.sort.direction}:{key,direction:-1};renderScreener();return;}
  });
  $('#mobileNavBtn').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#mobileNavBtn').setAttribute('aria-expanded',String(open));});
  $('#modeChip').addEventListener('click',()=>goPage('settings'));
  $('#globalTicker').addEventListener('keydown',event=>{if(event.key==='Enter'){const symbol=$('#globalTicker').value.trim().toUpperCase();if(symbol)window.open(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`,'_blank','noopener');}});
  $('#topAddWatch').addEventListener('click',()=>addWatch($('#globalTicker').value));
  $('#refreshAll').addEventListener('click',()=>loadOverview(true));
  $('#refreshAnalysis').addEventListener('click',()=>loadAnalysis(true));$('#analysisAddWatch').addEventListener('click',()=>addWatch(state.analysisSymbol));
  $('#refreshTickerNews').addEventListener('click',()=>loadTickerNews(state.analysisSymbol));
  ['riskEntry','riskStop','riskTarget','portfolioValue','riskBudget','maxPosition'].forEach(id=>$(`#${id}`).addEventListener('input',updateRisk));
  $('#saveValuation').addEventListener('click',saveValuation);
  $('#decodeEarnings').addEventListener('click',saveFinancials);
  $('#clearFinancials').addEventListener('click',()=>{write('financials',{});state.financialSummary=null;renderFinancialInputs();renderEarnings();});
  $('#screenSearch').addEventListener('input',renderScreener);$('#filterEma').addEventListener('change',renderScreener);$('#filterReturn').addEventListener('input',renderScreener);$('#filterDistance').addEventListener('input',renderScreener);$('#applyFilters').addEventListener('click',renderScreener);
  $('#savePreset').addEventListener('click',()=>{write('screener',{above:$('#filterEma').checked,minReturn:$('#filterReturn').value,maxDistance:$('#filterDistance').value,preset:state.preset});toast('บันทึกตัวกรองไว้ในเบราว์เซอร์นี้แล้ว');});
  $('#exportScreen').addEventListener('click',exportCsv);
  $('#watchAddBtn').addEventListener('click',()=>{addWatch($('#watchAddInput').value);$('#watchAddInput').value='';});$('#watchAddInput').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('#watchAddBtn').click();}});
  $('#watchGroupFilter').addEventListener('change',renderWatchlist);$('#watchStatusFilter').addEventListener('change',renderWatchlist);$('#watchSort').addEventListener('change',renderWatchlist);$('#refreshWatchlist').addEventListener('click',()=>loadWatchlist(true));
  $('#newJournal').addEventListener('click',()=>openJournal());$('#journalForm').addEventListener('submit',saveJournal);$('#closeJournal').addEventListener('click',()=>$('#journalDialog').close());$('#cancelJournal').addEventListener('click',()=>$('#journalDialog').close());$('#journalDialog').addEventListener('click',event=>{if(event.target===$('#journalDialog'))$('#journalDialog').close();});$('#alertForm').addEventListener('submit',addAlert);
  $('#paperSaveCash').addEventListener('click',savePaperCapital);$('#paperTradeForm').addEventListener('submit',savePaperTrade);
  $('#saveSettings').addEventListener('click',saveSettingsClick);$('#checkSources').addEventListener('click',checkSources);$('#exportWorkspace').addEventListener('click',exportWorkspace);$('#clearWorkspace').addEventListener('click',clearWorkspaceData);$('#importWorkspace').addEventListener('change',event=>{if(event.target.files[0])importWorkspaceFile(event.target.files[0]);});
  const saved=read('screener',{});if(saved.above!==undefined){$('#filterEma').checked=saved.above;$('#filterReturn').value=saved.minReturn??-100;$('#filterDistance').value=saved.maxDistance??'';state.preset=saved.preset||'trend';}
}

function renderAlertsAndJournal(){renderAlerts();renderJournal();renderWatchlist();}
function init(){
  state.mode=dataMode();updateModeUI();bindEvents();renderAlertsAndJournal();renderFinancialInputs();renderValuation();
  state.financialSummary=decodeFinancials(read('financials',{}).values||{},read('financials',{}).periodType||'QoQ');renderEarnings();renderSourceList();
  const hash=location.hash.slice(1);goPage(document.querySelector(`#page-${hash}`)?hash:'overview');
  loadOverview();
  if($('#screenRows')&&state.page==='screener')loadScreener();
}
init();

