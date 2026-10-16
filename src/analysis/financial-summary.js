const pct = (previous,current) => Number.isFinite(previous)&&previous!==0&&Number.isFinite(current)?(current-previous)/Math.abs(previous)*100:null;
export function financialComparisons(values={}) {
  return Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{previous:value.previous,current:value.current,changePct:pct(value.previous,value.current),change:Number.isFinite(value.current)&&Number.isFinite(value.previous)?value.current-value.previous:null}]));
}
export function decodeFinancials(values={},period='QoQ') {
  const compared=financialComparisons(values);
  const available=Object.entries(compared).filter(([,item])=>Number.isFinite(item.previous)&&Number.isFinite(item.current));
  if(!available.length)return {empty:true,headline:'ยังไม่มีตัวเลขเปรียบเทียบ',quality:'กรอกงวดและค่าอย่างน้อยหนึ่งรายการจาก filing เพื่อสร้างคำอธิบาย',balance:'ยังประเมินฐานะเงินสดและหนี้ไม่ได้',watch:'ตรวจ period, currency และหน่วยให้ตรงกันก่อนเปรียบเทียบ',comparisons:compared};
  const direction=(key,label)=>{
    const item=compared[key];if(!Number.isFinite(item?.change))return null;
    if(item.change===0)return `${label}ทรงตัวในช่วงที่กรอก`;
    const better=key==='netIncome'||key==='eps'||key==='grossProfit'||key==='operatingIncome'||key==='operatingCashFlow'||key==='freeCashFlow'?item.change>0:item.change>0;
    return `${label}${better?'เพิ่มขึ้น':'ลดลง'} ${item.changePct==null?`(${item.change.toLocaleString('th-TH')})`:`${Math.abs(item.changePct).toFixed(1)}%`} ตามข้อมูลที่กรอก`;
  };
  const statements=['revenue','grossProfit','operatingIncome','netIncome','eps','operatingCashFlow','freeCashFlow'].map(key=>direction(key,({revenue:'รายได้',grossProfit:'กำไรขั้นต้น',operatingIncome:'กำไรจากดำเนินงาน',netIncome:'กำไรสุทธิ',eps:'EPS',operatingCashFlow:'กระแสเงินสดจากการดำเนินงาน',freeCashFlow:'Free Cash Flow'})[key])).filter(Boolean);
  const revenue=compared.revenue, profit=compared.netIncome, cash=compared.operatingCashFlow, fcf=compared.freeCashFlow;
  let quality='ข้อมูลที่กรอกยังไม่พอเชื่อมการเติบโตกับกำไรและเงินสด';
  if(revenue?.change!=null&&profit?.change!=null&&cash?.change!=null){
    if(revenue.change>0&&profit.change>0&&cash.change>0)quality=`รายได้ กำไรสุทธิ และเงินสดจากดำเนินงานเพิ่มขึ้นพร้อมกันใน ${period} ที่กรอก แต่ยังต้องตรวจรายการครั้งเดียวและคุณภาพลูกหนี้`;
    else if(revenue.change>0&&(profit.change<0||cash.change<0))quality='รายได้เพิ่มขึ้น แต่กำไรหรือเงินสดดำเนินงานลดลง ควรตรวจ margin, working capital และรายการครั้งเดียว';
    else quality='ตัวชี้วัดการเติบโตที่กรอกเคลื่อนไหวไม่ไปในทิศเดียวกัน ควรอ่านหมายเหตุประกอบงบ';
  }
  const cashBalance=values.cash?.current,debt=values.totalDebt?.current;
  const balance=Number.isFinite(cashBalance)&&Number.isFinite(debt)?`เงินสด ${cashBalance.toLocaleString('th-TH')} เทียบหนี้รวม ${debt.toLocaleString('th-TH')} (${cashBalance-debt>=0?'เงินสดสุทธิตามตัวเลขที่กรอก':'หนี้สูงกว่าเงินสดตามตัวเลขที่กรอก'})`: 'ยังไม่มีตัวเลขเงินสดและหนี้ครบเพื่อประเมินฐานะ';
  const watch=Number.isFinite(fcf?.change)&&fcf.change<0?'ติดตาม Free Cash Flow และการใช้เงินลงทุนในงวดถัดไป':!Number.isFinite(cash?.change)?'เพิ่ม operating cash flow และ capex จากงบจริงเพื่ออ่าน cash conversion':'เทียบ guidance, margin และ cash flow ในงวดถัดไป';
  return {empty:false,headline:statements.slice(0,4).join(' · ')||'ค่าที่กรอกยังคำนวณการเปลี่ยนแปลงไม่ได้',quality,balance,watch,comparisons:compared};
}

export function valuationNotes(values={}) {
  const notes=[];
  if(Number.isFinite(values.pe)&&values.pe<=0)notes.push('P/E ติดลบหรือเป็นศูนย์จึงไม่มีความหมายในฐานะ multiple กำไร');
  if(Number.isFinite(values.pe)&&values.pe>0)notes.push(`P/E ที่กรอก ${values.pe.toFixed(1)}x · ไม่มี peer/historical dataset สำหรับเทียบ`);
  if(Number.isFinite(values.ps)&&values.ps>0)notes.push(`P/S ที่กรอก ${values.ps.toFixed(1)}x · ควรเทียบ margin และการเติบโตจากแหล่งเดียวกัน`);
  if(Number.isFinite(values.evEbitda)&&values.evEbitda>0)notes.push(`EV/EBITDA ที่กรอก ${values.evEbitda.toFixed(1)}x · ไม่มีค่ากลาง sector`);
  if(Number.isFinite(values.fcfYield))notes.push(`FCF yield ที่กรอก ${values.fcfYield.toFixed(1)}%`);
  return notes.length?notes.join(' · '):'ไม่มีตัวเลข valuation อัตโนมัติ';
}
