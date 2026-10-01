/**
 * Deterministic findings from consolidated sales (period totals) and stock snapshots. Each finding carries its
 * evidence and one suggestion. No daily demand, coverage or purchase quantity is inferred from monthly totals.
 */
import {summarizeTotals,type Total} from './totals';
import {asEffective,type Stock,type Store} from './model';
import {canonColor,canonSize,categoryIndex,resolveCategory,NO_CATEGORY} from './catalog';
import type {MetricId} from './metrics';
export type Priority='alta'|'media'|'baixa';
export type FindingKind='ruptura'|'reposicao'|'negativo'|'parado'|'realocar'|'dados'|'desempenho'|'mix'|'ranking'|'grade'|'ecommerce'|'compras';
export type Metric={label:string;value:string;tone?:'bad'|'good'};
export type Hypothesis={text:string;support?:string;validateWith:string[]};
export type Quality={level:'suficiente'|'parcial'|'insuficiente';reasons:string[]};
/** Structured insight fields (lib/insights.ts). Optional so plain findings stay valid. */
export type InsightFields={front?:string;scope?:{period?:string;compare?:string;stores:string[];category?:string;reference?:string;variant?:string};fact?:string;hypotheses?:Hypothesis[];limitations?:string[];missing?:string[];quality?:Quality;metricIds?:MetricId[];groupKey?:string;fingerprint?:string;priorityReasons?:string[];follow?:{label:string;store:string;reference:string;value:number|null;date:string};related?:string[];impact?:null;stockInformed?:boolean;weight?:number};
export type Finding={id:string;kind:FindingKind;priority:Priority;store:string;storeName:string;title:string;subtitle?:string;action?:string;metrics?:Metric[];evidence:string[];suggestion:string;reference?:string;model?:string;category?:string;from?:string;to?:string;fromName?:string;toName?:string;qty?:number}&InsightFields;
export const kindLabels:Record<FindingKind,string>={ruptura:'Falta com saldo em outra unidade',reposicao:'Falta sem saldo na rede',negativo:'Saldo negativo',parado:'Estoque sem venda',realocar:'Vende em outra unidade',dados:'Qualidade dos dados',desempenho:'Desempenho',mix:'Categorias e modelos',ranking:'Ranking e mudanças',grade:'Estoque e grade',ecommerce:'E-commerce',compras:'Compras'};
export const priorityLabels:Record<Priority,string>={alta:'Alta',media:'Média',baixa:'Baixa'};
const n=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:1});
const pcs=(v:number)=>`${n(v)} ${Math.abs(v)===1?'peça':'peças'}`;
const r6=(v:number)=>Math.round(v*1e6)/1e6;
/** Latest snapshot per unit (same rule as the stock screen); negative balances read as zero (see asEffective). */
export function latestStock(stock:Stock[]){const last=new Map<string,string>();for(const s of stock)if(!last.has(s.store)||s.date>last.get(s.store)!)last.set(s.store,s.date);return stock.filter(s=>s.date===last.get(s.store)).map(asEffective)}
export function latestPeriod(totals:Total[]){return [...new Set(totals.map(t=>`${t.start}|${t.end}`))].sort((a,b)=>a.split('|')[1].localeCompare(b.split('|')[1])||a.localeCompare(b)).at(-1)||''}
type Opts={today:string;staleDays?:number;period?:string};
export function computeFindings(totals:Total[],stockAll:Stock[],stores:Store[],opts:Opts):Finding[]{
 const out:Finding[]=[],open=stores.filter(s=>s.status==='open'),name=(id:string)=>stores.find(s=>s.id===id)?.name||id,short=(id:string)=>name(id).split(' · ')[0],period=opts.period||latestPeriod(totals),stock=latestStock(stockAll).filter(s=>open.some(o=>o.id===s.store));
 const [start,end]=period?period.split('|'):['',''],sales=period?summarizeTotals(totals,stores,start,end,'all').rows:[],idx=categoryIndex(totals);
 const salesUnits=new Set(sales.map(s=>s.store)),stockUnits=new Set(stock.map(s=>s.store));
 // Data coverage first: missing files make every other signal partial.
 for(const s of open){
  if(period&&!salesUnits.has(s.id))out.push({id:`dados:vendas:${s.id}:${period}`,kind:'dados',priority:'media',store:s.id,storeName:s.name,title:`${s.name}: sem totalização de vendas no período`,evidence:[`Período ${start.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')} importado para ${salesUnits.size} de ${open.length} unidades.`,'Ausência de arquivo não significa venda zero.'],suggestion:`Importar a Totalização por produto de ${s.name} para o mesmo período.`});
  if(!stockUnits.has(s.id))out.push({id:`dados:estoque:${s.id}`,kind:'dados',priority:'media',store:s.id,storeName:s.name,title:`${s.name}: sem posição de estoque`,evidence:['Nenhum Saldo Estoque importado para a unidade.'],suggestion:`Importar o Saldo Estoque de ${s.name} para comparar vendas e saldo.`});
 }
 const byStoreDate=new Map<string,string>();for(const s of stock)byStoreDate.set(s.store,s.date);
 for(const [store,date] of byStoreDate){const age=Math.round((Date.parse(opts.today)-Date.parse(date))/86400000);if(age>(opts.staleDays??7))out.push({id:`dados:antigo:${store}:${date}`,kind:'dados',priority:'media',store,storeName:name(store),title:`${name(store)}: posição de estoque com ${age} dias`,evidence:[`Última posição importada: ${date.split('-').reverse().join('/')}.`],suggestion:'Importar uma posição atual antes de decidir transferências ou compras.'})}
 // Balance per unit × reference and per unit × variant (canonical color/size so sales and stock match).
 type Bal={saldo:number;model:string};const refBal=new Map<string,Bal>(),varBal=new Map<string,number>();
 for(const r of stock){const ref=(r.reference||r.sku).trim(),k=`${r.store}|${ref}`,b=refBal.get(k)||{saldo:0,model:r.model||ref};b.saldo=r6(b.saldo+r.physical);refBal.set(k,b);const vk=`${r.store}|${ref}|${canonColor(r.color)}|${canonSize(r.size).label}`;varBal.set(vk,r6((varBal.get(vk)||0)+r.physical))}
 type Sold={qty:number;model:string;category:string;variants:Map<string,number>};const sold=new Map<string,Sold>();
 for(const t of sales){const ref=t.reference.trim(),k=`${t.store}|${ref}`,v=sold.get(k)||{qty:0,model:t.description,category:t.category,variants:new Map()};v.qty+=t.qty;if(t.color||t.size){const vk=`${canonColor(t.color)}|${canonSize(t.size).label}`;v.variants.set(vk,(v.variants.get(vk)||0)+t.qty)}sold.set(k,v)}
 // A donor keeps what it sold itself in the period (or half its balance when it did not sell it).
 const donorsFor=(store:string,ref:string)=>[...refBal].filter(([k,b])=>k.split('|')[1]===ref&&k.split('|')[0]!==store&&b.saldo>0).map(([k,b])=>{const own=sold.get(k)?.qty||0;return {store:k.split('|')[0],saldo:b.saldo,own,spare:Math.floor(own>0?b.saldo-own:b.saldo/2)}}).sort((a,b)=>b.spare-a.spare||b.saldo-a.saldo);
 for(const [k,v] of sold){
  const [store,ref]=k.split('|');if(v.qty<=0||!stockUnits.has(store))continue;const informed=refBal.has(k),bal=refBal.get(k)?.saldo??0;if(bal>0)continue;
  const donors=donorsFor(store,ref),hot=v.qty>=5;
  // Variants that sold here and have no balance here, with the best donor for each.
  const gaps=[...v.variants].filter(([vk,q])=>q>0&&(varBal.get(`${store}|${ref}|${vk}`)??0)<=0).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([vk,q])=>{const [c,z]=vk.split('|');const d=[...varBal].filter(([bk,s])=>{const [bs,br,bc,bz]=bk.split('|');return s>0&&br===ref&&bs!==store&&`${bc}|${bz}`===vk}).sort((a,b)=>b[1]-a[1])[0];return `${c} · ${z}: vendeu ${n(q)}${d?`; ${name(d[0].split('|')[0])} tem ${n(d[1])}`:'; sem saldo na rede'}`});
  const base=[informed?`Vendeu ${pcs(v.qty)} no período; saldo atual na unidade: ${n(bal)}.`:`Vendeu ${pcs(v.qty)} no período; a referência não aparece no arquivo de estoque da unidade (saldo não informado, diferente de zero).`,...gaps],balLabel=informed?n(bal):'não consta',where=informed?`sem saldo em ${short(store)}`:`sem registro no estoque de ${short(store)}`;
  const d=donors.find(x=>x.spare>0);
  if(d){const qty=Math.min(Math.ceil(v.qty),d.spare);out.push({id:`ruptura:${store}:${ref}:${period}`,kind:'ruptura',priority:hot?'alta':'media',store,storeName:name(store),title:v.model,subtitle:`${ref} · ${where}`,action:`Avaliar transferência de até ${pcs(qty)} de ${short(d.store)} para ${short(store)}`,stockInformed:informed,metrics:[{label:'Vendeu',value:pcs(v.qty)},{label:`Saldo ${short(store)}`,value:balLabel,tone:'bad'},{label:`Livre ${short(d.store)}`,value:pcs(d.spare),tone:'good'}],evidence:[...base,`Saldo em outras unidades: ${donors.slice(0,3).map(x=>`${name(x.store)} ${n(x.saldo)}${x.own?` (vendeu ${n(x.own)})`:''}`).join(' · ')}.`],suggestion:`Avaliar transferência de até ${pcs(qty)} de ${name(d.store)} para ${name(store)}, preservando o que a origem vendeu no período e conferindo cor, tamanho e rota.`,reference:ref,model:v.model,category:v.category,from:d.store,to:store,qty})}
  else out.push({id:`reposicao:${store}:${ref}:${period}`,kind:'reposicao',priority:hot?'alta':'media',store,storeName:name(store),title:v.model,subtitle:`${ref} · ${where}${donors.length?' e sem saldo livre na rede':' nem na rede'}`,action:'Avaliar reposição com fornecedor ou produção',stockInformed:informed,metrics:[{label:'Vendeu',value:pcs(v.qty)},{label:`Saldo ${short(store)}`,value:balLabel,tone:'bad'},{label:'Livre na rede',value:'0',tone:'bad'}],evidence:[...base,donors.length?`Outras unidades têm saldo, mas precisam dele para as próprias vendas: ${donors.slice(0,3).map(x=>`${name(x.store)} ${n(x.saldo)} (vendeu ${n(x.own)})`).join(' · ')}.`:'Nenhuma outra unidade tem saldo positivo desta referência.'],suggestion:'Avaliar reposição com fornecedor ou produção; confirmar se o modelo segue na coleção antes de pedir.',reference:ref,model:v.model,category:v.category,to:store});
 }
 // Idle stock where the unit has a sales file for the period.
 for(const store of stockUnits){if(!salesUnits.has(store))continue;const idle=[...refBal].filter(([k,b])=>k.startsWith(store+'|')&&b.saldo>=5&&!sold.has(k)).map(([k,b])=>({ref:k.split('|')[1],...b})).sort((a,b)=>b.saldo-a.saldo);if(!idle.length)continue;
  // Sold elsewhere: concrete reallocation cards (top 3 per unit).
  const elsewhere=idle.map(i=>({...i,where:[...sold].filter(([k,v])=>k.split('|')[1]===i.ref&&k.split('|')[0]!==store&&v.qty>0).map(([k,v])=>({store:k.split('|')[0],qty:v.qty})).sort((a,b)=>b.qty-a.qty)})).filter(i=>i.where.length).slice(0,3);
  for(const i of elsewhere){const w=i.where[0];
   // The destination's stock-out card already proposes this move: one need, one card.
   if(out.some(f=>f.kind==='ruptura'&&f.reference===i.ref&&f.to===w.store))continue;const destBal=refBal.get(`${w.store}|${i.ref}`)?.saldo??0,qty=Math.max(1,Math.min(Math.floor(i.saldo/2),Math.ceil(w.qty)));out.push({id:`realocar:${store}:${i.ref}:${period}`,kind:'realocar',priority:destBal<=0?'alta':'media',store,storeName:name(store),title:i.model,subtitle:`${i.ref} · parado em ${short(store)}, vende em ${short(w.store)}`,action:`Avaliar transferência de até ${pcs(qty)} de ${short(store)} para ${short(w.store)}`,metrics:[{label:`Parado ${short(store)}`,value:pcs(i.saldo)},{label:`Vendeu ${short(w.store)}`,value:pcs(w.qty),tone:'good'},{label:`Saldo ${short(w.store)}`,value:n(destBal),tone:destBal<=0?'bad':undefined}],evidence:[`Saldo em ${name(store)}: ${n(i.saldo)}; nenhuma venda no período nesta unidade.`,`${name(w.store)} vendeu ${n(w.qty)} e tem saldo ${n(destBal)}.`],suggestion:`Avaliar transferência de até ${pcs(qty)} de ${name(store)} para ${name(w.store)}, mantendo grade mínima na origem.`,reference:i.ref,model:i.model,from:store,to:w.store,qty})}
  const rest=idle.filter(i=>!elsewhere.some(e=>e.ref===i.ref));if(rest.length){const total=r6(rest.reduce((a,i)=>a+i.saldo,0));out.push({id:`parado:${store}:${period}`,kind:'parado',priority:'baixa',store,storeName:name(store),title:`Estoque parado em ${short(store)}`,subtitle:`${rest.length} referências com saldo e sem venda no período`,action:'Rever exposição; se não girar, ação comercial',metrics:[{label:'Referências',value:n(rest.length)},{label:'Saldo parado',value:n(total)}],evidence:[`Saldo somado: ${n(total)}.`,...rest.slice(0,5).map(i=>`${i.model} (${i.ref}): saldo ${n(i.saldo)}`)],suggestion:'Rever exposição e vitrine; se não houver giro na próxima leitura, avaliar ação comercial ou devolução ao centro.'})}
 }
 // Catalog / unit-of-measure gaps.
 const uncategorized=new Set(stock.filter(r=>r.reference&&resolveCategory(r.reference,idx).category===NO_CATEGORY).map(r=>r.reference!.trim()));
 if(uncategorized.size&&totals.length)out.push({id:`dados:categoria:${[...stockUnits].sort().join(',')}`,kind:'dados',priority:'baixa',store:'all',storeName:'Rede',title:`${uncategorized.size} referências do estoque sem categoria`,evidence:['A categoria vem das totalizações; referências sem venda no período ficam sem categoria.'],suggestion:'Importar totalizações de outros períodos ou um cadastro de produtos para classificar essas referências.'});
 const frac=stock.filter(r=>!Number.isInteger(r.physical));if(frac.length)out.push({id:`dados:fracionado:${frac.length}`,kind:'dados',priority:'baixa',store:'all',storeName:'Rede',title:`${frac.length} saldos fracionados`,evidence:frac.slice(0,3).map(r=>`${name(r.store)} · ${r.model}: ${n(r.physical)}`),suggestion:'Confirmar a unidade de medida desses itens (tecido, metro); não somá-los a peças em análises.'});
 const rank={alta:0,media:1,baixa:2};for(const f of out){if(f.from)f.fromName=name(f.from);if(f.to)f.toName=name(f.to)}return out.sort((a,b)=>rank[a.priority]-rank[b.priority]||(a.kind==='dados'?1:0)-(b.kind==='dados'?1:0)||(b.qty||0)-(a.qty||0));
}
