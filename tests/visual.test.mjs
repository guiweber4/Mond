// Visual overview data, color swatches and the executive deck on synthetic data (no fixtures, no network).
// Usage: node tests/visual.test.mjs
import assert from 'node:assert/strict';
import {setup} from './harness.mjs';
const h=await setup('visual');
const {defaultStores}=await h.load('model'),{totalId}=await h.load('totals'),O=await h.load('overview-data'),C=await h.load('color-swatch'),D=await h.load('executive-deck');
const T=(store,reference,description,category,qty,amount,size,color)=>({id:totalId(store,'2026-09-01','2026-09-30',reference,size,color),store,start:'2026-09-01',end:'2026-09-30',reference,description,category,qty,amount,average:null,size,color});
const S=(store,reference,model,color,size,physical)=>({id:`2026-09-30:${store}:${reference}|${color}|${size}`,date:'2026-09-30',store,sku:`p:${reference}:${size}:${color}`,reference,model,color,size,physical,reserved:0,incoming:0,sourceFormat:'presence-stock',sourceBalances:[physical]});
// Fictitious values, only for this test.
const totals=[T('02','1 CC0006','JEANS RETO','CALÇAS',6,6000,'01 - 38','3    - CHUMBO'),T('02','1 CC0006','JEANS RETO','CALÇAS',2,2000,'01 - 40','3    - CHUMBO'),T('02','2 CM0001','CAMISA AGNES','CAMISAS',10,15000,'P','OFF WHITE'),T('02','2 CM0001','CAMISA AGNES','CAMISAS',-1,-1500,'M','OFF WHITE'),
 T('BC','5 CM0001','CAMISA AGNES','CAMISAS',8,12000,'P','OFF WHITE'),T('03','7 TR0001','TRENCH VITOR','CASACOS',5,15000,'M','CINZA'),T('03','8 AC0001','BONÉ','ACESSÓRIOS',9,900,'UNI','XYZQWE')];
