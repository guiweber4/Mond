/**
 * Purchase rationale (network level, split by unit). Deterministic and explicit:
 *   sales rate  = pieces sold ÷ days, per variant (reference × color × size), over the latest equivalent periods (max 3)
 *   need        = ceil(rate × (lead + coverage + safety)) − network stock − open purchase orders
 * Stock is the latest position per unit with negative balances read as zero (latestStock). Observed sales are not
 * demand: stock-outs hide sales, so every suggestion carries that limitation. No cost exists in the files, so value
 * is estimated at the average selling price, never presented as a purchase budget.
 */
import type {Total} from './totals';
import type {Stock,Store} from './model';
import type {OpsConfig,Purchase} from './operations';
import {defaultOps} from './operations';
import {latestStock,type Priority} from './findings';
import {periodsOf,comparablePeriod,br} from './readiness';
import {canonicalize,colorKey,sizeKey,type IdentityTables} from './identity';
import {sizeOrder,colorOrder} from './catalog';
import {sellThrough} from './metrics';
import {fingerprint,type SavedAction} from './insights';
export type PurchaseParams={leadDays:number;targetDays:number;safetyDays:number;minQty:number};
export const purchaseParams=(ops?:Partial<OpsConfig>):PurchaseParams=>({leadDays:ops?.leadDays??defaultOps.leadDays,targetDays:ops?.targetDays??defaultOps.targetDays,safetyDays:ops?.safetyDays??defaultOps.safetyDays,minQty:ops?.purchaseMinQty??2});
export type Line={color:string;size:string;sold:number;rate:number;stock:number;open:number;coverage:number|null;qty:number;split:{store:string;short:string;qty:number}[]};
export type Suggestion={id:string;reference:string;model:string;category:string;abc:'A'|'B'|'C';urgency:Priority;sold:number;amount:number;price:number|null;stock:number;coverage:number|null;str:number|null;qty:number;value:number|null;lines:Line[];split:{store:string;short:string;qty:number}[];reasons:string[];status:'pending'|'approved'|'done';fingerprint:string};
export type Avoid={reference:string;model:string;category:string;stock:number;sold:number;coverage:number|null;reason:string};
export type PurchaseInput={totals:Total[];stock:Stock[];stores:Store[];ops?:Partial<OpsConfig>;purchases?:Purchase[];saved?:SavedAction[];period?:string;tables?:IdentityTables};
const rk=(x:number)=>Math.round(x*100)/100;
const short=(stores:Store[],id:string)=>(stores.find(s=>s.id===id)?.name||id).split(' · ')[0];
/** Largest remainder: integer parts that add up exactly to `total`. */
export function splitInt(total:number,weights:number[]){const sum=weights.reduce((a,b)=>a+b,0);if(total<=0||!weights.length)return weights.map(()=>0);const w=sum>0?weights:weights.map(()=>1),ws=w.reduce((a,b)=>a+b,0),raw=w.map(x=>x/ws*total),out=raw.map(Math.floor);let rest=total-out.reduce((a,b)=>a+b,0);const order=raw.map((x,i)=>[x-Math.floor(x),i]).sort((a,b)=>b[0]-a[0]);for(const [,i] of order){if(rest<=0)break;out[i]++;rest--}return out}
export function purchasePlan(i:PurchaseInput){
 const p=purchaseParams(i.ops),horizon=p.leadDays+p.targetDays+p.safetyDays,open=i.stores.filter(s=>s.status==='open');
 const {totals,stock:stockAll}=canonicalize(i.totals,i.stock,i.tables);const periods=periodsOf(totals);if(!periods.length)return null;
 // Latest period plus up to two previous equivalent ones (chain of comparable periods).
 const cur=(i.period&&periods.find(x=>`${x.start}|${x.end}`===i.period))||periods.at(-1)!,used=[cur];
 while(used.length<3){const prev=comparablePeriod(periods,used.at(-1)!,i.stores);if(!prev)break;const pp=periods.find(x=>x.start===prev.start&&x.end===prev.end);if(!pp||used.includes(pp))break;used.push(pp)}
 const days=used.reduce((a,x)=>a+x.days,0),inPeriods=(t:Total)=>used.some(x=>x.start===t.start&&x.end===t.end)&&open.some(s=>s.id===t.store);
 const stock=latestStock(stockAll).filter(r=>open.some(s=>s.id===r.store)),stockUnits=new Set(stock.map(r=>r.store));
 // Sales per variant (network and unit) and per model.
 type V={ref:string;color:string;size:string;sold:number;byStore:Map<string,number>};const vars=new Map<string,V>();
 type M={ref:string;model:string;category:string;sold:number;amount:number};const models=new Map<string,M>();
 for(const t of totals.filter(inPeriods)){const ref=t.reference,m=models.get(ref)||{ref,model:t.description,category:t.category,sold:0,amount:0};m.sold+=t.qty;m.amount=rk(m.amount+t.amount);models.set(ref,m);
  const k=`${ref}|${colorKey(t.color)}|${sizeKey(t.size)}`,v=vars.get(k)||{ref,color:colorKey(t.color),size:sizeKey(t.size),sold:0,byStore:new Map()};v.sold+=t.qty;v.byStore.set(t.store,(v.byStore.get(t.store)||0)+t.qty);vars.set(k,v)}
 // Stock per variant (network and unit) and per model; open orders matched by the stock SKU of the variant.
 const vStock=new Map<string,number>(),vStoreStock=new Map<string,number>(),mStock=new Map<string,number>(),skuOf=new Map<string,string>();
 for(const r of stock){const ref=r.reference||r.sku,k=`${ref}|${colorKey(r.color)}|${sizeKey(r.size)}`;vStock.set(k,(vStock.get(k)||0)+r.physical);vStoreStock.set(`${r.store}|${k}`,(vStoreStock.get(`${r.store}|${k}`)||0)+r.physical);mStock.set(ref,(mStock.get(ref)||0)+r.physical);skuOf.set(r.sku,k)}
 const openOrders=new Map<string,number>();for(const o of i.purchases||[]){if(o.status!=='open'||o.qty<=o.received)continue;const k=skuOf.get(o.sku);if(k)openOrders.set(k,(openOrders.get(k)||0)+o.qty-o.received)}
 // ABC by model value in the period.
 const ranked=[...models.values()].filter(m=>m.amount>0).sort((a,b)=>b.amount-a.amount),totalAmount=ranked.reduce((a,m)=>a+m.amount,0),abc=new Map<string,'A'|'B'|'C'>();let acc=0;for(const m of ranked){const before=acc;acc+=m.amount;abc.set(m.ref,before/totalAmount<0.8?'A':before/totalAmount<0.95?'B':'C')}
 const saved=new Map((i.saved||[]).filter(s=>s.dataset==='real').map(s=>{try{const x=JSON.parse(s.payload);return [x.id as string,{status:s.status,fp:x.fingerprint as string|undefined}]}catch{return ['',{status:'',fp:undefined}]}}));
 const periodKey=`${used[0].start}|${used[0].end}`,suggestions:Suggestion[]=[],dismissed:Suggestion[]=[];
 for(const m of models.values()){if(m.sold<p.minQty)continue;
  const lines:Line[]=[...vars.values()].filter(v=>v.ref===m.ref&&v.sold>0).map(v=>{const k=`${v.ref}|${v.color}|${v.size}`,rate=v.sold/days,st=vStock.get(k)??0,oo=openOrders.get(k)||0,qty=Math.max(0,Math.ceil(rate*horizon-st-oo));
   // Split by each unit's own gap for coverage + safety (stock arrives centrally, then is distributed).
   const units=[...new Set([...v.byStore.keys()])].filter(s=>open.some(o=>o.id===s)),gaps=units.map(s=>Math.max(0,(v.byStore.get(s)||0)/days*(p.targetDays+p.safetyDays)-(vStoreStock.get(`${s}|${k}`)??0))),weights=gaps.some(g=>g>0)?gaps:units.map(s=>v.byStore.get(s)||0),parts=splitInt(qty,weights);
   return {color:v.color,size:v.size,sold:v.sold,rate:rk(rate),stock:st,open:oo,coverage:rate>0?Math.round(st/rate):null,qty,split:units.map((s,j)=>({store:s,short:short(i.stores,s),qty:parts[j]})).filter(x=>x.qty>0)}}).sort((a,b)=>colorOrder(a.color,b.color)||sizeOrder(a.size,b.size));
  const qty=lines.reduce((a,l)=>a+l.qty,0);if(!qty)continue;
  const rate=m.sold/days,st=mStock.get(m.ref)??0,coverage=rate>0?Math.round(st/rate):null,price=m.sold>0&&m.amount>0?rk(m.amount/m.sold):null;
  // Urgency: no stock or runs out before the supplier delivers → alta; a sold variant without stock or short safety → média.
  const out=lines.some(l=>l.stock<=0&&l.qty>0),urgency:Priority=st<=0||coverage!==null&&coverage<p.leadDays?'alta':out||coverage!==null&&coverage<p.leadDays+p.safetyDays?'media':'baixa';
  const reasons=[`Vendeu ${m.sold} peças em ${days} dias (${rk(rate*30)} por mês, média do período).`,st<=0?'Sem saldo na rede.':`Saldo na rede: ${st} peças, ${coverage===null?'—':`${coverage} dias`} de cobertura no ritmo atual.`,out?`${lines.filter(l=>l.stock<=0&&l.qty>0).length} variações vendidas estão sem saldo na rede.`:'',coverage!==null&&coverage<p.leadDays?`Acaba antes do prazo de entrega (${p.leadDays} dias).`:''].filter(Boolean);
  const id=`compra:${m.ref}:${periodKey}`,fp=fingerprint([qty,st,m.sold]),s=saved.get(id);
  const split=[...lines.flatMap(l=>l.split).reduce((acc2,x)=>acc2.set(x.store,{store:x.store,short:x.short,qty:(acc2.get(x.store)?.qty||0)+x.qty}),new Map<string,{store:string;short:string;qty:number}>()).values()].sort((a,b)=>b.qty-a.qty);
  const sug:Suggestion={id,reference:m.ref,model:m.model,category:m.category,abc:abc.get(m.ref)||'C',urgency,sold:m.sold,amount:m.amount,price,stock:st,coverage,str:sellThrough(m.sold,st),qty,value:price===null?null:rk(price*qty),lines,split,reasons,status:s?.status==='approved'?'approved':s?.status==='done'?'done':'pending',fingerprint:fp};
  // "Não repor" holds until the numbers behind it change.
  if(s?.status==='dismissed'&&s.fp===fp)dismissed.push(sug);else suggestions.push(sug)}
 const rank={alta:0,media:1,baixa:2},abcR={A:0,B:1,C:2};suggestions.sort((a,b)=>rank[a.urgency]-rank[b.urgency]||abcR[a.abc]-abcR[b.abc]||b.amount-a.amount);
 // Do not rebuy now: long coverage, or high stock with little sell-through, or stock without sales in the period.
 const sold=new Map([...models.values()].map(m=>[m.ref,m]));const avoid:Avoid[]=[];
 for(const [ref,st] of mStock){if(st<=0)continue;const m=sold.get(ref),rate=m?m.sold/days:0,cov=rate>0?Math.round(st/rate):null,model=m?.model||stock.find(r=>(r.reference||r.sku)===ref)?.model||ref,category=m?.category||'';
  if(!m||m.sold<=0){if(st>=10)avoid.push({reference:ref,model,category,stock:st,sold:0,coverage:null,reason:'Sem venda no período com saldo na rede.'});continue}
  if(cov!==null&&cov>2*horizon)avoid.push({reference:ref,model,category,stock:st,sold:m.sold,coverage:cov,reason:`Cobertura de ${cov} dias, mais que o dobro do horizonte (${horizon}).`})}
 avoid.sort((a,b)=>b.stock-a.stock);
 const byCat=new Map<string,number>();for(const s of suggestions)byCat.set(s.category,(byCat.get(s.category)||0)+s.qty);
 const missingStock=open.filter(s=>!stockUnits.has(s.id)&&totals.some(t=>t.store===s.id&&inPeriods(t)));
 const limitations=[`Ritmo = venda média de ${used.length===1?`um período (${br(used[0].start)} a ${br(used[0].end)})`:`${used.length} períodos (${days} dias)`}; venda observada não é demanda: faltas no período escondem procura.`,
  used.length===1?'Um único período: sem sazonalidade nem tendência. Importe meses anteriores para uma média mais estável.':'',
  'Sem custo nos arquivos: valor estimado a preço médio de venda, não é orçamento de compra.',
  (i.purchases||[]).length?'':'Sem pedidos de compra importados: nada em aberto foi descontado.',
  'Continuidade do modelo na coleção não é informada: use "Não repor" para modelos que saíram de linha.',
  'Saldo negativo conta como zero (venda antes do lançamento da entrada).',
  missingStock.length?`Sem posição de estoque de ${missingStock.map(s=>s.name).join(', ')}: a necessidade pode estar superestimada.`:''].filter(Boolean);
 return {period:periodKey,periodLabel:`${br(used[0].start)} a ${br(used[0].end)}`,days,periodsUsed:used.length,params:p,horizon,method:`Pedido = venda por dia × ${horizon} dias (entrega ${p.leadDays} + cobertura ${p.targetDays} + segurança ${p.safetyDays}) − saldo da rede${(i.purchases||[]).length?' − pedidos em aberto':''}.`,
  summary:{pieces:suggestions.reduce((a,s)=>a+s.qty,0),models:suggestions.length,variants:suggestions.reduce((a,s)=>a+s.lines.filter(l=>l.qty>0).length,0),value:rk(suggestions.reduce((a,s)=>a+(s.value||0),0)),alta:suggestions.filter(s=>s.urgency==='alta').length,media:suggestions.filter(s=>s.urgency==='media').length,baixa:suggestions.filter(s=>s.urgency==='baixa').length,byCategory:[...byCat].map(([name,qty])=>({name,qty})).sort((a,b)=>b.qty-a.qty)},
  suggestions,dismissed,avoid:avoid.slice(0,20),limitations};
}
export type PurchasePlan=NonNullable<ReturnType<typeof purchasePlan>>;
/** Flat rows for the supplier spreadsheet. */
export function purchaseRows(plan:PurchasePlan){return plan.suggestions.flatMap(s=>s.lines.filter(l=>l.qty>0).map(l=>({Urgencia:s.urgency==='alta'?'Alta':s.urgency==='media'?'Média':'Baixa',Curva:s.abc,Categoria:s.category,Referencia:s.reference,Modelo:s.model,Cor:l.color,Tamanho:l.size,Pedir:l.qty,VendeuNoPeriodo:l.sold,SaldoRede:l.stock,PedidosEmAberto:l.open,CoberturaDias:l.coverage??'',Divisao:l.split.map(x=>`${x.short} ${x.qty}`).join(' · '),PrecoMedioVenda:s.price??''})))}
