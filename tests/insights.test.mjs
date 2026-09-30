// Insights engine, metrics, readiness, identity, analyst and access on synthetic data (no fixtures, no network).
// Usage: node tests/insights.test.mjs
import assert from 'node:assert/strict';
import {setup} from './harness.mjs';
const h=await setup('insights');
const {defaultStores}=await h.load('model'),{totalId}=await h.load('totals'),M=await h.load('metrics'),ID=await h.load('identity'),RD=await h.load('readiness'),I=await h.load('insights'),A=await h.load('analyst'),AC=await h.load('access');
const stores=defaultStores.map(s=>s.id==='05'?{...s,opened:'2025-11-01'}:s);
// Synthetic base: JK (02), BC and Ecomm (03); RJ (05) has no files. Values are fictitious and only exist here.
const T=(store,start,end,reference,description,category,qty,amount,size='',color='')=>({id:totalId(store,start,end,reference,size,color),store,start,end,reference,description,category,qty,amount,average:null,size,color});
const S=(store,date,reference,model,color,size,physical)=>({id:`${date}:${store}:${reference}|${color}|${size}`,date,store,sku:`p:${reference}:${size}:${color}`,reference,model,color,size,physical,reserved:0,incoming:0,sourceFormat:'presence-stock',sourceBalances:[physical]});
const AUG=['2026-08-01','2026-08-31'],SEP=['2026-09-01','2026-09-30'];
const totals=[
 // JK: JEANS falls (and has no stock now), CAMISA stable, new product in Sep, a return row and an adjustment.
 T('02',...AUG,'1 CC0006','JEANS RETO','CALÇAS',20,20000,'01 - 38','3    - CHUMBO'),T('02',...SEP,'1 CC0006','JEANS RETO','CALÇAS',6,6000,'01 - 38','3    - CHUMBO'),
 T('02',...AUG,'2 CM0001','CAMISA AGNES','CAMISAS',10,15000,'P','OFF'),T('02',...SEP,'2 CM0001','CAMISA AGNES','CAMISAS',10,15000,'P','OFF'),
 T('02',...SEP,'9 NV0001','VESTIDO NOVO','VESTIDOS',4,8000,'M','PRETO'),T('02',...SEP,'2 CM0001','CAMISA AGNES','CAMISAS',-1,-1500,'M','OFF'),T('02',...SEP,'2 CM0002','CAMISA AGNES','CAMISAS',0,-50,'G','AZUL'),
 // Homonym: same name, different reference in BC; Ecomm sells a model with stock only in JK.
 T('BC',...AUG,'5 CM0001','CAMISA AGNES','CAMISAS',8,12000,'P','OFF'),T('BC',...SEP,'5 CM0001','CAMISA AGNES','CAMISAS',8,12000,'P','OFF'),
 T('03',...AUG,'7 TR0001','TRENCH VITOR','CASACOS',3,9000,'M','CINZA'),T('03',...SEP,'7 TR0001','TRENCH VITOR','CASACOS',5,15000,'M','CINZA'),
];
const stock=[S('02','2026-09-30','1 CC0006','JEANS RETO','3 -CHUMBO','38',0),S('02','2026-09-30','2 CM0001','CAMISA AGNES','OFF','P',30),S('02','2026-09-30','7 TR0001','TRENCH VITOR','CINZA','M',12),
 S('BC','2026-09-30','5 CM0001','CAMISA AGNES','OFF','P',2),S('03','2026-09-30','9 XX0001','OUTRO','PRETO','M',3)];
