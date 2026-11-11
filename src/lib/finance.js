export const CATEGORIES = {
  despesa: ['Alimentação', 'Moradia', 'Transporte', 'Assinaturas', 'Lazer', 'Saúde', 'Compras', 'Estudos', 'Contas', 'Outros'],
  receita: ['Salário', 'Freelance', 'Reembolso', 'Presente', 'Outros']
};

export const formatMoney = value => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(Number(value) || 0);
export const formatPercent = value => new Intl.NumberFormat('pt-BR', {style:'percent', maximumFractionDigits:1, minimumFractionDigits:1}).format(Number(value) || 0);
export const monthKey = date => String(date || '').slice(0, 7);
export function todayISO(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export const currentMonth = () => monthKey(todayISO());
export const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime()) && todayISO(new Date(`${date}T12:00:00`)) === date;
export function addMonths(key, change) {
  const [year, month] = String(key).split('-').map(Number);
  const date = new Date(year, month - 1 + change, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
export const monthLabel = key => new Intl.DateTimeFormat('pt-BR', {month:'long', year:'numeric'}).format(new Date(`${key}-01T12:00:00`));
export const shortMonth = key => new Intl.DateTimeFormat('pt-BR', {month:'short'}).format(new Date(`${key}-01T12:00:00`)).replace('.','').toUpperCase();
export const dayLabel = date => String(date).split('-').reverse().join('/');
export function parseMoney(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  const source = String(input ?? '').trim().replace(/R\$|\s/g,'');
  if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(source))
    return Number(source.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d+(,\d{1,2})?$/.test(source))
    return Number(source.replace(',', '.'));
  if (/^-?\d+(\.\d{1,2})?$/.test(source))
    return Number(source);
  return NaN;
}
export const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
export function summarize(items) {
  let receitas = 0, despesas = 0, aportes = 0, resgates = 0;
  for (const item of items) {
    if (item.type === 'receita') receitas += item.amount;
    if (item.type === 'despesa') despesas += item.amount;
    if (item.type === 'aporte') aportes += item.amount;
    if (item.type === 'resgate') resgates += item.amount;
  }
  return {receitas:roundMoney(receitas), despesas:roundMoney(despesas), aportes:roundMoney(aportes), resgates:roundMoney(resgates), resultado:roundMoney(receitas-despesas), variacaoCaixa:roundMoney(receitas-despesas-aportes+resgates)};
}
export const monthItems = (items, month) => items.filter(item => monthKey(item.date) === month);
export function monthlySeries(items, selectedMonth, count = 6) {
  return Array.from({length:count}, (_, index) => {
    const month = addMonths(selectedMonth, index-count+1);
    return {month, ...summarize(monthItems(items, month))};
  });
}
export function categoryTotals(items) {
  const totals = new Map();
  for (const item of items.filter(item => item.type === 'despesa')) totals.set(item.category, roundMoney((totals.get(item.category)||0)+item.amount));
  return [...totals.entries()].map(([name, amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);
}
export function cashBalanceAt(items, settings, asOf) {
  const beginning = settings?.openingDate || '1900-01-01';
  const initial = Number(settings?.openingBalance) || 0;
  return roundMoney(initial + summarize(items.filter(item => item.date >= beginning && item.date <= asOf)).variacaoCaixa);
}
export function positionAt(investment, items, asOf = '9999-12-31') {
  let principal = Number(investment.initialAmount)||0;
  let yieldTotal = Number(investment.initialYield)||0;
  for (const item of items) {
    if (item.investmentId !== investment.id || item.date > asOf || item.date < investment.date) continue;
    if (item.type === 'aporte') principal += item.amount;
    if (item.type === 'resgate') {
      const totalBefore = Math.max(0, principal + yieldTotal);
      const removed = Math.min(totalBefore, item.amount);
      const principalPart = Math.min(Math.max(0, principal), removed);
      principal -= principalPart;
      yieldTotal -= (removed - principalPart);
      if (Math.abs(principal + yieldTotal) < 0.005) { principal = 0; yieldTotal = 0; }
    }
    if (item.type === 'rendimento') yieldTotal += (item.direction === 'minus' ? -1 : 1) * item.amount;
  }
  const total = roundMoney(principal + yieldTotal);
  return {principal:roundMoney(principal), yield:roundMoney(yieldTotal), total};
}
export function portfolioAt(investments, items, asOf='9999-12-31') {
  return investments.filter(investment=>investment.date<=asOf).reduce((sum,investment) => {
    const position=positionAt(investment,items,asOf);
    return {principal:roundMoney(sum.principal+position.principal), yield:roundMoney(sum.yield+position.yield), total:roundMoney(sum.total+position.total)};
  }, {principal:0,yield:0,total:0});
}
export function dailySpending(items, month) {
  const byDay = new Map();
  for(const item of monthItems(items,month).filter(x=>x.type==='despesa')) byDay.set(item.date, roundMoney((byDay.get(item.date)||0)+item.amount));
  return [...byDay.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,amount])=>({date,amount}));
}
export function csvFor(items) {
  const cell = value => { const raw = String(value??''); const safe = /^[\s]*[=+@-]/.test(raw) ? `\'${raw}` : raw; return `\"${safe.replace(/\"/g, '\"\"')}\"`; };
  const rows=[['Data','Descrição','Tipo','Categoria','Valor','Investimento'],...items.map(item=>[item.date,item.title,item.type,item.category||'',item.amount.toFixed(2).replace('.',','),item.investmentId||''])];
  return '\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
export function normalizedItem(raw) {
  if (!raw || typeof raw.id !== 'string' || !validDate(raw.date) || !['receita','despesa','aporte','resgate','rendimento'].includes(raw.type) || !Number.isFinite(Number(raw.amount)) || Number(raw.amount)<=0) return null;
  return {...raw, amount:roundMoney(Number(raw.amount)), title:String(raw.title||'Movimentação').slice(0,90), category:String(raw.category||'Outros')};
}

// Uma conferência de saldo registra SOMENTE a diferença para o total exibido pelo banco.
// Ela não presume que a diferença seja rendimento líquido ou bruto.
export function reconcileBankBalance(investment, items, bankBalance, date) {
  const value = roundMoney(Number(bankBalance));
  if (!investment || !validDate(date) || date < investment.date || !Number.isFinite(value) || value < 0) return null;
  const before = positionAt(investment, items, date).total;
  const difference = roundMoney(value - before);
  return {before, after:value, difference, direction:difference < 0 ? 'minus' : 'plus', amount:Math.abs(difference)};
}