const stock=[S('02','1 CC0006','JEANS RETO','3 -CHUMBO','38',0),S('02','1 CC0006','JEANS RETO','3 -CHUMBO','40',0),S('02','2 CM0001','CAMISA AGNES','OFF WHITE','P',30),S('02','7 TR0001','TRENCH VITOR','CINZA','M',12),S('BC','5 CM0001','CAMISA AGNES','OFF WHITE','P',2),S('03','9 XX0001','OUTRO','PRETO','M',-3)];
// ---- Swatches: presentation only, unknown stays neutral.
assert.deepEqual(C.swatch('3    - CHUMBO'),{label:'CHUMBO',hex:'#4a4d52'});assert.equal(C.swatch('OFF WHITE').hex,'#efe9dc');assert.equal(C.swatch('AZUL MARINHO').hex,'#1f2f52','frase mais longa vence');
assert.deepEqual(C.swatch('XYZQWE'),{label:'XYZQWE',hex:null},'cor desconhecida não é chutada');assert.equal(C.swatch('ESTAMPADO FLORAL').pattern,'print');
// ---- Overview: everything reconciles with the consolidated total.
const o=O.overviewData({totals,stock,stores:defaultStores});const total=totals.reduce((s,t)=>s+t.amount,0);
assert.equal(o.amount,total);assert.equal(o.units,totals.reduce((s,t)=>s+t.qty,0));
assert.equal(Math.round(o.unitsData.reduce((s,u)=>s+u.amount,0)*100)/100,total,'unidades somam o consolidado');assert.ok(o.unitsData.find(u=>u.id==='05').hasData===false&&o.missing.includes('RJ · Shopping Leblon'),'RJ sem arquivo');
assert.equal(Math.round(o.categories.reduce((s,c)=>s+c.amount,0)*100)/100,total,'categorias somam o consolidado');
const sum=k=>Math.round(o.sizeCurve.reduce((s,x)=>s+x[k],0));assert.ok(Math.abs(sum('sold')-100)<=1&&Math.abs(sum('stock')-100)<=1,'curva de tamanhos soma 100%');assert.ok(o.sizeCurve.every(x=>['letra','numero','outro'].includes(x.group)));
assert.equal(o.highlights[0].reference,'7 TR0001','maior valor primeiro');assert.equal(o.highlights[1].reference,'2 CM0001','devolução reduz o valor do modelo');assert.ok(o.highlights.some(x=>x.reference==='5 CM0001'),'homônimo separado');
const jeans=o.highlights.find(x=>x.reference==='1 CC0006');assert.equal(jeans.stores.find(s=>s.id==='02').state,'sem_saldo','linha com 0 = sem saldo');assert.deepEqual(jeans.sizes.map(z=>z.label),['38','40']);assert.deepEqual(jeans.colors,[{label:'CHUMBO',qty:8}]);
const trench=o.highlights.find(x=>x.reference==='7 TR0001');assert.equal(trench.stores.find(s=>s.id==='03').state,'nao_consta','sem linha = não consta');assert.equal(trench.stores.find(s=>s.id==='02').balance,12);
const camisa=o.highlights.find(x=>x.reference==='5 CM0001');assert.equal(camisa.stores.find(s=>s.id==='BC').state,'baixo','STR ≥ limite do motor = pouco saldo');
{const ec=o.stockHealth.find(s=>s.id==='03');assert.equal(ec.zero,1,'saldo −3 conta como zerado');assert.equal(ec.balance,0,'negativo não reduz o saldo')}assert.equal(o.priceBands.reduce((s,b)=>s+b.models,0),o.highlights.length,'cada modelo em uma faixa');
assert.equal(O.overviewData({totals:[],stock,stores:defaultStores}),null);
// ---- Executive deck: computed slides, AI text merged per id with fallback and number check.
const deck=D.buildDeck({totals,stock,stores:defaultStores,today:'2026-10-01'});assert.equal(deck.slides.length,8);assert.equal(new Set(deck.slides.map(s=>s.id)).size,8,'ids únicos');
assert.equal(deck.slides[0].data.kpis[0].value,'R$ 49 mil');assert.ok(deck.slides.find(s=>s.id==='unidades').data.bars.some(b=>b.label==='RJ'&&b.muted),'unidade sem arquivo aparece apagada');
assert.ok(deck.slides.find(s=>s.id==='limites').bullets.length>0);assert.ok(deck.slides.every(s=>s.title&&s.source&&s.kicker));
const ctx=D.deckContext(deck);assert.ok(!/sb_secret|service_role|DATABASE_URL/i.test(ctx));
const merged=D.mergeDeckText(deck,`## [unidades] JK concentra as vendas
- JK vendeu R$ 21 mil no período
> Nota: RJ sem arquivo
## [capa] Setembro fechou com R$ 999 mil
- Alta de 45% sobre agosto
## [xyz] Ignorado
- nada
## [categorias] ${'x'.repeat(200)}`,ctx);
const u=merged.slides.find(s=>s.id==='unidades');assert.equal(u.ai.title,'JK concentra as vendas');assert.equal(u.ai.note,'RJ sem arquivo');assert.deepEqual(u.ai.unverified,[],'R$ 21 mil confere com R$ 21.500');
assert.deepEqual(merged.slides.find(s=>s.id==='capa').ai.unverified,['999 mil','45'],'números fora dos dados sinalizados');
assert.equal(merged.slides.find(s=>s.id==='categorias').ai,undefined,'título longo demais mantém o texto calculado');assert.equal(merged.slides.find(s=>s.id==='estoque').ai,undefined,'slide sem texto da IA mantém o calculado');
assert.equal(merged.slides.find(s=>s.id==='unidades').data.bars.length,deck.slides.find(s=>s.id==='unidades').data.bars.length,'IA nunca altera os dados do slide');
// Old presentations (bullets only) still open.
const legacy=D.toSlides(undefined,[{title:'Visão geral',bullets:['R$ 2,27 mi'],note:''}]);assert.equal(legacy.length,1);assert.equal(legacy[0].layout,'list');assert.equal(D.toSlides(deck).length,8);
await h.cleanup();console.log(`Passed: Visão geral concilia unidades, categorias e curva de tamanhos (100%); destaques por referência com saldo sem/pouco/não consta; cores desconhecidas neutras; apresentação com ${deck.slides.length} slides calculados, texto da IA por slide com fallback e números conferidos; apresentações antigas abrem.`);