const base={totals,stock,stores,today:'2026-10-02',saved:[]};
// ---- Metrics: denominators, small bases, STR, recomputed shares.
assert.equal(M.share(5,0),null);assert.equal(M.avgPrice(100,0),null);assert.equal(M.attainment(10,0),null);assert.equal(M.sellThrough(5,null),null,'estoque não informado');assert.equal(M.sellThrough(5,-2),null,'estoque negativo');assert.equal(M.sellThrough(8,2),80);
assert.deepEqual(M.growth(10,0),{abs:10,pct:null,smallBase:false});assert.equal(M.growth(300,100,1000).pct,null,'base pequena sem percentual');assert.equal(M.growth(300,100,1000).abs,200);assert.equal(M.contribution(5,0),null);
assert.equal(M.share(1,3)+M.share(2,3),100,'participação recalculada dos componentes');for(const d of Object.values(M.METRICS))assert.ok(d.name&&d.formula&&d.granularity&&d.requires.length&&d.limitations.length&&d.zero&&d.missing,d.id);
assert.match(M.METRICS.preco_medio_peca.definition,/não é ticket/i);assert.match(M.METRICS.margem.limitations.join(),/não é markup/i);
// ---- Identity: variant keys meet across sources; different references never merge.
assert.equal(ID.variantKey('1 CC0006','3    - CHUMBO','01 - 38'),ID.variantKey('1 CC0006','3 -CHUMBO','38'));
assert.equal(ID.canonicalRef('  1  cc0006 '),'1 CC0006');assert.equal(ID.canonicalRef('1-CC0006'),'1-CC0006','pontuação preservada');assert.equal(ID.canonicalRef('OLD1',{aliases:{OLD1:'1 CC0006'}}),'1 CC0006','tabela explícita');
assert.deepEqual(ID.nearCollisions(['1 CC0006','1CC0006','2 X']),[['1 CC0006','1CC0006']]);assert.deepEqual(ID.homonyms(totals).find(x=>x.name==='CAMISA AGNES').references,['2 CM0001','2 CM0002','5 CM0001']);
assert.deepEqual(ID.attr(''),{value:'Não informado',status:'nao_informado'});assert.equal(ID.attr('N/A').status,'nao_aplicavel');assert.equal(ID.typeOf('X').status,'nao_informado');
// ---- Readiness: period, comparison, partial period, RJ opened after nothing, overlap never summed.
const rd=RD.readiness({...base,staleDays:7});assert.equal(rd.period.start,'2026-09-01');assert.equal(rd.previous.method,'mes_calendario');assert.deepEqual(rd.previous.stores,['02','03','BC']);assert.ok(rd.reconciliation.ok,'consolidado = unidades = categorias = modelos');
assert.ok(rd.limitations.some(l=>/RJ/.test(l)&&/não é venda zero/.test(l)));assert.equal(rd.capabilities.find(c=>c.id==='apostas').status,'indisponivel');assert.equal(rd.capabilities.find(c=>c.id==='cobertura').status,'indisponivel');
assert.equal(rd.returns.negativeRows,2,'devolução e ajuste negativo preservados');assert.equal(rd.returns.adjustments,1);
const partial=[...totals,T('02','2026-10-01','2026-10-15','1 CC0006','JEANS RETO','CALÇAS',3,3000,'01 - 38','3    - CHUMBO')];const rp=RD.readiness({...base,totals:partial});assert.ok(rp.period.partial);assert.equal(rp.previous.method,'media_diaria');assert.ok(rp.limitations.some(l=>/parcial/i.test(l)));
const odd=[T('02','2026-08-10','2026-08-20','A','A','X',1,10),T('02','2026-09-01','2026-09-30','A','A','X',1,10)];assert.equal(RD.readiness({...base,totals:odd}).previous,null,'períodos de duração diferente não são comparados');
const overlap=[...totals,T('02','2026-09-15','2026-09-30','1 CC0006','JEANS RETO','CALÇAS',99,99000,'01 - 38','3    - CHUMBO')];const ro=RD.readiness({...base,totals:overlap,period:'2026-09-01|2026-09-30'});assert.ok(ro.overlaps.length>0);
const {insights:io}=I.computeInsights({...base,totals:overlap,period:'2026-09-01|2026-09-30'}),net=io.find(f=>f.id==='desempenho:rede:2026-09-01|2026-09-30');assert.match(net.fact,/R\$ 54 mil/,'sobreposição não soma o outro período');
// ---- Insights: contract, facts vs hypotheses, stock absent vs zero, new products, performance explained.
const {insights}=I.computeInsights(base);
for(const f of insights){assert.ok(f.id&&f.kind&&f.title&&f.suggestion&&f.scope&&Array.isArray(f.hypotheses)&&Array.isArray(f.limitations)&&f.quality&&f.fingerprint,f.id);assert.equal(f.impact,null,'sem impacto financeiro estimado');for(const hy of f.hypotheses){assert.ok(hy.validateWith.length,`${f.id}: hipótese diz o que validar`);assert.ok(!f.fact||!f.fact.includes(hy.text),'hipótese nunca vira fato')}}
assert.equal(new Set(insights.map(f=>f.id)).size,insights.length);
const jk=insights.find(f=>f.id==='desempenho:02:2026-09-01|2026-09-30');assert.ok(jk,'queda relevante da JK');assert.match(jk.fact,/R\$ 35 mil → R\$ 27 mil/);assert.ok(jk.evidence.some(e=>/JEANS RETO/.test(e)));assert.ok(jk.hypotheses.some(x=>/falta de estoque/i.test(x.text)&&/JEANS RETO/.test(x.support)),'hipótese de estoque sustentada pelo saldo');
const fall=insights.find(f=>f.id==='ranking:queda:1 CC0006:2026-09-01|2026-09-30');assert.ok(fall&&fall.hypotheses[0].support,'queda ligada a falta de estoque como hipótese');
const top=insights.find(f=>f.kind==='ranking'&&f.id.startsWith('ranking:top'));assert.ok(top.evidence.some(e=>/2 modelos novos.*VESTIDO NOVO/.test(e)),'produto novo com pouco histórico (referência nova, mesmo com nome repetido)');assert.ok(!insights.some(f=>f.kind==='realocar'&&f.reference==='7 TR0001'),'realocação e falta do mesmo item viram um card');
const trench=insights.find(f=>f.kind==='ruptura'&&f.reference==='7 TR0001');assert.ok(trench,'Ecomm vende e JK tem saldo');assert.equal(trench.stockInformed,false,'sem linha no estoque do Ecomm = não informado');assert.equal(trench.metrics[1].value,'não consta');assert.ok(trench.limitations.some(l=>/não consta/.test(l)));assert.ok(trench.missing.includes('Reservas'));
const jeans=insights.find(f=>f.kind==='reposicao'&&f.reference==='1 CC0006');assert.equal(jeans.stockInformed,true,'linha com saldo 0 = zero informado');assert.equal(jeans.metrics[1].value,'0');
assert.ok(!insights.some(f=>f.kind==='ruptura'&&f.reference==='1 CC0006'),'transferência e reposição não contam a mesma falta duas vezes');
const cat=insights.find(f=>f.id.startsWith('mix:CALÇAS'));assert.ok(cat&&/perdeu/.test(cat.title)&&cat.evidence.some(e=>/JEANS RETO/.test(e)),'categoria e modelo que explicam');
// Stale stock limits conclusions instead of blocking.
const old=I.computeInsights({...base,today:'2026-11-15'}).insights.find(f=>f.kind==='reposicao'&&f.reference==='1 CC0006');assert.equal(old.quality.level,'parcial');assert.ok(old.limitations.some(l=>/dias/.test(l)));
// ---- Invalidation and follow-up: a new position resolves the stock-out; numbers changing change the fingerprint.
const snap=I.snapshotOf(insights),after=I.computeInsights({...base,stock:[...stock,S('02','2026-10-01','1 CC0006','JEANS RETO','3 -CHUMBO','38',9),S('02','2026-10-01','2 CM0001','CAMISA AGNES','OFF','P',30),S('02','2026-10-01','7 TR0001','TRENCH VITOR','CINZA','M',12)]}).insights;
const d=I.diffInsights(snap,after);assert.ok(d.resolvidos.some(s=>s.id===jeans.id),'reposição some com a nova posição');assert.deepEqual(I.observe([...stock,S('02','2026-10-01','1 CC0006','JEANS RETO','3 -CHUMBO','38',9)],'02','1 cc0006'),{value:9,date:'2026-10-01'});assert.deepEqual(I.observe(stock,'03','1 CC0006'),{value:null,date:'2026-09-30'},'não informado ≠ zero');
const approved=I.computeInsights({...base,saved:[{dataset:'real',status:'approved',payload:JSON.stringify({id:jeans.id,to:'02'})}]}).insights.find(f=>f.id===jeans.id);assert.equal(approved.priority,'baixa');assert.ok(approved.priorityReasons.some(r=>/em andamento/.test(r)));
// ---- Analyst: intent, scope, default period declared, AI failure keeps the answer.
const q=A.answerQuestion({...base,question:'O que explica a queda de vendas da JK?'}).answer;assert.equal(q.intent,'desempenho');assert.deepEqual(q.scope.stores,['02']);assert.equal(q.scope.periodSource,'padrao');assert.match(q.headline,/JK/);assert.ok(q.hypotheses.length&&q.facts.every(f=>!q.hypotheses.some(x=>f.includes(x.text))));
const m=A.answerQuestion({...base,question:'Dentro de calças, quais modelos perderam participação?'}).answer;assert.equal(m.intent,'mix');assert.equal(m.scope.category,'CALÇAS');assert.ok(m.evidence.some(e=>e.id.startsWith('mix:CALÇAS')));
assert.equal(A.parseQuestion('Quais cores e tamanhos merecem atenção?',{stores,categories:[],periods:[]}).intent,'grade');assert.equal(A.parseQuestion('O que devemos avaliar para transferir entre RJ e JK?',{stores,categories:[],periods:[]}).intent,'transferencia');assert.deepEqual(A.parseQuestion('transferir entre RJ e JK',{stores,categories:[],periods:[]}).stores.sort(),['02','05']);
assert.equal(A.parseQuestion('vendas de agosto',{stores,categories:[],periods:[{start:AUG[0],end:AUG[1]},{start:SEP[0],end:SEP[1]}]}).period,'2026-08-01|2026-08-31');
const ap=A.answerQuestion({...base,question:'Como as apostas da coleção estão performando?'}).answer;assert.match(ap.headline,/não há apostas/i);assert.ok(ap.limitations.some(l=>/indisponível/.test(l)));
const ch=A.answerQuestion({...base,question:'O que mudou desde o último relatório?',previous:{snapshot:snap,title:'Consolidado',createdAt:'2026-09-30T12:00:00Z'},stock:[...stock,S('02','2026-10-01','1 CC0006','JEANS RETO','3 -CHUMBO','38',9)]}).answer;assert.match(ch.headline,/não aparecem mais/);
const failed=await A.ask({...base,question:'prioridades'},async()=>{throw new Error('Provedor temporariamente indisponível.')});assert.ok(failed.answer.headline&&failed.aiError,'falha do provedor mantém a resposta determinística');
const ok=await A.ask({...base,question:'O que explica a queda de vendas da JK?'},async ctx=>{assert.ok(!/sb_secret|service_role|DATABASE_URL/i.test(ctx));return {text:'JK caiu de R$ 35 mil para R$ 27 mil; queda de 99,9% e 12.345 peças.',provider:'t',model:'m'}});assert.deepEqual(ok.ai.unverified,['99,9','12.345'],'números fora do contexto são sinalizados');
// ---- Access: restricted user only sees own units, even in network totals and evidence.
assert.deepEqual(AC.storeAccess('Ana@x.com',false,'ana@x.com=02,03;bob@y.com=BC'),['02','03']);assert.equal(AC.storeAccess('ana@x.com',true,'ana@x.com=02'),null,'administrador vê tudo');assert.equal(AC.storeAccess('zoe@x.com',false,'ana@x.com=02'),null,'sem regra = acesso completo');
const restricted=A.answerQuestion({...base,question:'Quais são as prioridades? E a BC?',allowedStores:['02']});assert.ok(restricted.insights.every(f=>[f.store,f.from,f.to].filter(x=>x&&x!=='all').every(x=>x==='02')),'nenhum achado de outra unidade');assert.ok(restricted.answer.limitations.some(l=>/Sem acesso aos dados de: BC/.test(l)));
const rnet=A.answerQuestion({...base,question:'vendas',allowedStores:['02']}).insights.find(f=>f.id.startsWith('desempenho:rede'));assert.ok(!rnet||!/BC|Ecomm/.test(JSON.stringify(rnet)),'total da rede só com unidades permitidas');
const rd2=AC.restrictData({totals,stock,sales:[],goals:[{store:'BC'}]},['02']);assert.ok(rd2.totals.every(t=>t.store==='02')&&rd2.stock.every(s=>s.store==='02')&&!rd2.goals.length);
assert.equal(AC.actionAllowed(JSON.stringify({store:'all'}),['02']),false);assert.equal(AC.actionAllowed(JSON.stringify({store:'02',from:'BC',to:'02'}),['02']),false);assert.equal(AC.actionAllowed(JSON.stringify({store:'02'}),['02']),true);
// ---- Config validation
assert.throws(()=>I.validateInsightConfig({dropPct:-1}));assert.equal(I.validateInsightConfig({dropPct:15}).dropPct,15);assert.throws(()=>ID.validateTables([1]));
await h.cleanup();console.log(`Passed: ${insights.length} insights sintéticos com fato/hipótese/limite, métricas com denominador zero e base pequena, variantes entre fontes, homônimos, sobreposição sem dupla contagem, período parcial, estoque ausente ≠ zero, invalidação, analista, falha da IA e isolamento por unidade.`);
