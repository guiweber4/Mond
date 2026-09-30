/** Consolidated sales report built for reading: headline numbers, units, categories, top models, stock and points of attention. */
import {summarizeTotals,type Total} from './totals';
import {dayBR,type Stock,type Store} from './model';
import {computeFindings,latestStock,priorityLabels} from './findings';
const pct=(part:number,total:number)=>total>0?Math.round(part/total*1000)/10:null;
const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const mi=(n:number)=>n>=1e6?`R$ ${(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})} mi`:n>=1e3?`R$ ${(n/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0})} mil`:brl(n);
export function consolidatedReport(totals:Total[],stores:Store[],start:string,end:string,channel='all',extra:{stock?:Stock[];today?:string}={}){
 const a=summarizeTotals(totals,stores,start,end,channel),withFile=a.channels.filter(c=>c.hasData);
 const units=[...a.channels].sort((x,y)=>(y.hasData?y.amount:-1)-(x.hasData?x.amount:-1)).map(c=>({id:c.id,name:c.name,hasData:c.hasData,revenue:c.hasData?c.amount:null,units:c.hasData?c.qty:null,share:c.hasData?pct(c.amount,a.amount):null,references:c.hasData?c.references:null}));
 const categories=a.categories.slice(0,8).map(c=>({name:c.name||'Categoria não informada',amount:c.amount,share:pct(c.amount,a.amount)}));
 const models=a.products.slice(0,10).map(p=>({sku:p.reference,model:p.description,category:p.category,qty:p.qty,amount:p.amount,share:pct(p.amount,a.amount)}));
 const stockRows=latestStock(extra.stock||[]).filter(r=>channel==='all'||r.store===channel);
 const stock=[...new Set(stockRows.map(r=>r.store))].map(id=>{const rows=stockRows.filter(r=>r.store===id);return {name:stores.find(s=>s.id===id)?.name||id,date:rows[0].date,balance:Math.round(rows.reduce((s,r)=>s+r.physical,0)*10)/10,variants:rows.length,zero:rows.filter(r=>r.physical===0).length,negative:rows.filter(r=>r.physical<0).length}});
 const findings=extra.stock?computeFindings(totals,extra.stock,stores,{today:extra.today||end,period:`${start}|${end}`}).filter(f=>channel==='all'||f.store===channel||f.store==='all'||f.to===channel||f.from===channel):[];
 const lead=withFile[0]?units[0]:null,cat=categories[0],top=models[0];
 // Plain sentences a store manager can read in 30 seconds.
 const summary=[
  `${mi(a.amount)} em vendas e ${a.units.toLocaleString('pt-BR')} peças líquidas de ${dayBR(start)} a ${dayBR(end)}${channel==='all'?`, somando ${withFile.length} ${withFile.length===1?'unidade':'unidades'} com arquivo`:''}.`,
  lead&&withFile.length>1?`${lead.name} lidera com ${lead.share?.toLocaleString('pt-BR')}% do valor.`:'',
  cat?`${cat.name} é a categoria que mais vende (${cat.share?.toLocaleString('pt-BR')}% do valor).`:'',
  top?`Modelo com maior valor: ${top.model} (${top.qty.toLocaleString('pt-BR')} peças, ${brl(top.amount)}).`:'',
  a.missing.length?`Sem arquivo de vendas neste período: ${a.missing.map(c=>c.name).join(', ')} — isso não significa venda zero.`:'',
  findings.length?`${findings.filter(f=>f.priority==='alta').length} pontos de atenção de prioridade alta cruzando vendas e estoque.`:''
 ].filter(Boolean);
 return {kind:'totals',version:2,dataset:'real',type:'Consolidado',period:`${dayBR(start)} a ${dayBR(end)}`,start,end,channel:channel==='all'?'Todas as unidades':stores.find(s=>s.id===channel)?.name,createdAt:new Date().toISOString(),
  revenue:a.amount,units:a.units,ticket:null,average:a.units>0?Math.round(a.amount/a.units*100)/100:null,summary,insights:summary,
  channels:units.map(u=>({...u,revenue:u.revenue,units:u.units})),categories,products:models,stock,
  attention:findings.slice(0,6).map(f=>({priority:priorityLabels[f.priority],title:f.title,suggestion:f.suggestion})),
  notes:['Valores do arquivo de totalização da Presence, com sinais originais (devoluções e ajustes incluídos).','Preço médio por peça = valor ÷ peças líquidas. Ticket por pedido e evolução diária não existem neste arquivo.','Estoque = Saldo Base na data da posição, sem reservas nem trânsito.','Pontos de atenção são sugestões para validar; nada é executado automaticamente.'],actions:[]};
}
