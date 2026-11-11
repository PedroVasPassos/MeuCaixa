import {addMonths,currentMonth,monthKey,todayISO,normalizedItem} from './finance.js';

export const STORAGE_KEY = 'meu-caixa-dual-v3';
export const OLD_STORAGE_KEY = 'meu-caixa-v1';

export function demoState(){
  const current=currentMonth();
  const make=(offset,day,title,type,category,amount,extra={})=>({id:`demo-${offset}-${day}-${title}`,date:`${addMonths(current,offset)}-${String(day).padStart(2,'0')}`,title,type,category,amount,...extra});
  const items=[
    ...[-3,-2,-1,0].flatMap((m)=>[
      make(m,5,'Salário','receita','Salário',3500),
      make(m,8,'Supermercado','despesa','Alimentação',286.40),
      make(m,10,'Transporte','despesa','Transporte',88.50),
      make(m,11,'Assinatura','despesa','Assinaturas',49.90),
      make(m,15,'Almoço','despesa','Alimentação',92.30),
      make(m,20,'Academia','despesa','Saúde',129.90),
      make(m,22,'Mercado','despesa','Alimentação',198.25)
    ]),
    make(0,7,'Aporte no CDB','aporte','Investimentos',200,{investmentId:'demo-invest'})
  ];
  return {
    version:3, demo:true, items,
    investments:[{id:'demo-invest',name:'CDB 103% do CDI',institution:'PagBank',indexer:'CDI',rate:103,initialAmount:5000,initialYield:42,date:`${addMonths(current,-3)}-01`}],
    goals:[{id:'demo-goal',name:'Minha próxima viagem',target:5000,saved:1200}],
    settings:{theme:'dark',openingDate:`${addMonths(current,-3)}-01`,openingBalance:0,salary:3500,salaryDay:5,monthlyBudget:2000}
  };
}

export function normalizeState(data){
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.investments)) return null;
  const settings=data.settings || {};
  const safe={version:3,demo:Boolean(data.demo),items:data.items.map(normalizedItem).filter(Boolean),investments:data.investments.filter(x=>x && typeof x.id==='string' && typeof x.name==='string' && Number(x.initialAmount)>=0 && Number(x.initialYield||0)>=0).map(x=>({...x,initialAmount:Number(x.initialAmount),initialYield:Number(x.initialYield||0),rate:Number(x.rate)||0})),goals:Array.isArray(data.goals)?data.goals.filter(x=>typeof x.id==='string'&&Number(x.target)>0).map(x=>({...x,target:Number(x.target),saved:Number(x.saved)||0})):[],settings:{theme:settings.theme==='light'?'light':'dark',openingDate:settings.openingDate||todayISO(),openingBalance:Number(settings.openingBalance)||0,salary:Number(settings.salary)||0,salaryDay:Math.max(1,Math.min(28,Number(settings.salaryDay)||5)),monthlyBudget:Number(settings.monthlyBudget)||0}};
  return safe;
}

export function readState(){
  try {
    const fresh=localStorage.getItem(STORAGE_KEY);
    if(fresh){ const state=normalizeState(JSON.parse(fresh));if(state)return state; }
    const legacy=localStorage.getItem(OLD_STORAGE_KEY);
    if(legacy){
      const old=JSON.parse(legacy);
      if(Array.isArray(old.items)){
        const items=old.items.map(normalizedItem).filter(Boolean);
        return normalizeState({version:3,demo:!!old.demo,items,investments:[],goals:[],settings:{theme:'dark',openingDate:items.length? [...items].sort((a,b)=>a.date.localeCompare(b.date))[0].date:todayISO(),openingBalance:0,salary:0,salaryDay:5,monthlyBudget:0}});
      }
    }
  }catch { /* armazenamento inválido: começa com demonstração */ }
  return demoState();
}
