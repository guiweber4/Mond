/** Aggregated, deterministic context sent to AI. Only computed numbers; no customers, keys or raw files. */
import {summarizeTotals,type Total} from './totals';
import {inventory,aggregate,type Data,type Store} from './model';
import {anticipate,type OpsConfig} from './operations';
import {categoryIndex,resolveCategory,canonColor,canonSize,NO_CATEGORY} from './catalog';
import type {Purpose} from './ai-core';
import {kindLabels,priorityLabels,type Finding} from './findings';
import {computeInsights,type InsightConfig} from './insights';
import {metricBrief} from './metrics';
import {purchasePlan} from './purchasing';
import type {IdentityTables} from './identity';
const r2=(n:number)=>Math.round(n*100)/100,r6=(n:number)=>Math.round(n*1e6)/1e6;
/** Most recent declared totals period, or the one requested. */
export function pickPeriod(totals:Total[],wanted?:string){const periods=[...new Set(totals.map(t=>`${t.start}|${t.end}`))].sort((a,b)=>a.split('|')[1].localeCompare(b.split('|')[1])||a.localeCompare(b));return wanted&&periods.includes(wanted)?wanted:periods.at(-1)||''}
function salesBlock(totals:Total[],stores:Store[],period:string,channel:string){
 if(!period)return {disponivel:false,motivo:'Nenhuma totalização de vendas importada.'};
 const [start,end]=period.split('|'),a=summarizeTotals(totals,stores,start,end,channel);
 return {disponivel:true,fonte:'Totalização por produto (Presence), período declarado na importação',periodo:{inicio:start,fim:end},valorTotalizado:a.amount,pecasLiquidas:a.units,
  unidades:a.channels.map(c=>({unidade:c.name,temArquivo:c.hasData,valor:c.hasData?c.amount:null,pecas:c.hasData?c.qty:null,referencias:c.hasData?c.references:null})),
  categorias:a.categories.slice(0,12).map(c=>({categoria:c.name||NO_CATEGORY,valor:c.amount,participacao:a.amount>0?r2(c.amount/a.amount*100):null})),
  modelosEmDestaque:a.products.slice(0,15).map(p=>({referencia:p.reference,modelo:p.description,categoria:p.category,pecas:p.qty,valor:p.amount,unidades:p.stores})),
  linhasNegativas:a.negativeRows.length,ajustesFinanceiros:a.adjustments.length,semArquivo:a.missing.map(c=>c.name)};
}
function stockRows(data:Data,stores:Store[],asOf:string,channel:string){return inventory(data,stores,asOf,channel)}
function stockBlock(rows:ReturnType<typeof inventory>,totals:Total[]){
 if(!rows.length)return {disponivel:false,motivo:'Nenhuma posição de estoque importada até a data.'};
 const idx=categoryIndex(totals),byStore=new Map<string,{unidade:string;data:string;saldo:number;variacoes:number;negativasConsideradasZero:number;zeradas:number;fracionadas:number}>(),byCat=new Map<string,number>();
 for(const r of rows){const s=byStore.get(r.store)||{unidade:r.storeName,data:r.date,saldo:0,variacoes:0,negativasConsideradasZero:0,zeradas:0,fracionadas:0};s.saldo=r6(s.saldo+r.physical);s.variacoes++;if((r.reported??0)<0)s.negativasConsideradasZero++;if(r.physical===0)s.zeradas++;if(!Number.isInteger(r.physical))s.fracionadas++;byStore.set(r.store,s);const cat=r.reference?resolveCategory(r.reference,idx).category:NO_CATEGORY;byCat.set(cat,r6((byCat.get(cat)||0)+r.physical))}
 return {disponivel:true,fonte:'Saldo Estoque (Presence): Saldo Base por unidade, negativo considerado zero; sem reservas, trânsito ou unidade de medida',porUnidade:[...byStore.values()],porCategoria:[...byCat].map(([categoria,saldo])=>({categoria,saldo})).sort((a,b)=>b.saldo-a.saldo).slice(0,12)};
}
/** Sales (period total) next to current balance per unit and model. Signals only: no coverage or daily demand is derived. */
function crossSignals(totals:Total[],stores:Store[],period:string,stock:ReturnType<typeof inventory>){
 if(!period||!stock.length)return {disponivel:false,motivo:'Exige totalização e estoque da mesma unidade.'};
 const [start,end]=period.split('|'),sales=summarizeTotals(totals,stores,start,end,'all').rows;
 const sold=new Map<string,{qty:number;modelo:string;categoria:string}>();for(const t of sales){const k=`${t.store}|${t.reference.trim()}`,v=sold.get(k)||{qty:0,modelo:t.description,categoria:t.category};v.qty+=t.qty;sold.set(k,v)}
 const bal=new Map<string,{saldo:number;modelo:string;unidade:string}>();for(const r of stock){if(!r.reference)continue;const k=`${r.store}|${r.reference.trim()}`,v=bal.get(k)||{saldo:0,modelo:r.model,unidade:r.storeName};v.saldo=r6(v.saldo+r.physical);bal.set(k,v)}
 const units=new Set(sales.map(t=>t.store));const storeName=(id:string)=>stores.find(s=>s.id===id)?.name||id;
 const vendeComSaldoBaixo=[...sold].filter(([k,v])=>v.qty>0&&(bal.get(k)?.saldo??null)!==null&&bal.get(k)!.saldo<=1).map(([k,v])=>({unidade:storeName(k.split('|')[0]),referencia:k.split('|')[1],modelo:v.modelo,categoria:v.categoria,pecasVendidasNoPeriodo:v.qty,saldoAtual:bal.get(k)!.saldo,saldoEmOutrasUnidades:[...bal].filter(([o,b])=>o!==k&&o.split('|')[1]===k.split('|')[1]&&b.saldo>0).map(([,b])=>({unidade:b.unidade,saldo:b.saldo}))})).sort((a,b)=>b.pecasVendidasNoPeriodo-a.pecasVendidasNoPeriodo).slice(0,15);
 const saldoSemVenda=[...bal].filter(([k,v])=>units.has(k.split('|')[0])&&v.saldo>=5&&!sold.has(k)).map(([k,v])=>({unidade:v.unidade,referencia:k.split('|')[1],modelo:v.modelo,saldoAtual:v.saldo})).sort((a,b)=>b.saldoAtual-a.saldoAtual).slice(0,15);
 return {disponivel:true,observacao:'Comparação entre total vendido no período declarado e saldo na data da posição, por unidade e referência. São sinais para validar, não demanda diária nem cobertura. saldoEmOutrasUnidades indica onde há saldo positivo da mesma referência (possível transferência, sujeita a rota e validação de grade).',vendeComSaldoBaixo,saldoSemVendaNoPeriodo:saldoSemVenda,
  ajuste:'Cor e tamanho têm correspondência canônica disponível na grade; aqui a comparação é por referência.',exemploCanonico:{cor:canonColor('3   -CHUMBO'),tamanho:canonSize('01 - 32').label}};
}
export type AIParams={purpose:Purpose;dataset:string;start:string;end:string;channel:string;period?:string;report?:unknown};
/** Builds the JSON context for one purpose. `saved` are persisted action decisions. */
const clip=(v:unknown,n=240)=>String(v??'').replace(/[\u0000-\u001f]+/g,' ').slice(0,n);
/** One insight as the model sees it: fact, numbers, hypotheses, recommendation and limits kept apart. Imported text is clipped. */
export const compactInsight=(f:Finding)=>({prioridade:priorityLabels[f.priority],tipo:kindLabels[f.kind],unidade:f.storeName,titulo:clip(f.title,160),fato:clip(f.fact||f.evidence[0]),numeros:f.metrics,evidencias:f.evidence.slice(0,3).map(e=>clip(e)),hipoteses:(f.hypotheses||[]).map(h=>({hipotese:clip(h.text),apoio:h.support?clip(h.support):undefined,validarCom:h.validateWith})),recomendacao:clip(f.action||f.suggestion),limitacoes:(f.limitations||[]).slice(0,3).map(l=>clip(l))});
export type ContextExtra={today?:string;config?:Partial<InsightConfig>;tables?:IdentityTables};
export function buildContext(p:AIParams,data:Data,stores:Store[],ops:OpsConfig,saved:{dataset:string;status:string;payload:string}[],extra:ContextExtra={}){
 const totals=data.totals||[],period=pickPeriod(totals,p.period),stockDate=[...data.stock.map(s=>s.date)].sort().at(-1)||p.end;
 const asOf=p.end&&p.end>=stockDate?p.end:stockDate,stock=stockRows(data,stores,asOf,p.channel);
 const hasSales=data.sales.length>0,base:Record<string,unknown>={dataset:p.dataset,finalidade:p.purpose,unidadeFiltrada:p.channel==='all'?'todas':stores.find(s=>s.id===p.channel)?.name||p.channel,
  unidadesEmOperacao:stores.filter(s=>s.status==='open').map(s=>({unidade:s.name,tipo:s.type==='online'?'e-commerce (estoque próprio)':'loja física'}))};
 const limitations=['Dados importados manualmente; a Presence não tem coleta automática ativa.','Totalizações não trazem datas diárias, pedidos, custos nem ticket.','Estoque não informa reservas, trânsito nem unidade de medida. Saldo negativo significa venda antes do lançamento da entrada e conta como zero; saldos fracionados são preservados.'];
 if(p.purpose==='report'){return JSON.stringify({...base,relatorio:trimReport(p.report),limitacoes:limitations})}
 const vendas=salesBlock(totals,stores,period,p.channel),estoque=stockBlock(stock,totals),sinais=crossSignals(totals,stores,period,stock);
 let operacional:Record<string,unknown>={disponivel:false,motivo:'Sem vendas transacionais datadas: consumo diário, cobertura e sugestões quantitativas não são calculados.'};
 if(hasSales){const plan=anticipate(data,stores,p.end,ops,saved,p.dataset),a=aggregate(data,stores,p.start,p.end,p.channel);
  operacional={disponivel:true,periodo:{inicio:p.start,fim:p.end},receitaLiquida:a.revenue,pecas:a.units,pedidos:a.orders,ticket:a.ticket,
   riscos:plan.rows.filter(r=>p.channel==='all'||r.store===p.channel).filter(r=>r.rupture||r.qty>0).slice(0,15).map(r=>({sku:r.sku,unidade:r.storeName,disponivel:r.available,consumoDia:r.daily,falta:r.rupture,pedirAte:r.decisionDate,metodo:r.method,confianca:r.confidence})),
   decisoes:plan.decisions.filter(d=>p.channel==='all'||d.to===p.channel||d.from===p.channel).slice(0,12),pedidosAtrasados:plan.overdue.length,
   qualidade:plan.quality.map(q=>({unidade:q.name,status:q.status,estoque:q.lastStock,controlesFaltantes:q.gaps.length,divergencias:q.mismatches.length,semCadastro:q.unknown}))}}
 const acoes=saved.filter(s=>s.dataset===p.dataset).reduce<Record<string,number>>((acc,s)=>{acc[s.status]=(acc[s.status]||0)+1;return acc},{});
 const {insights,readiness:rd}=computeInsights({totals,stock:data.stock,stores,goals:data.goals,sales:data.sales.length,purchases:data.purchases,routes:(ops.routes||[]).length,saved,today:extra.today||new Date().toISOString().slice(0,10),period,config:extra.config,tables:extra.tables});
 const scoped=insights.filter(f=>p.channel==='all'||f.store==='all'||f.store===p.channel||f.from===p.channel||f.to===p.channel).filter(f=>p.purpose!=='planning'||!['desempenho','mix','ranking'].includes(f.kind)).slice(0,25);
 const diagnostico={periodo:rd.period?{inicio:rd.period.start,fim:rd.period.end,parcial:rd.period.partial}:null,comparacao:rd.previous?{inicio:rd.previous.start,fim:rd.previous.end,metodo:rd.previous.label}:null,estoque:rd.stockDates.map(s=>({unidade:s.name,data:s.date,dias:s.ageDays})),limitacoes:rd.limitations,analises:rd.capabilities.map(c=>({analise:c.label,situacao:c.status,motivo:c.reason,falta:c.missing}))};
 const ctx:Record<string,unknown>={...base,diagnosticoDados:diagnostico,achadosCalculados:scoped.map(compactInsight),definicoes:metricBrief(scoped.flatMap(f=>f.metricIds||[])),vendasConsolidadas:vendas,estoque,sinaisVendasEstoque:sinais,operacional};
 // Purchase rationale for supply and action plan: summary, method and the most urgent models (no cost: value at sale price).
 if(p.purpose==='planning'||p.purpose==='actions'){const pp=purchasePlan({totals,stock:data.stock,stores,ops,purchases:data.purchases,saved,tables:extra.tables});if(pp)ctx.sugestaoCompras={metodo:pp.method,resumo:{pecas:pp.summary.pieces,modelos:pp.summary.models,urgenciaAlta:pp.summary.alta,valorAPrecoDeVenda:pp.summary.value},modelos:pp.suggestions.slice(0,15).map(x=>({modelo:clip(x.model,80),referencia:x.reference,categoria:x.category,urgencia:x.urgency,curva:x.abc,vendeu:x.sold,saldoRede:x.stock,coberturaDias:x.coverage,pedir:x.qty,divisao:x.split.map(y=>`${y.short} ${y.qty}`).join(' · ')})),naoRecomprar:pp.avoid.slice(0,5).map(a=>({modelo:clip(a.model,80),saldo:a.stock,motivo:a.reason})),limitacoes:pp.limitations}}
 if(p.purpose==='planning')ctx.parametrosAbastecimento={prazoFornecimentoDias:ops.leadDays,segurancaDias:ops.safetyDays,coberturaAlvoDias:ops.targetDays,rotas:(ops.routes||[]).length};
 if(p.purpose==='actions')ctx.acoesRegistradas=acoes;
 return JSON.stringify({...ctx,limitacoes:limitations});
}
function trimReport(r:unknown){if(!r||typeof r!=='object')return null;const x=r as Record<string,unknown>;return {...x,products:Array.isArray(x.products)?x.products.slice(0,20):x.products,ai:undefined}}
/** Executive output: "## Title" blocks with "- " bullets and an optional "> Nota:" line. */
export function parseSlides(text:string){return text.split(/^##\s+/m).map(s=>s.trim()).filter(Boolean).map(block=>{const [title,...lines]=block.split('\n');return {title:title.trim(),bullets:lines.map(l=>l.trim()).filter(l=>/^[-*•]\s+/.test(l)).map(l=>l.replace(/^[-*•]\s+/,'')),note:lines.map(l=>l.trim()).find(l=>/^>\s*/.test(l))?.replace(/^>\s*(Nota:)?\s*/i,'')||''}}).filter(s=>s.title&&s.bullets.length)}
