/**
 * Data layer check before any insight: which period, stock date, units, sources and history exist, whether they are
 * comparable, and which analyses the base supports. Missing data narrows conclusions instead of blocking them.
 */
import {summarizeTotals,type Total} from './totals';
import {shift,type Goal,type Stock,type Store} from './model';
import {latestStock} from './findings';
import {canonicalRef} from './identity';
export type CapabilityStatus='disponivel'|'parcial'|'indisponivel';
export type Capability={id:string;label:string;status:CapabilityStatus;reason:string;missing:string[]};
export type Period={start:string;end:string;days:number;partial:boolean;monthDays:number;stores:string[]};
export type Comparison={start:string;end:string;method:'mesma_duracao'|'mes_calendario'|'media_diaria';label:string;stores:string[]};
const days=(a:string,b:string)=>Math.round((Date.parse(b)-Date.parse(a))/86400000)+1;
const lastDay=(d:string)=>{const x=new Date(d.slice(0,7)+'-01T12:00:00Z');x.setUTCMonth(x.getUTCMonth()+1);x.setUTCDate(0);return x.toISOString().slice(0,10)};
const fullMonth=(s:string,e:string)=>s.endsWith('-01')&&e===lastDay(s);
export const br=(d:string)=>d?d.split('-').reverse().join('/'):'—';
export function periodsOf(totals:Total[]){const map=new Map<string,Set<string>>();for(const t of totals){const k=`${t.start}|${t.end}`,s=map.get(k)||new Set();s.add(t.store);map.set(k,s)}return [...map].map(([k,s])=>{const [start,end]=k.split('|');return {start,end,days:days(start,end),partial:start.slice(0,7)===end.slice(0,7)&&!fullMonth(start,end),monthDays:days(start.slice(0,7)+'-01',lastDay(start)),stores:[...s].sort()}}).sort((a,b)=>a.end.localeCompare(b.end)||a.start.localeCompare(b.start))}
/** Previous equivalent period: same length, or full calendar months, or a partial month against a full one by daily average (explicit). */
export function comparablePeriod(periods:Period[],cur:Period,stores:Store[]):Comparison|null{
 const candidates=periods.filter(p=>p.end<cur.start).reverse();
 for(const p of candidates){const method=p.days===cur.days?'mesma_duracao':fullMonth(p.start,p.end)&&fullMonth(cur.start,cur.end)?'mes_calendario':cur.partial&&fullMonth(p.start,p.end)&&cur.start.endsWith('-01')?'media_diaria':null;if(!method)continue;
  // Units must have files in both periods and be open since the start of the older one.
  const common=cur.stores.filter(s=>p.stores.includes(s)&&(()=>{const o=stores.find(x=>x.id===s)?.opened;return !o||o<=p.start})());if(!common.length)continue;
  return {start:p.start,end:p.end,method,stores:common,label:method==='media_diaria'?`média por dia (${cur.days} de ${cur.monthDays} dias contra ${p.days})`:method==='mes_calendario'?'mês calendário completo':'mesma duração'}}
 return null;
}
export function yearAgo(periods:Period[],cur:Period):Period|null{return periods.find(p=>p.start===shift(cur.start,-365)||p.start.slice(5)===cur.start.slice(5)&&p.end.slice(5)===cur.end.slice(5)&&Number(p.start.slice(0,4))===Number(cur.start.slice(0,4))-1)||null}
export type ReadinessInput={totals:Total[];stock:Stock[];stores:Store[];goals?:Goal[];sales?:number;purchases?:number;collections?:boolean;routes?:number;today:string;period?:string;staleDays?:number;types?:number};
export function readiness(i:ReadinessInput){
 const open=i.stores.filter(s=>s.status==='open'),periods=periodsOf(i.totals),stale=i.staleDays??7;
 const cur=(i.period&&periods.find(p=>`${p.start}|${p.end}`===i.period))||periods.at(-1)||null;
 const prev=cur?comparablePeriod(periods,cur,i.stores):null,yoy=cur?yearAgo(periods,cur):null;
 const stock=latestStock(i.stock).filter(s=>open.some(o=>o.id===s.store));
 const stockDates=[...new Set(stock.map(s=>s.store))].map(store=>{const date=stock.find(s=>s.store===store)!.date,age=days(date,i.today)-1;return {store,name:i.stores.find(s=>s.id===store)?.name||store,date,ageDays:age,stale:age>stale}});
 const a=cur?summarizeTotals(i.totals,i.stores,cur.start,cur.end,'all'):null;
 const salesStores=cur?cur.stores:[],stockStores=stockDates.map(s=>s.store);
 const sources=[...(a?a.channels.filter(c=>c.hasData).map(c=>({store:c.id,kind:'Totalização',file:c.sourceFile,importedAt:c.importedAt,scope:`${br(cur!.start)} a ${br(cur!.end)}`})):[]),...stockDates.map(s=>({store:s.store,kind:'Saldo Estoque',file:'',importedAt:'',scope:`posição ${br(s.date)}`}))];
 const lastUpdate=[...i.totals.map(t=>t.importedAt||'')].sort().at(-1)||'';
 // Overlapping periods of the same unit are never summed; the engine reads one period at a time.
 const overlaps:string[]=[];for(const s of open)for(const [x,p] of periods.entries())for(const q of periods.slice(x+1))if(p.stores.includes(s.id)&&q.stores.includes(s.id)&&p.start<=q.end&&q.start<=p.end)overlaps.push(`${s.name}: ${br(p.start)}–${br(p.end)} e ${br(q.start)}–${br(q.end)}`);
 // Reconciliation: consolidated = Σ units = Σ categories = Σ models, in cents.
 const cents=(n:number)=>Math.round(n*100);const rec=a?{total:a.amount,byUnits:a.channels.reduce((s,c)=>s+cents(c.amount),0)/100,byCategories:a.categories.reduce((s,c)=>s+cents(c.amount),0)/100,byModels:a.products.reduce((s,p)=>s+cents(p.amount),0)/100}:null;
 const reconciled=!rec||[rec.byUnits,rec.byCategories,rec.byModels].every(v=>cents(v)===cents(rec.total));
 // Sold variants of units with a stock file: how many have a stock line (zero included) vs no line at all.
 const stockRefs=new Set(stock.map(s=>`${s.store}|${canonicalRef(s.reference||s.sku)}`));
 let soldRefs=0,refsWithLine=0;const seen=new Set<string>();for(const t of a?.rows||[]){if(!stockStores.includes(t.store)||t.qty<=0)continue;const k=`${t.store}|${canonicalRef(t.reference)}`;if(seen.has(k))continue;seen.add(k);soldRefs++;if(stockRefs.has(k))refsWithLine++}
 const goals=(i.goals||[]).filter(g=>cur&&g.month===cur.start.slice(0,7)&&g.amount>0);
 const storeGoals=open.filter(s=>s.target>0);
 const hasGoals=goals.length>0||storeGoals.length>0;
 const limitations:string[]=[];
 if(!cur)limitations.push('Nenhuma totalização de vendas importada.');
 if(cur&&cur.partial)limitations.push(`Período parcial (${cur.days} de ${cur.monthDays} dias).`);
 if(cur&&cur.end>=i.today)limitations.push('O período vai até hoje ou depois: vendas podem estar incompletas.');
 const missSales=open.filter(s=>cur&&!salesStores.includes(s.id)),missStock=open.filter(s=>!stockStores.includes(s.id));
 if(missSales.length)limitations.push(`Sem vendas no período: ${missSales.map(s=>s.name).join(', ')} (ausência de arquivo não é venda zero).`);
 if(missStock.length)limitations.push(`Sem posição de estoque: ${missStock.map(s=>s.name).join(', ')}.`);
 for(const s of stockDates.filter(s=>s.stale))limitations.push(`Estoque de ${s.name} com ${s.ageDays} dias.`);
 const notYetOpen=i.stores.filter(s=>s.status==='open'&&s.opened&&cur&&s.opened>cur.start);for(const s of notYetOpen)limitations.push(`${s.name} abriu em ${br(s.opened)}, depois do início do período: resultado parcial.`);
 if(cur&&!prev)limitations.push('Sem período anterior equivalente importado: variações e rankings de mudança não são calculados.');
 if(soldRefs&&refsWithLine<soldRefs)limitations.push(`${soldRefs-refsWithLine} de ${soldRefs} referências vendidas não aparecem no arquivo de estoque da própria unidade (saldo não informado, diferente de zero).`);
 if(!reconciled)limitations.push('Totais por unidade, categoria e modelo não conferem com o consolidado.');
 if(overlaps.length)limitations.push('Há períodos sobrepostos para a mesma unidade; cada análise usa um único período, sem somá-los.');
 const stockAligned=cur?stockDates.filter(s=>Math.abs(days(cur.end,s.date)-1)<=stale):[];
 const cap=(id:string,label:string,status:CapabilityStatus,reason:string,missing:string[]=[]):Capability=>({id,label,status,reason,missing});
 const capabilities:Capability[]=[
  cap('desempenho','Desempenho por unidade',cur?(prev&&hasGoals?'disponivel':'parcial'):'indisponivel',!cur?'Sem totalização.':[prev?`Comparação com ${br(prev.start)}–${br(prev.end)} (${prev.label}).`:'Sem período anterior equivalente.',hasGoals?'Metas disponíveis.':'Sem metas do mês.'].join(' '),[...(prev?[]:['Totalização do período anterior equivalente']),...(hasGoals?[]:['Metas mensais por unidade']),...(yoy?[]:['Mesmo período do ano anterior'])]),
  cap('mix','Categorias e modelos',cur?(prev?'disponivel':'parcial'):'indisponivel',cur?(prev?'Participação e mudança em p.p.':'Participação atual; mudança exige período anterior.'):'Sem totalização.',[...(prev?[]:['Período anterior equivalente']),...(i.types?[]:['Tipo de produto (tabela referência → tipo)'])]),
  cap('rankings','Rankings e mudanças',cur?(prev?'disponivel':'parcial'):'indisponivel',prev?'Altas, quedas, entradas e saídas sobre o universo completo.':'Só o ranking atual.',prev?[]:['Período anterior equivalente']),
  cap('grade','Estoque e grade',cur&&stockDates.length?'parcial':'indisponivel',cur&&stockDates.length?`Cruza vendas do período com o saldo${stockAligned.length<stockDates.length?' (há posição distante do fim do período)':''}; grade esperada não cadastrada, faltas de tamanho são indícios.`:'Exige totalização e estoque.',['Grade esperada por modelo','Histórico de estoque (idade, dias em ruptura)']),
  cap('transferencias','Diferenças entre unidades',stockDates.length>1&&cur?'parcial':'indisponivel','Oportunidades para avaliar; quantidades são limite superior pela regra, não otimizadas.',['Reservas','Transferências em andamento','Entradas previstas',...(i.routes?[]:['Rotas, prazos e custos logísticos'])]),
  cap('ecommerce','E-commerce',i.stores.some(s=>s.type==='online'&&salesStores.includes(s.id)&&stockStores.includes(s.id))?'parcial':'indisponivel','Disponibilidade dos mais vendidos no estoque do e-commerce.',['Visualizações, carrinho e conversão','Produtos expostos/destacados','Qualidade de fotos e descrições']),
  cap('cobertura','Cobertura, consumo diário e projeção',i.sales?'disponivel':'indisponivel',i.sales?'Vendas por pedido importadas.':'Totalizações mensais não permitem consumo diário.',i.sales?[]:['Vendas por pedido (transacionais)']),
  cap('compras','Coleções e compras',i.purchases?'parcial':'indisponivel',i.purchases?'Pedidos de compra importados.':'Sem pedidos, recebimentos ou plano de coleção.',[...(i.purchases?[]:['Pedidos de compra e recebimentos']),'Plano de coleção / OTB',...(i.collections?[]:['Coleção por produto'])]),
  cap('apostas','Apostas da coleção','indisponivel','Nenhuma aposta comercial cadastrada.',['Cadastro de apostas por referência']),
 ];
 return {period:cur,previous:prev,yearAgo:yoy,periods,stockDates,salesStores,stockStores,sources,lastUpdate,overlaps,reconciliation:{ok:reconciled,...rec},stockMatch:{soldRefs,refsWithLine},returns:a?{negativeRows:a.negativeRows.length,adjustments:a.adjustments.length,negativeAmount:Math.round(a.negativeRows.reduce((s,r)=>s+Math.min(0,r.amount),0)*100)/100}:null,goals:hasGoals,transactional:!!i.sales,capabilities,limitations};
}
export type Readiness=ReturnType<typeof readiness>;
