'use client';
import {ArrowRight,Lightbulb,TrendingUp,Package,Boxes,Store as StoreIcon} from 'lucide-react';
import {summarizeTotals,type Total} from '@/lib/totals';
import {latestPeriod,latestStock,kindLabels,priorityLabels,type Finding} from '@/lib/findings';
import {dayBR,type Stock,type Store} from '@/lib/model';
const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const int=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
/** Home when the base has period totals and stock snapshots but no daily sales. */
export default function OverviewConsolidated({totals,stock,stores,channel,findings,go}:{totals:Total[];stock:Stock[];stores:Store[];channel:string;findings:Finding[];go:(view:string,category?:string)=>void}){
 const period=latestPeriod(totals),[start,end]=period?period.split('|'):['',''],a=summarizeTotals(totals,stores,start,end,channel);
 const pos=latestStock(stock).filter(r=>channel==='all'||r.store===channel),units=a.channels.filter(c=>c.hasData),max=Math.max(1,...units.map(c=>c.amount)),maxCat=Math.max(1,...a.categories.map(c=>c.amount));
 const top=findings.filter(f=>f.kind!=='dados'&&(channel==='all'||f.store===channel||f.to===channel||f.from===channel)).slice(0,4),alta=findings.filter(f=>f.priority==='alta').length;
 return <div className="overview-c">
  <div className="stats-grid">
   <div className="stat stat-accent"><div className="stat-label">Vendas no período<TrendingUp size={18}/></div><strong>{brl(a.amount)}</strong><small>{dayBR(start)} a {dayBR(end)} · totalização da Presence</small></div>
   <div className="stat"><div className="stat-label">Peças líquidas<Package size={18}/></div><strong>{int(a.units)}</strong><small>{a.units>0?`Preço médio ${brl(a.amount/a.units)} por peça`:'—'}</small></div>
   <div className="stat"><div className="stat-label">Saldo em estoque<Boxes size={18}/></div><strong>{int(Math.round(pos.reduce((s,r)=>s+r.physical,0)*10)/10)}</strong><small>{pos.length?`${new Set(pos.map(r=>r.store)).size} unidades · posição ${dayBR(pos.map(r=>r.date).sort().at(-1)||'')}`:'Nenhuma posição importada'}</small></div>
   <div className="stat"><div className="stat-label">Unidades com vendas<StoreIcon size={18}/></div><strong>{units.length} / {a.channels.length}</strong><small>{a.missing.length?`Sem arquivo: ${a.missing.map(c=>c.name.split(' · ')[0]).join(', ')}`:'Todas com arquivo no período'}</small></div>
  </div>
  <section className="panel attention-panel"><div className="panel-head"><div><h2>Pontos de atenção</h2><p>{alta?`${alta} de prioridade alta. `:''}Faltas de produtos que vendem, estoque parado e transferências possíveis.</p></div><button type="button" className="text-button" onClick={()=>go('actions')}>Ver plano de ação<ArrowRight size={15}/></button></div>
   {top.length?<div className="attention-list">{top.map(f=><button type="button" key={f.id} className={'attention-item '+f.priority} onClick={()=>go('actions')}><span className={'priority-pill '+f.priority}>{priorityLabels[f.priority]}</span><div><small>{kindLabels[f.kind]}</small><strong>{f.title}</strong><p><Lightbulb size={13} aria-hidden="true"/> {f.suggestion}</p></div></button>)}</div>:<p className="empty-inline">Nenhum ponto de atenção com os dados atuais.</p>}
  </section>
  <div className="overview-grid">
   <section className="panel"><div className="panel-head"><div><h2>Vendas por unidade</h2><p>Participação no valor do período.</p></div><button type="button" className="text-button" onClick={()=>go('totals')}>Detalhes<ArrowRight size={15}/></button></div><div className="ov-bars">{a.channels.map(c=><div key={c.id}><span>{c.name}</span>{c.hasData?<><i className="rv-bar"><i style={{width:`${Math.max(2,c.amount/max*100)}%`}}/></i><strong>{brl(c.amount)} · {a.amount?Math.round(c.amount/a.amount*1000)/10:0}%</strong></>:<em>sem arquivo no período</em>}</div>)}</div></section>
   <section className="panel"><div className="panel-head"><div><h2>Categorias que mais vendem</h2><p>Clique para abrir os modelos e a grade.</p></div></div><div className="ov-bars">{a.categories.slice(0,7).map(c=><button type="button" key={c.name} onClick={()=>go('totals',c.name||'Categoria não informada')}><span>{c.name||'Categoria não informada'}</span><i className="rv-bar"><i style={{width:`${Math.max(2,c.amount/maxCat*100)}%`}}/></i><strong>{brl(c.amount)}</strong></button>)}</div></section>
  </div>
 </div>
}
