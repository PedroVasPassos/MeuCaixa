import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,cashBalanceAt,positionAt,portfolioAt,categoryTotals,addMonths,parseMoney,monthlySeries} from '../src/lib/finance.js';
const items=[
{id:'1',date:'2026-11-02',type:'receita',amount:3500,category:'Salário'},
{id:'2',date:'2026-11-05',type:'despesa',amount:350,category:'Alimentação'},
{id:'3',date:'2026-11-07',type:'aporte',amount:500,investmentId:'cdb'},
{id:'4',date:'2026-11-09',type:'rendimento',amount:6,investmentId:'cdb'},
{id:'5',date:'2026-11-10',type:'resgate',amount:100,investmentId:'cdb'}
];
test('aporte e resgate não são classificados como receitas ou despesas',()=>assert.deepEqual(summarize(items),{receitas:3500,despesas:350,aportes:500,resgates:100,resultado:3150,variacaoCaixa:2750}));
test('saldo líquido respeita transferências e saldo inicial',()=>assert.equal(cashBalanceAt(items,{openingBalance:80,openingDate:'2026-11-01'},'2026-11-11'),2830));
test('saldo exclui operações após a data da consulta',()=>assert.equal(cashBalanceAt(items,{openingBalance:80,openingDate:'2026-11-01'},'2026-11-06'),3230));
test('posição investida inclui aportes, resgates e rendimento informado',()=>assert.deepEqual(positionAt({id:'cdb',date:'2026-01-01',initialAmount:1000,initialYield:10},items),{principal:1400,yield:16,total:1416}));
test('rendimento negativo ajusta a posição',()=>assert.equal(positionAt({id:'cdb',date:'2026-01-01',initialAmount:1000,initialYield:0},[...items,{id:'6',date:'2026-11-11',type:'rendimento',amount:3,direction:'minus',investmentId:'cdb'}]).yield,3));
test('patrimônio não soma salário ao investimento',()=>assert.equal(portfolioAt([{id:'cdb',date:'2026-01-01',initialAmount:1000,initialYield:10}],items).total,1416));
test('categorias somam apenas despesas',()=>assert.equal(categoryTotals(items)[0].amount,350));
test('meses atravessam a virada do ano',()=>assert.equal(addMonths('2026-12',1),'2027-01'));
test('parsing de moeda suporta vírgula brasileira',()=>assert.equal(parseMoney('R$ 1.234,56'),1234.56));
test('série mensal corresponde aos meses calculados',()=>assert.equal(monthlySeries(items,'2026-11',2)[0].month,'2026-10'));

test('no mesmo mês, aporte reduz caixa mas não aumenta despesa',()=>{
 const state=summarize([{type:'receita',amount:1000},{type:'despesa',amount:150},{type:'aporte',amount:200},{type:'resgate',amount:50}]);
 assert.equal(state.resultado,850);
 assert.equal(state.variacaoCaixa,700);
});
test('resgate e aporte não criam rendimentos fictícios',()=>{
 const inv={id:'x',date:'2026-01-01',initialAmount:1000,initialYield:0};
 const transactions=[{id:'a',investmentId:'x',date:'2026-11-01',type:'aporte',amount:150},{id:'b',investmentId:'x',date:'2026-11-02',type:'resgate',amount:50}];
 assert.deepEqual(positionAt(inv,transactions),{principal:1100,yield:0,total:1100});
});

import {reconcileBankBalance} from '../src/lib/finance.js';
test('conferência do saldo registra apenas a diferença, sem duplicar ganhos',()=>{
  const inv={id:'cdb',date:'2026-01-01',initialAmount:1000,initialYield:0};
  const first=reconcileBankBalance(inv,[],1005,'2026-11-11');
  assert.equal(first.difference,5);
  const ledger=[{id:'c1',date:'2026-11-11',type:'rendimento',amount:first.amount,direction:first.direction,investmentId:'cdb'}];
  const second=reconcileBankBalance(inv,ledger,1005,'2026-11-11');
  assert.equal(second.difference,0);
  const third=reconcileBankBalance(inv,ledger,1008,'2026-11-11');
  assert.equal(third.difference,3);
});
test('conferência aceita diferença negativa sem chamar de gasto',()=>{
  const inv={id:'cdb',date:'2026-01-01',initialAmount:1000,initialYield:0};
  const check=reconcileBankBalance(inv,[],995,'2026-11-11');
  assert.equal(check.amount,5);
  assert.equal(check.direction,'minus');
  assert.equal(summarize([{type:'rendimento',amount:check.amount,direction:'minus'}]).despesas,0);
});
test('conferência rejeita saldo inválido e anterior ao investimento',()=>{
  const inv={id:'cdb',date:'2026-11-08',initialAmount:1000,initialYield:0};
  assert.equal(reconcileBankBalance(inv,[],-2,'2026-11-11'),null);
  assert.equal(reconcileBankBalance(inv,[],1000,'2026-11-07'),null);
});
test('aportes reduzem o dinheiro da conta mas mantêm o patrimônio total consolidado',()=>{
  const inv={id:'cdb',date:'2026-01-01',initialAmount:300,initialYield:0};
  const settings={openingBalance:700,openingDate:'2026-11-01'};
  const before=cashBalanceAt([],settings,'2026-11-11')+positionAt(inv,[]).total;
  const afterRows=[{id:'d',date:'2026-11-11',type:'aporte',amount:200,investmentId:'cdb'}];
  const after=cashBalanceAt(afterRows,settings,'2026-11-11')+positionAt(inv,afterRows).total;
  assert.equal(before,1000);
  assert.equal(after,1000);
});
test('valor digitado com separador de milhar brasileiro não é confundido',()=>{
  assert.equal(parseMoney('5.000'),5000);
  assert.equal(parseMoney('1.200.300,50'),1200300.50);
  assert.equal(parseMoney('19,90'),19.9);
  assert.equal(parseMoney('1.20'),1.2);
  assert.ok(Number.isNaN(parseMoney('1.22.333')));
});
test('retirar todo o saldo zera o investimento',()=>{
  const inv={id:'cdb',date:'2026-01-01',initialAmount:1000,initialYield:10};
  const rows=[{id:'ret',investmentId:'cdb',date:'2026-11-11',type:'resgate',amount:1010}];
  assert.deepEqual(positionAt(inv,rows),{principal:0,yield:0,total:0});
});
