import type {Total} from './totals';
import type {Purchase,Control} from './operations';
export type Store={id:string;name:string;type:'store'|'online';status:'open'|'planned'|'inactive';opened:string;target:number};
export type Sale={id:string;order:string;date:string;store:string;sku:string;qty:number;amount:number;discount:number;status:'sale'|'return'|'cancelled'};
export type Product={sku:string;model:string;category:string;color:string;size:string;cost:number|null;collection:string};
/** `reported` keeps the Presence value when a negative balance is analysed as zero (sale before the entry was posted). */
export type Stock={reported?:number;reference?:string;model?:string;color?:string;size?:string;sourceFormat?:'presence-stock';sourceBalances?:number[];id:string;date:string;store:string;sku:string;physical:number;reserved:number;incoming:number};
/** Business rule: a negative balance means the piece was sold before its entry was posted; the team posts it later
 * and it returns to zero. Every analysis reads it as zero, per variant, before any sum. Imported data stays as received. */
export const asEffective=<T extends {physical:number;reported?:number}>(s:T):T=>s.physical<0?{...s,physical:0,reported:s.physical}:s;
export type Goal={id:string;store:string;month:string;amount:number};
export type Data={sales:Sale[];products:Product[];stock:Stock[];goals:Goal[];purchases?:Purchase[];controls?:Control[];totals?:Total[]};
export type Action={id:string;title:string;detail:string;priority:'high'|'medium';type:'transfer'|'replenish'|'excess';sku:string;from?:string;to?:string;qty:number};
export const defaultStores:Store[]=[{id:'02',name:'JK · Shopping JK',type:'store',status:'open',opened:'2025-01-01',target:0},{id:'05',name:'RJ · Shopping Leblon',type:'store',status:'open',opened:'2025-11-01',target:0},{id:'03',name:'Ecomm · Ecommerce',type:'online',status:'open',opened:'2025-01-01',target:0},{id:'BC',name:'BC · Bela Cintra',type:'store',status:'open',opened:'',target:0},{id:'L4',name:'Futura unidade 1',type:'store',status:'planned',opened:'',target:0},{id:'L5',name:'Futura unidade 2',type:'store',status:'planned',opened:'',target:0}];
export const emptyData:Data={sales:[],products:[],stock:[],goals:[]};
export const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n);
export const num=(n:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n);
export const pct=(n:number)=>`${num(n)}%`;
export const dayBR=(s:string)=>s?new Date(s.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
export function shift(s:string,n:number){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function demoData():Data{
 let seed=1291;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
 const models=[['Jeans Reto Mondepars','Calça jeans','Azul Pacific',859],['Calça Kai','Alfaiataria','Gris',2490],['Camisa Agnes','Camisa','Off White',1790],['Camiseta Mesa','Camiseta','Off White',389],['Regata Via','Regata','Preto',329],['Blazer Kai','Blazer','Café',3890],['Trench Vitor','Trench','Cinza',6890],['Regata Uma','Regata','Marrom',329],['Boné Washed','Acessórios','Stone',289],['Vestido Luna','Vestido','Preto',2890],['Jeans Reto 90s','Calça jeans','Ébano',849],['Camisa Dua','Camisa','Azul',1590]] as const;
 const products:Product[]=models.flatMap((m,i)=>['PP','P','M','G'].map((size,j)=>({sku:`MP${String(i+1).padStart(3,'0')}-${size}`,model:m[0],category:m[1],color:m[2],size,cost:Math.round(m[3]*.34),collection:'Essenciais 2026'})));
 const sales:Sale[]=[];
 for(let d=0;d<87;d++){const date=shift('2026-07-02',d);for(const [s,c] of [['02',39],['05',21],['03',18]] as const){const count=Math.round(c*(.7+rand()*.5)*(d>60?1.1:1));for(let n=0;n<count;n++){const weights=[0,0,0,1,1,2,3,3,4,5,6,9,10,10,11];const i=rand()<.035?7:weights[Math.floor(rand()*weights.length)];const sz=rand()<.35?1:Math.floor(rand()*4);const prod=products[i*4+sz];const qty=rand()<.12?2:1;const isReturn=rand()<.016;const price=models[i][3];sales.push({id:`${date}-${s}-${n}`,order:`${date}-${s}-${Math.floor(n/1.35)}`,date:date+'T'+String(10+Math.floor(rand()*11)).padStart(2,'0')+':00:00-03:00',store:s,sku:prod.sku,qty,amount:Math.round(price*qty*(rand()<.13?.9:1)),discount:0,status:isReturn?'return':'sale'});}}}
 const stock:Stock[]=products.flatMap((p,i)=>['02','05','03'].map((s,j)=>({id:`${s}:${p.sku}`,date:'2026-09-26',store:s,sku:p.sku,physical:i>=28&&i<36?65+Math.floor(rand()*75):((i===1&&j===0)||(i===13&&j===2)?1:12+Math.floor(rand()*33)),reserved:0,incoming:0})));
 return {sales,products,stock,goals:[{id:'02:2026-09',store:'02',month:'2026-09',amount:1800000},{id:'05:2026-09',store:'05',month:'2026-09',amount:980000},{id:'03:2026-09',store:'03',month:'2026-09',amount:760000}]};
}
export function aggregate(data:Data,stores:Store[],start:string,end:string,channel:string){
 const included=(s:string)=>channel==='all'||s===channel;
 const allowed=new Set(stores.filter(s=>s.status==='open'&&(!s.opened||s.opened<=end)).map(s=>s.id));
 const relevant=data.sales.filter(s=>included(s.store)&&allowed.has(s.store)&&s.status!=='cancelled');
 const filtered=relevant.filter(s=>s.date.slice(0,10)>=start&&s.date.slice(0,10)<=end);
 const days=Math.max(1,Math.round((Date.parse(end)-Date.parse(start))/86400000)+1), prevEnd=shift(start,-1),prevStart=shift(start,-days);
 const comparable=new Set(stores.filter(s=>allowed.has(s.id)&&s.opened&&s.opened<=prevStart).map(s=>s.id));
 const previous=relevant.filter(s=>s.date.slice(0,10)>=prevStart&&s.date.slice(0,10)<=prevEnd&&comparable.has(s.store));
 const sign=(s:Sale)=>s.status==='return'?-1:1;
 const revenue=filtered.reduce((a,s)=>a+sign(s)*s.amount,0), units=filtered.reduce((a,s)=>a+sign(s)*s.qty,0);
 const gross=filtered.filter(s=>s.status==='sale').reduce((a,s)=>a+s.amount,0);
 const returns=filtered.filter(s=>s.status==='return').reduce((a,s)=>a+s.amount,0);
 const orders=new Set(filtered.filter(s=>s.status==='sale').map(s=>s.store+':'+s.order)).size;
 const prevRevenue=previous.reduce((a,s)=>a+sign(s)*s.amount,0), compRevenue=filtered.filter(s=>comparable.has(s.store)).reduce((a,s)=>a+sign(s)*s.amount,0);
 const products=new Map(data.products.map(p=>[p.sku,p]));
 const bySku=new Map<string,{sku:string;model:string;category:string;color:string;size:string;qty:number;amount:number;cost:number|null}>();
 const series: {date:string;label:string;revenue:number;previous:number}[]=[];
 const curDay=new Map<string,number>(),preDay=new Map<string,number>();filtered.forEach(s=>curDay.set(s.date.slice(0,10),(curDay.get(s.date.slice(0,10))||0)+sign(s)*s.amount));previous.forEach(s=>preDay.set(s.date.slice(0,10),(preDay.get(s.date.slice(0,10))||0)+sign(s)*s.amount));
 for(let n=0;n<days;n++){let d=shift(start,n);series.push({date:d,label:d.slice(8)+'/'+d.slice(5,7),revenue:curDay.get(d)||0,previous:preDay.get(shift(prevStart,n))||0})}
 filtered.forEach(s=>{const p=products.get(s.sku);const row=bySku.get(s.sku)||{sku:s.sku,model:p?.model||s.sku,category:p?.category||'Sem cadastro',color:p?.color||'—',size:p?.size||'—',qty:0,amount:0,cost:p?.cost??null};row.qty+=sign(s)*s.qty;row.amount+=sign(s)*s.amount;bySku.set(s.sku,row)});
 const ranked=[...bySku.values()].sort((a,b)=>b.amount-a.amount);
 const categories=new Map<string,number>();ranked.forEach(p=>categories.set(p.category,(categories.get(p.category)||0)+p.amount));
 const channels=stores.map(s=>{const lines=filtered.filter(t=>t.store===s.id);const rev=lines.reduce((a,t)=>a+sign(t)*t.amount,0);const target=data.goals.find(g=>g.store===s.id&&g.month===end.slice(0,7))?.amount||s.target;return {...s,revenue:rev,units:lines.reduce((a,t)=>a+sign(t)*t.qty,0),target,attainment:target?rev/target*100:null}});
 const target=channels.filter(s=>s.status==='open'&&included(s.id)).reduce((a,s)=>a+s.target,0);
 const marginKnown=ranked.length>0&&ranked.every(p=>p.cost!==null);const cogs=ranked.reduce((a,p)=>a+(p.cost||0)*p.qty,0);
 return {filtered,revenue,gross,returns,units,orders,ticket:orders?gross/orders:0,pa:orders?filtered.filter(s=>s.status==='sale').reduce((a,s)=>a+s.qty,0)/orders:0,change:prevRevenue>0?(compRevenue/prevRevenue-1)*100:null,prevStart,prevEnd,series,ranked,categories:[...categories].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),channels,target,margin:marginKnown&&revenue>0?(revenue-cogs)/revenue*100:null};
}
/** A stock position older than this is flagged; imports are typically weekly. Recommendations keep their own 1-day rule. */
export const STALE_DAYS=7;
export function inventory(data:Data,stores:Store[],asOf:string,channel='all'){
 const pmap=new Map(data.products.map(p=>[p.sku,p]));
 // One latest complete snapshot per location. Missing SKUs are not treated as zero.
 const last=new Map<string,string>();data.stock.filter(s=>s.date<=asOf).forEach(s=>last.set(s.store,[last.get(s.store)||'',s.date].sort().at(-1)!));
 const start=shift(asOf,-29),vel=new Map<string,number>();data.sales.filter(s=>s.date.slice(0,10)>=start&&s.date.slice(0,10)<=asOf&&s.status==='sale').forEach(s=>vel.set(s.store+':'+s.sku,(vel.get(s.store+':'+s.sku)||0)+s.qty));
 const withSales=new Set(data.sales.map(s=>s.sku));const first=data.sales.reduce((a,s)=>s.date.slice(0,10)<a?s.date.slice(0,10):a,asOf);const observed=Math.min(30,Math.max(1,Math.round((Date.parse(asOf)-Date.parse(first))/86400000)+1));
 return data.stock.filter(s=>s.date===last.get(s.store)&&(channel==='all'||channel===s.store)).map(asEffective).map(s=>{const p=pmap.get(s.sku);const store=stores.find(t=>t.id===s.store);const available=Math.max(0,s.physical-s.reserved), sold=vel.get(s.store+':'+s.sku)||0, daily=sold/observed;const age=Math.round((Date.parse(asOf)-Date.parse(s.date))/86400000);const coverage=daily?available/daily:null;return {...s,...p,sku:s.sku,model:p?.model||s.model||s.sku,category:p?.category||'Sem cadastro',color:p?.color||s.color||'—',size:p?.size||s.size||'—',storeName:store?.name||s.store,available,sold,daily,coverage,age,observed,status:age>STALE_DAYS?'outdated':available===0?'out':coverage!==null&&coverage<7?'risk':coverage===null&&available>0?(withSales.has(s.sku)?'idle':'nohistory'):coverage!==null&&coverage>120?'excess':'ok'}});
}
export function recommendations(data:Data,stores:Store[],asOf:string):Action[]{
 const rows=inventory(data,stores,asOf).filter(r=>r.age<=1&&r.observed>=14&&stores.find(s=>s.id===r.store)?.status==='open');const used=new Map<string,number>();const actions:Action[]=[];
 rows.filter(r=>r.daily>0&&(r.coverage??0)<7).sort((a,b)=>(a.coverage||0)-(b.coverage||0)).forEach(r=>{const need=Math.max(0,Math.ceil(r.daily*21-r.available-r.incoming));if(!need)return;const donors=rows.filter(d=>d.sku===r.sku&&d.store!==r.store).map(d=>({...d,extra:Math.floor(d.available-Math.max(8,d.daily*30)-(used.get(d.id)||0))})).filter(d=>d.extra>0).sort((a,b)=>b.extra-a.extra);const d=donors[0];if(d){const qty=Math.min(need,d.extra);used.set(d.id,(used.get(d.id)||0)+qty);actions.push({id:`transfer:${asOf}:${r.store}:${r.sku}`,title:`${r.model} · ${r.size}`,detail:`${d.storeName} → ${r.storeName}. ${qty} peças. Destino com ${num(r.coverage||0)} dias de cobertura. Origem preserva 30 dias ou 8 peças. Prazo e custo logístico a validar.`,priority:'high',type:'transfer',sku:r.sku,from:d.store,to:r.store,qty})}else actions.push({id:`replenish:${asOf}:${r.store}:${r.sku}`,title:`Repor ${r.model} · ${r.size}`,detail:`${r.storeName}: ${r.available} disponíveis, ${r.sold} vendas em ${r.observed} dias. Sugestão para 21 dias de cobertura, descontando entradas previstas.`,priority:'high',type:'replenish',sku:r.sku,to:r.store,qty:need})});
 rows.filter(r=>r.status==='idle'||r.status==='excess').sort((a,b)=>b.available-a.available).slice(0,8).forEach(r=>actions.push({id:`excess:${asOf}:${r.store}:${r.sku}`,title:`Revisar ${r.model} · ${r.size}`,detail:`${r.storeName}: ${r.available} peças disponíveis, ${r.sold} vendidas em ${r.observed} dias. Avaliar exposição e alocação antes de novos pedidos.`,priority:'medium',type:'excess',sku:r.sku,from:r.store,qty:r.available}));return actions.slice(0,30);
}
