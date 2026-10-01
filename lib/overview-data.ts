/**
 * Data behind the visual overview and the executive deck. Pure and deterministic: every figure comes from
 * summarizeTotals (period totals) and the latest stock snapshot, with the central metric functions.
 */
import {summarizeTotals,type Total} from './totals';
import type {Stock,Store} from './model';
import {latestPeriod,latestStock} from './findings';
import {canonSize,sizeOrder,NOT_INFORMED} from './catalog';
import {canonicalRef} from './identity';
import {colorLabel} from './color-swatch';
import {share,avgPrice,sellThrough} from './metrics';
import {defaultInsightConfig} from './insights';
export type StockState='sem_saldo'|'baixo'|'ok'|'nao_consta';
export type Highlight={reference:string;model:string;category:string;amount:number;qty:number;share:number|null;avg:number|null;colors:{label:string;qty:number}[];sizes:{label:string;qty:number}[];stores:{id:string;short:string;sold:number;balance:number|null;state:StockState}[];balance:number|null;str:number|null};
const r6=(v:number)=>Math.round(v*1e6)/1e6,r2=(v:number)=>Math.round(v*100)/100;
export const shortName=(name:string)=>name.split(' · ')[0];
const BANDS:[number,number,string][]=[[0,200,'até R$ 200'],[200,500,'R$ 200–500'],[500,1000,'R$ 500–1 mil'],[1000,2000,'R$ 1–2 mil'],[2000,Infinity,'acima de R$ 2 mil']];
/** "Baixo" uses the insights rule (STR ≥ strHigh), so the overview and the action plan never disagree. */
function state(sold:number,balance:number|null):StockState{if(balance===null)return 'nao_consta';if(balance<=0)return 'sem_saldo';const str=sellThrough(Math.max(0,sold),balance);return sold>0&&str!==null&&str>=defaultInsightConfig.strHigh?'baixo':'ok'}
export function overviewData(i:{totals:Total[];stock:Stock[];stores:Store[];channel?:string;period?:string}){
 const channel=i.channel||'all',period=i.period||latestPeriod(i.totals);if(!period)return null;
 const [start,end]=period.split('|'),a=summarizeTotals(i.totals,i.stores,start,end,channel);
 const open=new Set(i.stores.filter(s=>s.status==='open').map(s=>s.id));
 const pos=latestStock(i.stock).filter(r=>open.has(r.store)&&(channel==='all'||r.store===channel));
 const stockStores=[...new Set(pos.map(r=>r.store))],name=(id:string)=>i.stores.find(s=>s.id===id)?.name||id;
 // Balance per unit × canonical reference; a missing key means "not in the file", not zero.
 const bal=new Map<string,number>();for(const r of pos){const k=`${r.store}|${canonicalRef(r.reference||r.sku)}`;bal.set(k,r6((bal.get(k)||0)+r.physical))}
 const units=a.channels.map(c=>({id:c.id,name:c.name,short:shortName(c.name),hasData:c.hasData,amount:c.amount,qty:c.qty,share:c.hasData?share(c.amount,a.amount):null,avg:c.hasData?avgPrice(c.amount,c.qty):null}));
 const catQty=new Map<string,number>();for(const r of a.rows)catQty.set(r.category,(catQty.get(r.category)||0)+r.qty);
 const cats=a.categories.map(c=>({name:c.name||'Categoria não informada',amount:c.amount,qty:catQty.get(c.name)||0,share:share(c.amount,a.amount)}));
 const categories=cats.length>8?[...cats.slice(0,7),{name:'Outras',amount:r2(cats.slice(7).reduce((s,c)=>s+c.amount,0)),qty:cats.slice(7).reduce((s,c)=>s+c.qty,0),share:share(cats.slice(7).reduce((s,c)=>s+c.amount,0),a.amount)}]:cats;
 const highlights:Highlight[]=a.products.slice(0,8).map(p=>{const rows=a.rows.filter(r=>r.reference===p.reference),ref=canonicalRef(p.reference);
  const colors=new Map<string,number>(),sizes=new Map<string,number>();for(const r of rows){const c=colorLabel(r.color)||NOT_INFORMED,z=canonSize(r.size).label||NOT_INFORMED;colors.set(c,(colors.get(c)||0)+r.qty);sizes.set(z,(sizes.get(z)||0)+r.qty)}
  const per=stockStores.map(s=>{const sold=rows.filter(r=>r.store===s).reduce((x,r)=>x+r.qty,0),b=bal.get(`${s}|${ref}`)??null;return {id:s,short:shortName(name(s)),sold,balance:b,state:state(sold,b)}});
  const known=per.filter(s=>s.balance!==null),balance=known.length?r6(known.reduce((x,s)=>x+(s.balance as number),0)):null;
  return {reference:p.reference,model:p.description,category:p.category,amount:p.amount,qty:p.qty,share:share(p.amount,a.amount),avg:avgPrice(p.amount,p.qty),colors:[...colors].map(([label,qty])=>({label,qty})).sort((x,y)=>y.qty-x.qty),sizes:[...sizes].filter(([,q])=>q>0).map(([label,qty])=>({label,qty})).sort((x,y)=>sizeOrder(x.label,y.label)),stores:per,balance,str:balance===null?null:sellThrough(Math.max(0,p.qty),balance)}});
 // Size curve: share of pieces sold vs share of positive stock, per size label (unknown sizes left out and counted).
 const soldBy=new Map<string,number>(),stockBy=new Map<string,number>();let soldTot=0,stockTot=0;
 for(const r of a.rows){if(r.qty<=0)continue;const z=canonSize(r.size).label;if(!z)continue;soldBy.set(z,(soldBy.get(z)||0)+r.qty);soldTot+=r.qty}
 for(const r of pos){if(r.physical<=0||!Number.isInteger(r.physical))continue;const z=canonSize(r.size).label;if(!z)continue;stockBy.set(z,(stockBy.get(z)||0)+r.physical);stockTot+=r.physical}
 const group=(z:string)=>/^\d+([.,]\d+)?$/.test(z)?'numero' as const:/^(XPP|PP|P|M|G|GG|XG|\dXG)$/.test(z)?'letra' as const:'outro' as const;
 const sizeCurve=[...new Set([...soldBy.keys(),...stockBy.keys()])].map(z=>({size:z,group:group(z),sold:share(soldBy.get(z)||0,soldTot)??0,stock:share(stockBy.get(z)||0,stockTot)??0,soldQty:soldBy.get(z)||0,stockQty:stockBy.get(z)||0})).filter(x=>x.sold>=1||x.stock>=1).sort((x,y)=>sizeOrder(x.size,y.size));
 const stockHealth=stockStores.map(s=>{const rows=pos.filter(r=>r.store===s),balance=r6(rows.reduce((x,r)=>x+r.physical,0)),sold=a.rows.filter(r=>r.store===s).reduce((x,r)=>x+r.qty,0),hasSales=a.channels.some(c=>c.id===s&&c.hasData);return {id:s,name:name(s),short:shortName(name(s)),date:rows[0]?.date||'',positive:rows.filter(r=>r.physical>0).length,zero:rows.filter(r=>r.physical===0).length,balance,str:hasSales?sellThrough(Math.max(0,sold),balance):null}}).sort((x,y)=>y.balance-x.balance);
 const models=a.products.filter(p=>p.qty>0&&p.amount>0);
 const priceBands=BANDS.map(([lo,hi,label])=>{const m=models.filter(p=>{const v=p.amount/p.qty;return v>=lo&&v<hi});return {label,models:m.length,qty:m.reduce((x,p)=>x+p.qty,0),amount:r2(m.reduce((x,p)=>x+p.amount,0))}});
 const colorQty=new Map<string,{qty:number;amount:number}>();for(const r of a.rows){if(!r.color)continue;const c=colorLabel(r.color),x=colorQty.get(c)||{qty:0,amount:0};x.qty+=r.qty;x.amount=r2(x.amount+r.amount);colorQty.set(c,x)}
 const colors=[...colorQty].map(([label,v])=>({label,...v})).filter(c=>c.qty>0).sort((x,y)=>y.qty-x.qty).slice(0,10);
 return {period,start,end,amount:a.amount,units:a.units,avg:avgPrice(a.amount,a.units),models:a.products.length,unitsWithFile:a.channels.filter(c=>c.hasData).length,unitsTotal:a.channels.length,missing:a.missing.map(c=>c.name),
  stockBalance:pos.length?r6(pos.reduce((x,r)=>x+r.physical,0)):null,stockDates:stockHealth.map(s=>({short:s.short,date:s.date})),unitsData:units,categories,highlights,sizeCurve,unknownSizes:{sold:a.rows.filter(r=>r.qty>0&&!canonSize(r.size).label).reduce((x,r)=>x+r.qty,0)},stockHealth,priceBands,colors};
}
export type Overview=NonNullable<ReturnType<typeof overviewData>>;
