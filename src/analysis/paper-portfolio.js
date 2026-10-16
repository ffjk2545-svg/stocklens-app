export function calculatePaperPortfolio(startingCash, trades = [], quotes = []) {
  if (!Number.isFinite(startingCash) || startingCash < 0) throw new Error('เงินตั้งต้นต้องเป็นศูนย์หรือมากกว่า');
  let cash = startingCash;
  let realizedPnl = 0;
  const positions = new Map();
  const errors = [];
  for (const trade of [...trades].sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
    const symbol = String(trade.symbol || '').toUpperCase();
    const quantity = Number(trade.quantity), price = Number(trade.price), fee = Number(trade.fee || 0);
    if (!symbol || !['buy','sell'].includes(trade.side) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(fee) || fee < 0) { errors.push(`${symbol || 'รายการ'}: รูปแบบรายการไม่ถูกต้อง`); continue; }
    const position = positions.get(symbol) || { symbol, quantity:0, costBasis:0, realizedPnl:0 };
    if (trade.side === 'buy') {
      const debit = quantity * price + fee;
      if (debit > cash + 1e-8) { errors.push(`${symbol}: เงินสดจำลองไม่พอ`); continue; }
      cash -= debit; position.quantity += quantity; position.costBasis += debit;
    } else {
      if (quantity > position.quantity + 1e-8) { errors.push(`${symbol}: จำนวนขายมากกว่าหุ้นที่ถือ`); continue; }
      const averageCost = position.quantity ? position.costBasis / position.quantity : 0;
      const realized = quantity * price - fee - averageCost * quantity;
      position.realizedPnl += realized; realizedPnl += realized;
      position.costBasis -= averageCost * quantity; position.quantity -= quantity; cash += quantity * price - fee;
    }
    if (position.quantity <= 1e-8) { position.quantity=0; position.costBasis=0; }
    positions.set(symbol, position);
  }
  const quoteMap = new Map(quotes.map(item => [item.symbol, item]));
  const rows = [...positions.values()].filter(item => item.quantity > 0).map(item => {
    const quote = quoteMap.get(item.symbol);
    const last = Number.isFinite(quote?.last) ? quote.last : null;
    const marketValue = last == null ? null : item.quantity * last;
    return {...item, averageCost:item.quantity?item.costBasis/item.quantity:0, last, marketValue, unrealizedPnl:marketValue==null?null:marketValue-item.costBasis, quoteAsOf:quote?.asOf||null, quoteError:quote?.error||null};
  });
  const marketValue = rows.every(row => row.marketValue != null) ? rows.reduce((sum,row)=>sum+row.marketValue,0) : null;
  return {cash,positions:rows,marketValue,accountValue:marketValue==null?null:cash+marketValue,realizedPnl,unrealizedPnl:rows.every(row=>row.unrealizedPnl!=null)?rows.reduce((sum,row)=>sum+row.unrealizedPnl,0):null,errors};
}

export function validatePaperTrade(ledger, trade) {
  if (!trade || !/^[A-Z0-9.^_-]{1,15}$/.test(trade.symbol) || !['buy','sell'].includes(trade.side) || !Number.isFinite(trade.quantity) || trade.quantity <= 0 || !Number.isFinite(trade.price) || trade.price <= 0 || !Number.isFinite(trade.fee) || trade.fee < 0) return 'กรอกชื่อหุ้น จำนวน ราคา และค่าธรรมเนียมให้ถูกต้อง';
  const current = calculatePaperPortfolio(ledger.startingCash, ledger.trades);
  const trial = calculatePaperPortfolio(ledger.startingCash, [...ledger.trades, trade]);
  const issue = trial.errors.find(message => !current.errors.includes(message));
  return issue || '';
}