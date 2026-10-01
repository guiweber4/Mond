// Negative balance = zero and the purchase rationale, on synthetic data (no fixtures, no network).
// Usage: node tests/purchasing.test.mjs
import assert from 'node:assert/strict';
import {setup} from './harness.mjs';
const h=await setup('purchasing');
const M=await h.load('model'),{totalId}=await h.load('totals'),F=await h.load('findings'),P=await h.load('purchasing'),R=await h.load('readiness');
const stores=M.defaultStores;
const T=(store,reference,description,category,qty,amount,size,color,start='2026-09-01',end='2026-09-30')=>({id:totalId(store,start,end,reference,size,color),store,start,end,reference,description,category,qty,amount,average:null,size,color});
const S=(store,reference,model,color,size,physical,date='2026-09-30')=>({id:`${date}:${store}:${reference}|${color}|${size}`,date,store,sku:`p:${reference}:${size}:${color}`,reference,model,color,size,physical,reserved:0,incoming:0,sourceFormat:'presence-stock',sourceBalances:[physical]});
// ---- Negative balance = zero, per variant, before any sum (fictitious values).
const neg=[S('02','1 CC0006','JEANS','PRETO','38',-2),S('02','1 CC0006','JEANS','PRETO','40',3)];
const ls=F.latestStock(neg);assert.deepEqual(ls.map(r=>r.physical),[0,3]);assert.equal(ls[0].reported,-2,'valor original preservado');assert.equal(neg[0].physical,-2,'dado importado não é alterado');
assert.equal(ls.reduce((a,r)=>a+r.physical,0),3,'−2 + 3 = 3, não 1');
const inv=M.inventory({sales:[],products:[],stock:neg,goals:[]},stores,'2026-09-30');assert.ok(inv.every(r=>r.physical>=0));assert.equal(inv.find(r=>r.size==='38').status,'out');
const rd=R.readiness({totals:[],stock:neg,stores,today:'2026-10-01'});assert.equal(rd.negativeAsZero,1);assert.ok(rd.limitations.some(l=>/consideradas zero/.test(l)));
assert.ok(!F.computeFindings([T('02','1 CC0006','JEANS','CALÇAS',5,5000,'38','PRETO')],neg,stores,{today:'2026-10-01'}).some(f=>f.kind==='negativo'),'sem cards de saldo negativo');
// ---- Purchase rationale. 30-day period; horizon 45+30+7 = 82 days.
const totals=[
 T('02','A1','CAMISETA','CAMISETAS',30,3000,'M','PRETO'),T('BC','A1','CAMISETA','CAMISETAS',15,1500,'M','PRETO'),T('02','A1','CAMISETA','CAMISETAS',6,600,'P','PRETO'),
 T('02','B1','VESTIDO','VESTIDOS',3,6000,'38','AZUL'),
 T('02','C1','BOLSA','ACESSÓRIOS',1,500,'UNI','PRETO'),
 T('02','D1','CALÇA','CALÇAS',4,2000,'40','BEGE'),T('02','D1','CALÇA','CALÇAS',-4,-2000,'42','BEGE'),
];
const stock=[S('02','A1','CAMISETA','PRETO','M',20),S('BC','A1','CAMISETA','PRETO','M',-5),S('02','A1','CAMISETA','PRETO','P',0),S('02','B1','VESTIDO','AZUL','38',200),S('03','Z9','PARADO','PRETO','M',40)];
const plan=P.purchasePlan({totals,stock,stores});
assert.equal(plan.horizon,82);assert.match(plan.method,/82 dias/);
const a1=plan.suggestions.find(s=>s.reference==='A1');assert.ok(a1);
const m=a1.lines.find(l=>l.size==='M');assert.equal(m.stock,20,'BC −5 conta como zero no saldo da rede');assert.equal(m.qty,Math.ceil(45/30*82-20),'pedido = venda/dia × 82 − saldo');
const p=a1.lines.find(l=>l.size==='P');assert.equal(p.qty,Math.ceil(6/30*82));assert.equal(a1.urgency,'alta','cobertura menor que o prazo de entrega');
assert.equal(m.split.reduce((x,y)=>x+y.qty,0),m.qty,'divisão por unidade fecha com o total');assert.ok(m.split.some(x=>x.short==='BC'),'BC vende e está sem saldo: recebe parte');
assert.ok(!plan.suggestions.some(s=>s.reference==='B1'),'saldo cobre o horizonte: sem compra');
assert.ok(!plan.suggestions.some(s=>s.reference==='C1'),'abaixo do mínimo vendido (2 peças)');
assert.ok(!plan.suggestions.some(s=>s.reference==='D1'),'venda líquida zero (devolução) não gera compra');
assert.ok(plan.avoid.some(a=>a.reference==='B1'&&/Cobertura/.test(a.reason)),'cobertura longa: não recomprar');assert.ok(plan.avoid.some(a=>a.reference==='Z9'&&/Sem venda/.test(a.reason)));
assert.equal(['A','B','C'].includes(a1.abc),true);assert.ok(plan.suggestions.every(s=>s.value===null||s.value===Math.round(s.price*s.qty*100)/100),'valor a preço médio de venda');
assert.ok(plan.limitations.some(l=>/não é demanda/.test(l))&&plan.limitations.some(l=>/Sem custo/.test(l))&&plan.limitations.some(l=>/Sem pedidos de compra/.test(l)));
// Open purchase orders matched by the variant's stock SKU are deducted.
const withPO=P.purchasePlan({totals,stock,stores,purchases:[{id:'po1',store:'02',sku:'p:A1:M:PRETO',supplier:'X',date:'2026-09-20',expected:'2026-11-01',qty:50,received:10,unitCost:10,status:'open'}]});
assert.equal(withPO.suggestions.find(s=>s.reference==='A1').lines.find(l=>l.size==='M').qty,m.qty-40);assert.ok(!withPO.limitations.some(l=>/Sem pedidos de compra/.test(l)));
// Parameters change the horizon.
assert.equal(P.purchasePlan({totals,stock,stores,ops:{leadDays:30,targetDays:30,safetyDays:0}}).suggestions.find(s=>s.reference==='A1').lines.find(l=>l.size==='M').qty,Math.ceil(45/30*60-20));
// "Não repor" holds until the numbers change.
const dismissed=[{dataset:'real',status:'dismissed',payload:JSON.stringify({id:a1.id,fingerprint:a1.fingerprint})}];
const d1=P.purchasePlan({totals,stock,stores,saved:dismissed});assert.ok(!d1.suggestions.some(s=>s.reference==='A1')&&d1.dismissed.length===1);
const d2=P.purchasePlan({totals,stock:[...stock.filter(r=>!(r.reference==='A1'&&r.size==='M'&&r.store==='02')),S('02','A1','CAMISETA','PRETO','M',5)],stores,saved:dismissed});assert.ok(d2.suggestions.some(s=>s.reference==='A1'),'números mudaram: volta a sugerir');
const ap=P.purchasePlan({totals,stock,stores,saved:[{dataset:'real',status:'approved',payload:JSON.stringify({id:a1.id})}]});assert.equal(ap.suggestions.find(s=>s.reference==='A1').status,'approved');
// Up to three equivalent periods: August + September average.
const aug=totals.filter(t=>t.reference==='A1'&&t.size==='M').map(t=>T(t.store,'A1','CAMISETA','CAMISETAS',t.qty*3,t.amount*3,'M','PRETO','2026-08-01','2026-08-31'));
const two=P.purchasePlan({totals:[...totals,...aug],stock,stores});assert.equal(two.periodsUsed,2);assert.equal(two.days,61);assert.equal(two.suggestions.find(s=>s.reference==='A1').lines.find(l=>l.size==='M').qty,Math.ceil((45+135)/61*82-20));
// Spreadsheet rows and helpers.
const rows=P.purchaseRows(plan);assert.ok(rows.length>0&&rows.every(r=>r.Pedir>0&&r.Referencia&&r.Tamanho));assert.deepEqual(P.splitInt(10,[1,1,1]),[4,3,3]);assert.deepEqual(P.splitInt(5,[0,0]),[3,2]);
assert.equal(P.purchasePlan({totals:[],stock,stores}),null);
await h.cleanup();console.log(`Passed: saldo negativo = zero por variante (sem cards, valor original preservado); compra = venda/dia × horizonte − saldo da rede − pedidos em aberto, urgência, ABC, divisão por unidade, mínimo vendido, devoluções, “não repor”, média de períodos e planilha.`);
