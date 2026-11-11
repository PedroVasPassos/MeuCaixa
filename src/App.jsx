import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight,
  Download, Edit3, FileDown, Landmark, Moon, Plus, Search, Settings, Sun, Trash2,
  Upload, Wallet, X
} from 'lucide-react';
import {
  CATEGORIES, cashBalanceAt, categoryTotals, csvFor, currentMonth, dailySpending,
  dayLabel, formatMoney, formatPercent, monthItems, monthKey, monthLabel, monthlySeries,
  parseMoney, portfolioAt, positionAt, reconcileBankBalance, roundMoney, shortMonth,
  summarize, todayISO, validDate
} from './lib/finance.js';
import { normalizeState, readState, STORAGE_KEY } from './lib/storage.js';
import './App.css';

const PAGES = [
  ['inicio', 'Resumo'],
  ['transacoes', 'Movimentações'],
  ['guardado', 'Dinheiro guardado'],
  ['planejamento', 'Planejamento'],
  ['relatorios', 'Relatórios'],
  ['ajustes', 'Ajustes']
];
const TYPE_NAMES = {
  receita: 'Dinheiro que entrou', despesa: 'Gasto', aporte: 'Dinheiro guardado',
  resgate: 'Dinheiro retirado do guardado', rendimento: 'Saldo conferido'
};
const newId = () => crypto.randomUUID();
const ordered = list => [...list].sort((a,b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
const moneyInput = value => value === undefined || value === null ? '' : String(value).replace('.', ',');
function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function Amount({ value, className = '' }) {
  return <span className={`amount ${className}`.trim()}>{formatMoney(value)}</span>;
}
function Empty({ children }) {
  return <div className="empty-state"><p>{children}</p></div>;
}
function Caption({ children }) {
  return <span className="section-kicker">{children}</span>;
}
function SectionHeading({ eyebrow, title, action }) {
  return <div className="section-heading"><div><Caption>{eyebrow}</Caption><h2>{title}</h2></div>{action}</div>;
}
function SpendBars({ series }) {
  const max = Math.max(1, ...series.map(point => point.despesas));
  return <div className="bars" role="img" aria-label="Gráfico de gastos nos últimos seis meses">
    {series.map((point, i) => <div className="bar-col" title={`${monthLabel(point.month)}: ${formatMoney(point.despesas)}`} key={point.month}>
      <div className="bar-track"><div className={i === series.length - 1 ? 'bar-current' : ''} style={{ height: `${Math.max(point.despesas > 0 ? 2 : 0, 100 * point.despesas / max)}%` }} /></div>
      <span>{shortMonth(point.month)}</span>
    </div>)}
  </div>;
}
function CategoryList({ categories, limit = 5 }) {
  if (!categories.length) return <Empty>Quando você registrar gastos, eles vão aparecer aqui separados por categoria.</Empty>;
  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  return <div className="category-list">{categories.slice(0,limit).map(cat => <div className="category-item" key={cat.name}>
    <div className="category-name"><strong>{cat.name}</strong><Amount value={cat.amount} /></div>
    <div className="thin-track"><div style={{ width: `${100 * cat.amount / Math.max(1,total)}%` }} /></div>
  </div>)}</div>;
}
function Ledger({ items, investments, onEdit, onRemove, limit }) {
  const list = limit ? items.slice(0,limit) : items;
  if (!list.length) return <Empty>Sem movimentações neste período. Comece registrando algo que você recebeu ou gastou.</Empty>;
  const names = new Map(investments.map(item => [item.id, item.institution]));
  return <div className="ledger">
    {list.map(item => {
      const income = item.type === 'receita';
      const expense = item.type === 'despesa';
      const transfer = ['aporte','resgate'].includes(item.type);
      const difference = item.type === 'rendimento';
      return <div className="ledger-row" key={item.id}>
        <span className={`ledger-mark ${income?'mark-good':expense?'mark-bad':'mark-neutral'}`}>{income?<ArrowUpRight size={17}/>:expense?<ArrowDownLeft size={17}/>:<Landmark size={16}/>}</span>
        <div className="ledger-copy"><strong>{item.title}</strong><small>{TYPE_NAMES[item.type]}{item.investmentId ? ` · ${names.get(item.investmentId) || 'Investimento'}` : ` · ${item.category || 'Outros'}`}</small></div>
        <time className="ledger-date">{dayLabel(item.date).slice(0,5)}</time>
        <div className={`ledger-value ${income?'positive':expense?'negative':''}`}>
          {difference ? (item.direction==='minus'?'− ':'+ ') : (income?'+ ':expense?'− ':item.type==='aporte'?'→ ':'← ')}<Amount value={item.amount}/>
        </div>
        <div className="ledger-actions">
          {!difference && <button className="icon-button" aria-label={`Editar ${item.title}`} title="Editar" onClick={() => onEdit(item)}><Edit3 size={15}/></button>}
          <button className="icon-button" aria-label={`Excluir ${item.title}`} title="Excluir" onClick={() => onRemove(item)}><Trash2 size={15}/></button>
        </div>
      </div>;
    })}
  </div>;
}

function InputModal({ modal, investments, items, onClose, onSave, selectedMonth }) {
  const kind = modal.kind;
  const initial = modal.initial || null;
  const investment = investments.find(inv => inv.id === (modal.investmentId || initial?.investmentId));
  const isFlow = ['despesa','receita','aporte','resgate'].includes(kind);
  const isInvestment = kind === 'investimento';
  const isBankBalance = kind === 'conferir';
  const isGoal = kind === 'meta';
  const title = ({
    despesa: 'Anotar um gasto', receita: 'Registrar dinheiro recebido',
    aporte: 'Coloquei mais dinheiro', resgate: 'Retirei dinheiro guardado',
    investimento: 'Adicionar dinheiro guardado', conferir: 'Conferir o saldo com o banco',
    meta: 'Criar uma meta'
  })[kind];
  const defaultTitle = kind === 'aporte' ? 'Guardei dinheiro' : kind === 'resgate' ? 'Retirei do guardado' : '';
  const opening = isInvestment ? roundMoney(Number(initial?.initialAmount || 0) + Number(initial?.initialYield || 0)) : 0;
  const [form, setForm] = useState(() => ({
    date: initial?.date || todayISO(),
    amount: initial?.amount === undefined ? '' : moneyInput(initial.amount),
    title: initial?.title || defaultTitle,
    category: initial?.category || (kind === 'receita' ? 'Salário' : 'Alimentação'),
    investmentId: initial?.investmentId || modal.investmentId || investments[0]?.id || '',
    name: initial?.name || 'CDB', institution: initial?.institution || 'PagBank',
    indexer: initial?.indexer || 'CDI', rate: initial?.rate ?? 103,
    opening: initial ? moneyInput(opening) : '',
    existingYield: initial ? moneyInput(initial.initialYield || 0) : '',
    bankBalance: '',
    goalName: initial?.name || '', goalTarget: initial ? moneyInput(initial.target) : '',
    goalSaved: initial ? moneyInput(initial.saved) : '0'
  }));
  const [error, setError] = useState('');
  useEffect(() => {
    const handle = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);
  const change = (key,value) => { setError(''); setForm(prev => ({...prev,[key]:value})); };
  const selectedInvestment = investments.find(inv => inv.id === form.investmentId);
  const preview = isBankBalance && investment ? reconcileBankBalance(investment,items,parseMoney(form.bankBalance),todayISO()) : null;
  const submit = event => {
    event.preventDefault();
    if (isGoal) {
      const target = parseMoney(form.goalTarget), saved = parseMoney(form.goalSaved);
      if (!form.goalName.trim() || !(target > 0) || !Number.isFinite(saved) || saved < 0) return setError('Preencha o nome da meta e valores válidos.');
      onSave(kind, { id:initial?.id, name:form.goalName.trim(), target:roundMoney(target), saved:roundMoney(saved) });
      return;
    }
    if (isInvestment) {
      const total = parseMoney(form.opening), yieldKnown = form.existingYield.trim() ? parseMoney(form.existingYield) : 0;
      const rate = Number(form.rate);
      if (!form.name.trim() || !form.institution.trim() || !(total >= 0) || !(yieldKnown >= 0) || yieldKnown > total || !Number.isFinite(rate) || rate < 0 || !validDate(form.date) || form.date > todayISO()) {
        return setError('Confira o valor guardado, a instituição e a data. O rendimento opcional não pode superar o saldo.');
      }
      onSave(kind, {
        id: initial?.id, name:form.name.trim(), institution:form.institution.trim(),
        indexer:form.indexer, rate, date:form.date,
        initialAmount:roundMoney(total-yieldKnown), initialYield:roundMoney(yieldKnown)
      });
      return;
    }
    if (isBankBalance) {
      const amount = parseMoney(form.bankBalance);
      if (!Number.isFinite(amount) || amount < 0) return setError('Digite o valor total que aparece no aplicativo do banco.');
      onSave(kind, { investmentId:investment.id, total:amount, date:todayISO() });
      return;
    }
    if (isFlow) {
      const amount = parseMoney(form.amount);
      if (!(amount > 0) || !validDate(form.date) || !form.title.trim()) return setError('Preencha a descrição, a data e um valor maior que zero.');
      if (['aporte','resgate'].includes(kind)) {
        const inv = selectedInvestment;
        if (!inv) return setError('Escolha onde seu dinheiro está guardado.');
        if (form.date < inv.date) return setError('A movimentação não pode ser anterior ao cadastro do investimento.');
        if (kind === 'resgate') {
          const existing = items.filter(item => item.id !== initial?.id);
          const available = positionAt(inv,existing,form.date).total;
          if (amount > available + 0.001) return setError(`Nesse dia, havia ${formatMoney(available)} guardados. Confira o valor da retirada.`);
        }
      }
      onSave(kind, {
        id:initial?.id, type:kind, title:form.title.trim().slice(0,90),
        amount:roundMoney(amount), date:form.date,
        category:['aporte','resgate'].includes(kind)?'Investimentos':form.category,
        investmentId:['aporte','resgate'].includes(kind)?form.investmentId:undefined
      });
    }
  };
  return <div className="modal-backdrop" onMouseDown={event => event.target===event.currentTarget && onClose()}>
    <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-top"><div><Caption>MEU CAIXA / REGISTRO</Caption><h2 id="modal-title">{initial?.id && kind!=='conferir' ? 'Editar registro' : title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></div>
      {kind==='aporte' && <p className="modal-explanation"><strong>Guardar mais:</strong> o valor sai do dinheiro disponível na conta e vai para o investimento. Não é um gasto.</p>}
      {kind==='resgate' && <p className="modal-explanation"><strong>Retirar do guardado:</strong> o valor volta para a sua conta. Não é salário nem renda nova.</p>}
      {isInvestment && <p className="modal-explanation">Cadastre o que <strong>já está guardado hoje</strong>. Esse saldo inicial não será descontado novamente da sua conta.</p>}
      {isBankBalance && <p className="modal-explanation">Abra o aplicativo do {investment.institution} e copie o <strong>saldo total do CDB</strong>. O Meu Caixa ajusta a diferença, sem pedir que você calcule os juros.</p>}
      <form className="form-stack" onSubmit={submit}>
        {isFlow && <>
          <label>O que foi?<input autoFocus value={form.title} onChange={e=>change('title',e.target.value)} placeholder={kind==='despesa'?'Ex.: Almoço, mercado, Uber':'Ex.: Salário, reembolso'} required/></label>
          <div className="form-grid"><label>Valor (R$)<input inputMode="decimal" value={form.amount} onChange={e=>change('amount',e.target.value)} placeholder="0,00" required/></label><label>Data<input type="date" value={form.date} onChange={e=>change('date',e.target.value)} required/></label></div>
          {['aporte','resgate'].includes(kind) ? <label>Em qual investimento?<select value={form.investmentId} onChange={e=>change('investmentId',e.target.value)}>{investments.map(inv=><option key={inv.id} value={inv.id}>{inv.institution} — {inv.name}</option>)}</select></label> : <label>Categoria<select value={form.category} onChange={e=>change('category',e.target.value)}>{CATEGORIES[kind].map(cat=><option key={cat} value={cat}>{cat}</option>)}</select></label>}
        </>}
        {isInvestment && <>
          <label>Onde você guarda esse dinheiro?<input autoFocus value={form.institution} onChange={e=>change('institution',e.target.value)} placeholder="Ex.: PagBank" required/></label>
          <label>Nome do investimento<input value={form.name} onChange={e=>change('name',e.target.value)} placeholder="Ex.: CDB" required/></label>
          <div className="form-grid"><label>Tipo de rendimento<select value={form.indexer} onChange={e=>change('indexer',e.target.value)}><option value="CDI">% do CDI</option><option value="Selic">Selic</option><option value="IPCA">IPCA + taxa</option><option value="Prefixado">Taxa prefixada</option><option value="Outro">Outro</option></select></label><label>Taxa contratada (%)<input type="number" min="0" step="0.01" value={form.rate} onChange={e=>change('rate',e.target.value)} required/></label></div>
          <label>Quanto já estava guardado quando você começou a registrar? (R$)<input value={form.opening} inputMode="decimal" onChange={e=>change('opening',e.target.value)} placeholder="Ex.: 500,00" required/></label>
          <label>Data desse saldo inicial<input type="date" value={form.date} onChange={e=>change('date',e.target.value)} required/></label>
          <details className="optional-detail"><summary>O banco mostra quanto já rendeu? (opcional)</summary><label>Rendimento já incluído no saldo acima (R$)<input value={form.existingYield} inputMode="decimal" onChange={e=>change('existingYield',e.target.value)} placeholder="Pode deixar em branco"/></label><p>Não some esse valor ao saldo. Ele já faz parte do total informado acima.</p></details>
        </>}
        {isBankBalance && <>
          <div className="reconcile-current"><span>Saldo que está no Meu Caixa</span><strong><Amount value={positionAt(investment,items,todayISO()).total}/></strong></div>
          <label>Saldo total que aparece no banco (R$)<input autoFocus inputMode="decimal" value={form.bankBalance} onChange={e=>change('bankBalance',e.target.value)} placeholder="Ex.: 1.035,28" required/></label>
          {preview && <p className="helper">Diferença a registrar: <strong>{preview.difference >= 0?'+ ':''}{formatMoney(preview.difference)}</strong>. Isso é uma conferência de saldo, não necessariamente rendimento líquido.</p>}
        </>}
        {isGoal && <><label>Nome da meta<input autoFocus value={form.goalName} onChange={e=>change('goalName',e.target.value)} placeholder="Ex.: Reserva de emergência" required/></label><div className="form-grid"><label>Quero juntar (R$)<input inputMode="decimal" value={form.goalTarget} onChange={e=>change('goalTarget',e.target.value)} required/></label><label>Já separei (R$)<input inputMode="decimal" value={form.goalSaved} onChange={e=>change('goalSaved',e.target.value)} required/></label></div><p className="helper">Metas são um planejamento visual. Esse valor não transfere dinheiro nem altera o saldo.</p></>}
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="modal-bottom"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button primary">Salvar <Check size={17}/></button></div>
      </form>
    </div>
  </div>;
}

export default function App() {
  const [data, setData] = useState(readState);
  const [page, setPage] = useState('inicio');
  const [month, setMonth] = useState(currentMonth);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [settingsDraft, setSettingsDraft] = useState(data.settings);
  const [importDraft, setImportDraft] = useState(null);
  const [showGuide, setShowGuide] = useState(true);
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
    document.documentElement.style.colorScheme = data.settings.theme;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch { setNotice('Não foi possível salvar os dados no navegador.'); }
  }, [data]);
  useEffect(() => { setSettingsDraft(data.settings); }, [data.settings]);
  const allMonth = useMemo(() => ordered(monthItems(data.items,month)), [data.items,month]);
  const recordedMonth = useMemo(() => allMonth.filter(item => item.date <= todayISO()), [allMonth]);
  const monthly = useMemo(() => summarize(recordedMonth), [recordedMonth]);
  const series = useMemo(() => monthlySeries(data.items.filter(item => item.date <= todayISO()),month,6), [data.items,month]);
  const categoryData = useMemo(() => categoryTotals(recordedMonth), [recordedMonth]);
  const available = useMemo(() => cashBalanceAt(data.items,data.settings,todayISO()), [data.items,data.settings]);
  const portfolio = useMemo(() => portfolioAt(data.investments,data.items,todayISO()), [data.items,data.investments]);
  const investments = useMemo(() => data.investments.filter(inv => inv.date <= todayISO()).map(inv => ({inv,position:positionAt(inv,data.items,todayISO())})),[data.investments,data.items]);
  const visible = useMemo(() => allMonth.filter(item => (filter==='todos' || (filter==='transferencias' ? ['aporte','resgate','rendimento'].includes(item.type) : item.type === filter)) && `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase().trim())),[allMonth,filter,search]);
  const planningRecords = monthItems(data.items,currentMonth()).filter(item=>item.date<=todayISO());
  const planningMonthly = summarize(planningRecords);
  const salaryPaid = planningRecords.filter(item => item.type==='receita' && item.category==='Salário').reduce((n,item)=>n+item.amount,0);
  const monthDays = month===currentMonth() ? new Date().getDate() : new Date(Number(month.slice(0,4)), Number(month.slice(5,7)),0).getDate();
  const dailyAverage = monthly.despesas / Math.max(1, monthDays);
  const budget = Number(data.settings.monthlyBudget)||0;
  const hasDemo = Boolean(data.demo);
  const noticeNow = msg => { setNotice(msg); };
  const requireReal = () => { if(hasDemo){noticeNow('Os dados ainda são exemplos. Clique em “Começar com meus dados” para registrar suas informações reais.');return false;}return true; };
  const go = name => {setPage(name);window.scrollTo({top:0,behavior:'smooth'});};
  function startEmpty() {
    if(!window.confirm('Remover os valores de exemplo e começar com seus próprios dados?')) return;
    setData(prev => ({...prev, demo:false, items:[], investments:[], goals:[], settings:{...prev.settings,openingBalance:0,openingDate:todayISO(),salary:0,monthlyBudget:0}}));
    setMonth(currentMonth()); setPage('ajustes'); setNotice('Pronto! Informe primeiro o saldo da sua conta em Ajustes.');
  }
  const open = (kind, opts={}) => { if(!requireReal())return; setModal({kind,...opts}); };
  function saveModal(kind,value) {
    if (kind==='investimento') {
      setData(prev => ({...prev, investments:value.id ? prev.investments.map(inv=>inv.id===value.id?value:inv) : [...prev.investments,{...value,id:newId()}]}));
      noticeNow('Dinheiro guardado cadastrado.');
    } else if (kind==='meta') {
      setData(prev => ({...prev, goals:value.id ? prev.goals.map(g=>g.id===value.id?value:g) : [...prev.goals,{...value,id:newId()}]}));
      noticeNow('Meta salva.');
    } else if (kind==='conferir') {
      const inv = data.investments.find(i=>i.id===value.investmentId);
      const check = reconcileBankBalance(inv,data.items,value.total,value.date);
      if (!check) { noticeNow('Não foi possível conferir esse saldo.');return; }
      if (check.amount < 0.01) {noticeNow('Está tudo certo: o saldo já confere com o banco.');}
      else {
        setData(prev => ({...prev, items:[...prev.items,{id:newId(),type:'rendimento',title:'Saldo conferido no banco',category:'Investimentos',investmentId:inv.id,date:value.date,direction:check.direction,amount:check.amount}]}));
        noticeNow('Saldo conferido e atualizado.');
      }
    } else {
      setData(prev => ({...prev, items:value.id ? prev.items.map(item=>item.id===value.id?value:item) : [...prev.items,{...value,id:newId()}]}));
      setMonth(monthKey(value.date));
      noticeNow('Movimentação salva.');
    }
    setModal(null);
  }
  function deleteEntry(item) {
    if(!window.confirm(`Excluir “${item.title}”? Essa ação muda os saldos calculados.`))return;
    setData(prev => ({...prev,items:prev.items.filter(row=>row.id!==item.id)})); noticeNow('Registro excluído.');
  }
  function deleteInvestment(inv) {
    if(data.items.some(item=>item.investmentId===inv.id))return noticeNow('Esse investimento tem movimentações. Exclua esses registros antes de removê-lo.');
    if(!window.confirm(`Remover “${inv.institution} — ${inv.name}”?`))return;
    setData(prev => ({...prev,investments:prev.investments.filter(row=>row.id!==inv.id)}));
    noticeNow('Investimento removido.');
  }
  function deleteGoal(goal) {
    if(!window.confirm(`Remover a meta “${goal.name}”?`))return;
    setData(prev => ({...prev,goals:prev.goals.filter(row=>row.id!==goal.id)}));
  }
  function registerSalary() {
    if(!requireReal()) return;
    if(salaryPaid > 0) return noticeNow('Você já registrou salário neste mês. Confira Movimentações antes de registrar novamente.');
    open('receita', { initial: { title:'Salário',category:'Salário',amount:data.settings.salary||'',date:todayISO() } });
  }
  function saveSettings(e) {
    e.preventDefault();
    if(!requireReal())return;
    const openingBalance = parseMoney(settingsDraft.openingBalance);
    const salary = parseMoney(settingsDraft.salary);
    const monthlyBudget = parseMoney(settingsDraft.monthlyBudget);
    const salaryDay = Number(settingsDraft.salaryDay);
    if(!validDate(settingsDraft.openingDate) || !Number.isFinite(openingBalance) || !(salary>=0) || !(monthlyBudget>=0) || !(salaryDay>=1&&salaryDay<=28)) return noticeNow('Confira os valores, a data inicial e o dia do salário.');
    setData(prev => ({...prev,settings:{...prev.settings,openingBalance:roundMoney(openingBalance),openingDate:settingsDraft.openingDate,salary:roundMoney(salary),salaryDay,monthlyBudget:roundMoney(monthlyBudget)}}));
    noticeNow('Dados iniciais salvos.');
  }
  function exportCsv() {
    if(!allMonth.length) return noticeNow('Ainda não há movimentações nesse mês.');
    download(`meu-caixa-${month}.csv`,csvFor(allMonth),'text/csv;charset=utf-8');
  }
  function exportBackup() {download(`meu-caixa-backup-${todayISO()}.json`,JSON.stringify(data,null,2),'application/json');}
  async function chooseBackup(file) {
    if(!file)return;
    try {const result=normalizeState(JSON.parse(await file.text()));if(!result)throw new Error('Invalid');setImportDraft(result);noticeNow('Arquivo válido. Confirme a restauração em Ajustes.');}
    catch {noticeNow('Esse arquivo não é um backup válido do Meu Caixa.');}
  }
  function restoreBackup() {
    if(!importDraft || !window.confirm('Substituir TODOS os dados atuais pelos dados do backup?'))return;
    setData(importDraft);setImportDraft(null);setMonth(currentMonth());noticeNow('Backup restaurado.');
  }
  const pageTitle = PAGES.find(item=>item[0]===page)?.[1] || 'Resumo';
  const showMonth = ['inicio','transacoes','relatorios'].includes(page);
  return <div className="app">
    <header className="site-header">
      <div className="header-inner">
        <button className="wordmark" onClick={()=>go('inicio')} aria-label="Ir para o resumo">MEU <span>CAIXA</span><i>.</i></button>
        <nav className="main-nav" aria-label="Navegação principal">{PAGES.map(([id,label])=><button key={id} className={id===page?'nav-active':''} aria-current={id===page?'page':undefined} onClick={()=>go(id)}>{label}</button>)}</nav>
        <div className="header-tools">
          {showMonth && <label className="month-field"><CalendarDays size={16}/><input type="month" aria-label="Mês em análise" value={month} onChange={e=>setMonth(e.target.value||month)}/></label>}
          <button className="theme-toggle" onClick={()=>setData(prev=>({...prev,settings:{...prev.settings,theme:prev.settings.theme==='dark'?'light':'dark'}}))} title="Alternar tema" aria-label={data.settings.theme==='dark'?'Ativar modo claro':'Ativar modo escuro'}>{data.settings.theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{data.settings.theme==='dark'?'Claro':'Escuro'}</span></button>
        </div>
      </div>
    </header>
    <main className="main">
      {hasDemo && <div className="demo-banner"><div><strong>Esta é uma demonstração.</strong> Os valores são exemplos, não seu dinheiro real.</div><button onClick={startEmpty}>Começar com meus dados <ArrowRight size={16}/></button></div>}
      {notice && <div className="feedback" role="status"><Check size={17}/><span>{notice}</span><button className="icon-button" aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={16}/></button></div>}
      {page==='inicio' && <>
        <div className="intro"><div><Caption>MEU CAIXA — {monthLabel(month).toUpperCase()}</Caption><h1>Seu dinheiro, sem complicação.</h1><p>O essencial primeiro. O restante, só quando você precisar.</p></div><div className="intro-actions"><button className="button primary" onClick={()=>open('despesa')}><Plus size={17}/> Anotar gasto</button><button className="button secondary" onClick={()=>open('receita')}>Recebi dinheiro</button></div></div>
        <div className="home-primary">
          <section className="balance-feature"><Caption>DISPONÍVEL NA CONTA, HOJE</Caption><div className="balance-value"><Amount className={available<0?'negative':''} value={available}/></div><p>Esse é o dinheiro que você pode usar. O que está no CDB aparece separado.</p><button className="text-link" onClick={()=>go('transacoes')}>Ver movimentações <ArrowRight size={17}/></button></section>
          <section className="month-overview"><Caption>SEU MÊS EM NÚMEROS</Caption><div className="simple-stat"><span>Entrou</span><strong className="positive">+ <Amount value={monthly.receitas}/></strong></div><div className="simple-stat"><span>Saiu em gastos</span><strong className="negative">− <Amount value={monthly.despesas}/></strong></div><div className="simple-stat"><span>Sobrou do que entrou</span><strong className={monthly.resultado<0?'negative':''}><Amount value={monthly.resultado}/></strong></div><p className="fine-print">O resultado do mês não é o saldo da conta: ele não inclui dinheiro que já havia antes nem transferências para o CDB.</p></section>
        </div>
        <div className="home-columns">
          <section className="content-section"><SectionHeading eyebrow="SEU HISTÓRICO" title="Últimas movimentações" action={<button className="text-link" onClick={()=>go('transacoes')}>Ver tudo <ArrowRight size={16}/></button>}/><Ledger items={allMonth} investments={data.investments} limit={5} onEdit={item=>open(item.type,{initial:item,investmentId:item.investmentId})} onRemove={deleteEntry}/></section>
          <section className="saved-feature"><Caption>DINHEIRO GUARDADO</Caption><div className="saved-figure"><Amount value={portfolio.total}/></div><p>Valor registrado em CDBs e outros investimentos.</p><div className="saved-rule"/><div className="saved-bottom"><span>{data.investments.length?`${data.investments.length} ${data.investments.length===1?'investimento':'investimentos'} cadastrados`:'Nenhum investimento cadastrado'}</span><button className="text-link" onClick={()=>go('guardado')}>Ver guardado <ArrowRight size={16}/></button></div></section>
        </div>
        <div className="home-columns lower-home"><section className="content-section"><SectionHeading eyebrow="EM QUE VOCÊ GASTOU" title="Gastos por categoria"/><CategoryList categories={categoryData} limit={4}/></section><section className="content-section"><SectionHeading eyebrow="SEU RITMO" title="Quanto gastou por dia"/><div className="daily-figure"><Amount value={dailyAverage}/><span>por dia, em média neste mês</span></div><p className="fine-print">Média calculada pelas despesas registradas e pelos dias decorridos no período.</p><button className="text-link" onClick={()=>go('relatorios')}>Ver evolução dos gastos <ArrowRight size={16}/></button></section></div>
      </>}
      {page==='transacoes' && <>
        <div className="intro"><div><Caption>{monthLabel(month).toUpperCase()}</Caption><h1>O que entrou e saiu.</h1><p>Registre no dia em que acontecer. Você pode corrigir depois.</p></div><div className="intro-actions"><button className="button primary" onClick={()=>open('despesa')}><Plus size={17}/> Anotar gasto</button><button className="button secondary" onClick={()=>open('receita')}>Recebi dinheiro</button></div></div>
        <section className="content-section full-section"><div className="filter-row"><label className="search-field"><Search size={16}/><input placeholder="Buscar movimentação" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filtrar movimentações" value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todas as movimentações</option><option value="receita">Dinheiro recebido</option><option value="despesa">Gastos</option><option value="transferencias">Dinheiro guardado / retirado</option></select><button className="text-link" onClick={exportCsv}><Download size={16}/> Baixar CSV</button></div><Ledger items={visible} investments={data.investments} onEdit={item=>open(item.type,{initial:item,investmentId:item.investmentId})} onRemove={deleteEntry}/><p className="fine-print">{visible.length} movimentações encontradas. Transferir para o CDB não conta como gasto.</p></section>
      </>}
      {page==='guardado' && <>
        <div className="intro"><div><Caption>SEU PATRIMÔNIO</Caption><h1>O dinheiro que você está guardando.</h1><p>Um lugar simples para acompanhar seu CDB sem fazer contas difíceis.</p></div><div className="intro-actions"><button className="button primary" onClick={()=>open('investimento')}><Plus size={17}/> Cadastrar investimento</button></div></div>
        <section className="guarded-summary"><div><Caption>TOTAL GUARDADO</Caption><div className="guarded-number"><Amount value={portfolio.total}/></div><p>Esse dinheiro está separado do saldo disponível na sua conta.</p></div><div className="guarded-aside"><span>Você pode acompanhar seu PagBank aqui.</span><p><strong>103% do CDI</strong> é a taxa do produto, não o valor que ele já rendeu. O Meu Caixa ainda não calcula rendimentos automaticamente.</p></div></section>
        <section className="content-section full-section"><SectionHeading eyebrow="ONDE ESTÁ GUARDADO" title="Meus investimentos" />
          {!investments.length ? <Empty>Quando você cadastrar o CDB do PagBank, ele aparecerá aqui com seu saldo.</Empty> : investments.map(({inv,position})=><article className="investment-row" key={inv.id}>
            <div className="investment-name"><div className="investment-emblem"><Landmark size={21}/></div><div><strong>{inv.institution} <span className="tiny-dot">·</span> {inv.name}</strong><p>{inv.rate}% {inv.indexer==='CDI'?'do CDI':inv.indexer} · acompanhamento manual</p></div></div>
            <div className="investment-total"><span>Saldo guardado</span><strong><Amount value={position.total}/></strong></div>
            <div className="investment-controls"><button className="button primary" onClick={()=>open('aporte',{investmentId:inv.id})}>Guardei mais</button><button className="button secondary" onClick={()=>open('resgate',{investmentId:inv.id})}>Retirei dinheiro</button><button className="button secondary" onClick={()=>open('conferir',{investmentId:inv.id})}>Conferir saldo</button></div>
            <div className="investment-edit"><button className="text-link" onClick={()=>open('investimento',{initial:inv})}>Editar cadastro</button><button className="text-link delete-link" onClick={()=>deleteInvestment(inv)}>Excluir</button></div>
          </article>)}
        </section>
        <details className="explain-box" open={showGuide} onToggle={e=>setShowGuide(e.currentTarget.open)}><summary>O que significa cada botão?</summary><div className="explain-list"><div><strong>Guardei mais</strong><p>Você colocou mais dinheiro no CDB. Sai da conta e aumenta o dinheiro guardado.</p></div><div><strong>Retirei dinheiro</strong><p>Você tirou uma parte do CDB e trouxe para a conta. Não é salário nem gasto.</p></div><div><strong>Conferir saldo</strong><p>Você abre o PagBank e digita quanto aparece lá no total. Registramos a diferença, que pode incluir rendimentos e outros ajustes.</p></div></div><p className="fine-print">Importante: a diferença entre saldos não é uma apuração de rendimento líquido ou de impostos. Use o extrato do banco como referência.</p></details>
      </>}
      {page==='planejamento' && <>
        <div className="intro"><div><Caption>ORGANIZAÇÃO</Caption><h1>Planejar também faz parte.</h1><p>Seu salário, seus limites e seus objetivos em um só lugar.</p></div><div className="intro-actions"><button className="button primary" onClick={registerSalary}>Registrar salário recebido</button></div></div>
        <div className="two-col"><section className="content-section"><SectionHeading eyebrow="MEU SALÁRIO" title="Recebimento do mês"/><div className="simple-stat"><span>Salário planejado</span><strong><Amount value={data.settings.salary}/></strong></div><div className="simple-stat"><span>Já registrado neste mês</span><strong className="positive"><Amount value={salaryPaid}/></strong></div><p className="fine-print">Seu salário previsto só entra no saldo quando você clicar em “Registrar salário recebido” e salvar.</p><button className="text-link" onClick={()=>go('ajustes')}>Alterar salário previsto <ArrowRight size={16}/></button></section>
          <section className="content-section"><SectionHeading eyebrow="CONTROLE" title="Meu limite de gastos"/><div className="simple-stat"><span>Limite que você escolheu</span><strong>{budget?<Amount value={budget}/>: 'Ainda não definido'}</strong></div><div className="simple-stat"><span>Já gastou</span><strong className="negative"><Amount value={planningMonthly.despesas}/></strong></div>{budget>0 && <div className="thin-track"><div style={{width:`${Math.min(100,planningMonthly.despesas/budget*100)}%`}}/></div>}<p className="fine-print">{budget>0?`${formatMoney(Math.max(0,budget-planningMonthly.despesas))} ainda dentro do limite.`:'Defina um limite mensal em Ajustes.'}</p><button className="text-link" onClick={()=>go('ajustes')}>Ajustar limite <ArrowRight size={16}/></button></section></div>
        <section className="content-section full-section"><SectionHeading eyebrow="OBJETIVOS" title="Metas pessoais" action={<button className="text-link" onClick={()=>open('meta')}><Plus size={16}/> Nova meta</button>}/>{!data.goals.length?<Empty>Quer montar uma reserva de emergência ou juntar para uma viagem? Crie uma meta.</Empty>:<div className="goals-grid">{data.goals.map(goal=><div className="goal-entry" key={goal.id}><div><strong>{goal.name}</strong><span>{formatPercent(goal.saved/goal.target)} concluído</span></div><p>{formatMoney(goal.saved)} de {formatMoney(goal.target)}</p><div className="thin-track"><div style={{width:`${Math.min(100,goal.saved/goal.target*100)}%`}}/></div><div className="small-actions"><button onClick={()=>open('meta',{initial:goal})}>Editar</button><button onClick={()=>deleteGoal(goal)}>Excluir</button></div></div>)}</div>}<p className="fine-print">Metas são marcadores de progresso: não movimentam dinheiro automaticamente.</p></section>
      </>}
      {page==='relatorios' && <>
        <div className="intro"><div><Caption>{monthLabel(month).toUpperCase()}</Caption><h1>Entenda seus hábitos.</h1><p>Sem números escondidos: só o que você registrou.</p></div><div className="intro-actions"><button className="button secondary" onClick={exportCsv}><FileDown size={16}/> Baixar dados do mês</button></div></div>
        <div className="two-col"><section className="content-section"><SectionHeading eyebrow="ÚLTIMOS SEIS MESES" title="Gastos ao longo do tempo"/><SpendBars series={series}/></section><section className="content-section"><SectionHeading eyebrow="MÊS SELECIONADO" title="Para onde foi"/><CategoryList categories={categoryData}/></section></div>
        <div className="two-col"><section className="content-section"><SectionHeading eyebrow="MÉDIA" title="Gasto médio por dia"/><div className="daily-figure"><Amount value={dailyAverage}/><span>por dia neste mês</span></div><p className="fine-print">A média divide o total de gastos pelos dias transcorridos no mês.</p></section><section className="content-section"><SectionHeading eyebrow="VISÃO DO MÊS" title="Entradas e saídas"/><div className="simple-stat"><span>Recebido</span><strong className="positive"><Amount value={monthly.receitas}/></strong></div><div className="simple-stat"><span>Gasto</span><strong className="negative"><Amount value={monthly.despesas}/></strong></div><div className="simple-stat"><span>Diferença</span><strong><Amount value={monthly.resultado}/></strong></div></section></div>
        <section className="content-section full-section"><SectionHeading eyebrow="POR DIA" title="Dias em que você gastou"/>{dailySpending(recordedMonth,month).length ? <div className="day-list">{dailySpending(recordedMonth,month).map(day=><div key={day.date}><time>{dayLabel(day.date)}</time><strong><Amount value={day.amount}/></strong></div>)}</div> : <Empty>Nenhum gasto registrado para este mês.</Empty>}</section>
      </>}
      {page==='ajustes' && <>
        <div className="intro"><div><Caption>SEUS DADOS</Caption><h1>Comece pelos números reais.</h1><p>Preencha uma vez. Depois, basta anotar suas movimentações.</p></div></div>
        <div className="two-col"><section className="content-section"><SectionHeading eyebrow="PASSO 01" title="O que já tenho na conta"/><form className="form-stack settings-form" onSubmit={saveSettings}><label>Saldo que tenho disponível hoje (R$)<input inputMode="decimal" value={settingsDraft.openingBalance} onChange={e=>setSettingsDraft(prev=>({...prev,openingBalance:e.target.value}))} required/></label><label>Data em que comecei a controlar<input type="date" value={settingsDraft.openingDate} onChange={e=>setSettingsDraft(prev=>({...prev,openingDate:e.target.value}))} required/></label><p className="fine-print">Informe só o dinheiro disponível nas contas. Não inclua o que já está no CDB, pois ele será cadastrado em Dinheiro guardado.</p><div className="form-divider"/><label>Meu salário mensal previsto (R$)<input inputMode="decimal" value={settingsDraft.salary} onChange={e=>setSettingsDraft(prev=>({...prev,salary:e.target.value}))}/></label><div className="form-grid"><label>Dia em que costumo receber<input type="number" min="1" max="28" value={settingsDraft.salaryDay} onChange={e=>setSettingsDraft(prev=>({...prev,salaryDay:e.target.value}))}/></label><label>Limite de gastos no mês (R$)<input inputMode="decimal" value={settingsDraft.monthlyBudget} onChange={e=>setSettingsDraft(prev=>({...prev,monthlyBudget:e.target.value}))}/></label></div><button className="button primary" type="submit">Salvar meus números</button></form></section>
          <section className="content-section"><SectionHeading eyebrow="PASSO 02" title="Seu dinheiro guardado"/><p className="readable">Depois de salvar seu saldo da conta, cadastre o valor que já está aplicado no PagBank. O Meu Caixa mantém os dois separados.</p><button className="button secondary" onClick={()=>go('guardado')}>Ir para dinheiro guardado <ArrowRight size={16}/></button><div className="form-divider"/><SectionHeading eyebrow="SEGURANÇA" title="Cópia dos seus dados"/><p className="readable">Por enquanto, seus dados ficam neste navegador. Faça uma cópia antes de trocar de computador ou limpar o navegador.</p><div className="stacked-actions"><button className="button secondary" onClick={exportBackup}><Download size={16}/> Baixar backup</button><label className="button secondary file-label"><Upload size={16}/> Escolher backup<input type="file" accept="application/json,.json" onChange={e=>chooseBackup(e.target.files?.[0])}/></label>{importDraft && <button className="button primary" onClick={restoreBackup}>Confirmar restauração</button>}</div><p className="fine-print">Ainda não existe login nem sincronização com Supabase nesta versão.</p></section></div>
      </>}
      <footer className="footer"><span>MEU CAIXA · CONTROLE FINANCEIRO PESSOAL</span><span>{hasDemo?'Dados de demonstração':'Salvo neste navegador · Faça backup'}</span></footer>
    </main>
    {modal && <InputModal key={`${modal.kind}-${modal.initial?.id || modal.investmentId || 'new'}`} modal={modal} investments={data.investments} items={data.items} selectedMonth={month} onClose={()=>setModal(null)} onSave={saveModal}/>}
  </div>;
}
