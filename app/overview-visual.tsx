'use client';
import {useState} from 'react';
import {PieChart,Pie,Cell,BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,LabelList,CartesianGrid} from 'recharts';
import {ArrowRight,TrendingUp,Package,Tag,Boxes,Store as StoreIcon,AlertTriangle} from 'lucide-react';
import type {Overview,Highlight,StockState} from '@/lib/overview-data';
import {priorityLabels,type Finding} from '@/lib/findings';
import {swatch} from '@/lib/color-swatch';
import {unitColor,SERIES,STATUS,INK} from '@/lib/viz-palette';
import {dayBR,type Store} from '@/lib/model';
const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const compact=(n:number)=>Math.abs(n)>=1e6?`R$ ${(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})} mi`:Math.abs(n)>=1e3?`R$ ${(n/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0})} mil`:brl(n);
const int=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
const pc=(n:number|null)=>n===null?'—':`${n.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
export const stateLabel:Record<StockState,string>={sem_saldo:'sem saldo',baixo:'pouco saldo',ok:'com saldo',nao_consta:'não consta'};
const stateColor:Record<StockState,string>={sem_saldo:STATUS.critical,baixo:STATUS.serious,ok:STATUS.good,nao_consta:STATUS.muted};
type Go=(view:string,opts?:{category?:string;model?:string})=>void;
function Tip({active,payload,label,fmt}:{active?:boolean;payload?:{name:string;value:number;color?:string;payload?:Record<string,unknown>}[];label?:string;fmt:(name:string,v:number,p?:Record<string,unknown>)=>string}){if(!active||!payload?.length)return null;return <div className="viz-tip">{label&&<b>{label}</b>}{payload.map((p,i)=><span key={i}>{p.color&&<i style={{background:p.color}}/>}{fmt(p.name,p.value,p.payload)}</span>)}</div>}
export function Swatch({color,size=14}:{color:string;size?:number}){const s=swatch(color);return <span className={'swatch'+(s.hex?'':s.pattern?' print':' unknown')} style={{width:size,height:size,...(s.hex?{background:s.hex}:{})}} title={s.hex||s.pattern?s.label:`${s.label} (cor não identificada)`} aria-hidden="true"/>}
export function StockChip({s}:{s:Highlight['stores'][number]}){return <span className={'stock-chip '+s.state} title={`${s.short}: ${stateLabel[s.state]}${s.balance!==null?` (saldo ${int(s.balance)})`:''}; vendeu ${int(s.sold)}`}><i style={{background:stateColor[s.state]}}/>{s.short} <b>{s.balance===null?'—':int(s.balance)}</b></span>}
/** Visual summary of the latest period for the consolidated base (totals + stock). */
export default function OverviewVisual({data:o,stores,findings,channel,go}:{data:Overview;stores:Store[];findings:Finding[];channel:string;go:Go}){
 const [group,setGroup]=useState<'letra'|'numero'>('letra');
 const units=o.unitsData.filter(u=>u.hasData),open=findings.filter(f=>f.kind!=='dados'&&(channel==='all'||f.store===channel||f.to===channel||f.from===channel));
 const counts=(['alta','media','baixa'] as const).map(p=>({p,n:open.filter(f=>f.priority===p).length}));
 const curve=o.sizeCurve.filter(s=>s.group===group),over=curve.filter(s=>s.stock-s.sold>=1.5).map(s=>s.size),under=curve.filter(s=>s.sold-s.stock>=1.5).map(s=>s.size);
 const health=o.stockHealth.map(s=>({...s,total:s.positive+s.zero+s.negative}));
 return <div className="ov2">
  <div className="ov2-kpis">
   <div className="ov2-kpi accent"><span><TrendingUp size={16}/>Vendas no período</span><strong>{compact(o.amount)}</strong><small>{dayBR(o.start)} a {dayBR(o.end)}</small></div>
   <div className="ov2-kpi"><span><Package size={16}/>Peças líquidas</span><strong>{int(o.units)}</strong><small>{o.models} modelos vendidos</small></div>
   <div className="ov2-kpi"><span><Tag size={16}/>Preço médio por peça</span><strong>{o.avg===null?'—':brl(o.avg)}</strong><small>Valor ÷ peças (não é ticket)</small></div>
   <div className="ov2-kpi"><span><Boxes size={16}/>Saldo em estoque</span><strong>{o.stockBalance===null?'—':int(o.stockBalance)}</strong><small>{o.stockDates.length?o.stockDates.map(s=>`${s.short} ${dayBR(s.date).slice(0,5)}`).join(' · '):'Sem posição importada'}</small></div>
   <div className="ov2-kpi"><span><StoreIcon size={16}/>Unidades com vendas</span><strong>{o.unitsWithFile}/{o.unitsTotal}</strong><small>{o.missing.length?`Sem arquivo: ${o.missing.map(m=>m.split(' · ')[0]).join(', ')}`:'Todas com arquivo'}</small></div>
  </div>
  <section className="ov2-attention" aria-label="Pontos de atenção">
   <div className="ov2-att-counts">{counts.map(c=><button type="button" key={c.p} className={'att-count '+c.p} onClick={()=>go('actions')}><strong>{c.n}</strong><span>{priorityLabels[c.p]}</span></button>)}</div>
   <ul className="ov2-att-list">{open.slice(0,3).map(f=><li key={f.id}><span className={'priority-pill '+f.priority}>{priorityLabels[f.priority]}</span><b>{f.title}</b><span className="muted">{f.action||f.suggestion}</span></li>)}</ul>
   <button type="button" className="text-button" onClick={()=>go('actions')}>Plano de ação<ArrowRight size={15}/></button>
  </section>
  <div className="ov2-grid">
   <section className="panel ov2-card span-5"><header><h2>Vendas por unidade</h2><p>Participação no valor do período</p></header>
    <div className="donut-wrap"><div className="donut" role="img" aria-label={`Vendas por unidade: ${units.map(u=>`${u.short} ${pc(u.share)}`).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={units} dataKey="amount" nameKey="short" innerRadius="62%" outerRadius="96%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>{units.map(u=><Cell key={u.id} fill={unitColor(u.id,stores)}/>)}</Pie><Tooltip content={<Tip fmt={(n,v)=>`${n}: ${compact(v)} · ${pc(units.find(u=>u.short===n)?.share??null)}`}/>}/></PieChart></ResponsiveContainer><div className="donut-center"><strong>{compact(o.amount)}</strong><small>{units.length} unidades</small></div></div>
     <ul className="legend-list">{o.unitsData.map(u=><li key={u.id}><i style={{background:u.hasData?unitColor(u.id,stores):'transparent',borderColor:unitColor(u.id,stores)}}/><span>{u.short}</span>{u.hasData?<><b>{pc(u.share)}</b><small>{compact(u.amount)} · {int(u.qty)} pç</small></>:<em>sem arquivo</em>}</li>)}</ul></div>
   </section>
   <section className="panel ov2-card span-7"><header><h2>Categorias que mais vendem</h2><p>Valor no período · clique para abrir os modelos</p></header>
    <div className="chart-box" style={{height:Math.max(220,o.categories.length*34+20)}}><ResponsiveContainer width="100%" height="100%"><BarChart data={o.categories} layout="vertical" margin={{left:4,right:96,top:4,bottom:4}} barCategoryGap={6}><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={118} tickLine={false} axisLine={false} tick={{fontSize:12,fill:INK.secondary}}/><Tooltip cursor={{fill:'#f1f4f6'}} content={<Tip fmt={(n,v,p)=>`${compact(v)} · ${pc((p?.share as number)??null)} · ${int((p?.qty as number)||0)} peças`}/>}/><Bar dataKey="amount" name="Valor" fill={SERIES.neutral} radius={[0,4,4,0]} cursor="pointer" isAnimationActive={false} onClick={(d:unknown)=>{const x=d as {name?:string;payload?:{name?:string}},name=x.payload?.name||x.name;if(name&&name!=='Outras')go('totals',{category:name})}}><LabelList dataKey="amount" position="right" formatter={(v:unknown)=>compact(Number(v))} style={{fontSize:12,fill:INK.secondary}}/></Bar></BarChart></ResponsiveContainer></div>
   </section>
   <section className="panel ov2-card span-12"><header><h2>Peças em destaque</h2><p>Os modelos de maior valor no período, com cores, tamanhos vendidos e saldo por unidade</p></header>
    <div className="hl-grid">{o.highlights.map((h,i)=><article key={h.reference} className="hl-card"><div className="hl-top"><span className="hl-rank">{String(i+1).padStart(2,'0')}</span><span className="hl-cat">{h.category}</span></div><h3>{h.model}</h3><small className="hl-ref">{h.reference}</small>
     <div className="hl-nums"><div><strong>{compact(h.amount)}</strong><small>{pc(h.share)} do total</small></div><div><strong>{int(h.qty)}</strong><small>peças</small></div><div><strong>{h.avg===null?'—':compact(h.avg)}</strong><small>por peça</small></div></div>
     <div className="hl-row"><span className="hl-label">Cores</span><span className="hl-swatches">{h.colors.slice(0,5).map(c=><span key={c.label} className="hl-color" title={`${c.label}: ${int(c.qty)} peças`}><Swatch color={c.label}/>{h.colors.length<=2?c.label.toLowerCase():''}</span>)}{h.colors.length>5&&<small>+{h.colors.length-5}</small>}</span></div>
     <div className="hl-row"><span className="hl-label">Tamanhos</span><span className="hl-sizes">{h.sizes.slice(0,8).map(z=><span key={z.label} title={`${z.label}: ${int(z.qty)} peças`}>{z.label}</span>)}</span></div>
     <div className="hl-row"><span className="hl-label">Saldo</span><span className="hl-stock">{h.stores.length?h.stores.map(s=><StockChip key={s.id} s={s}/>):<em>sem estoque importado</em>}</span></div>
     <footer><small>{h.str===null?'STR —':`Vendeu ${pc(h.str)} do disponível`}</small><button type="button" className="text-button" onClick={()=>go('totals',{category:h.category,model:h.reference})}>Ver grade<ArrowRight size={14}/></button></footer>
    </article>)}</div>
   </section>
   <section className="panel ov2-card span-7"><header><h2>Curva de tamanhos: venda × estoque</h2><p>% das peças vendidas e % do saldo positivo, por tamanho</p><div className="seg" role="group" aria-label="Grupo de tamanhos">{(['letra','numero'] as const).map(g=><button type="button" key={g} aria-pressed={group===g} className={group===g?'on':''} onClick={()=>setGroup(g)}>{g==='letra'?'Letras':'Numeração'}</button>)}</div></header>
    <div className="chart-box" style={{height:230}}><ResponsiveContainer width="100%" height="100%"><BarChart data={curve} margin={{left:0,right:8,top:8,bottom:0}} barGap={2} barCategoryGap="22%"><CartesianGrid vertical={false} stroke={INK.grid}/><XAxis dataKey="size" tickLine={false} axisLine={{stroke:INK.axis}} tick={{fontSize:12,fill:INK.secondary}}/><YAxis tickLine={false} axisLine={false} width={34} tick={{fontSize:11,fill:INK.muted}} tickFormatter={v=>`${v}%`}/><Tooltip cursor={{fill:'#f1f4f6'}} content={<Tip fmt={(n,v,p)=>`${n}: ${pc(v)} (${int(n==='Vendas'?(p?.soldQty as number):(p?.stockQty as number))} peças)`}/>}/><Bar dataKey="sold" name="Vendas" fill={SERIES.primary} radius={[4,4,0,0]} isAnimationActive={false}/><Bar dataKey="stock" name="Estoque" fill={SERIES.secondary} radius={[4,4,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>
    <div className="chart-foot2"><span className="key"><i style={{background:SERIES.primary}}/>Vendas</span><span className="key"><i style={{background:SERIES.secondary}}/>Estoque</span>{under.length>0&&<span>Vende mais do que tem: <b>{under.join(', ')}</b></span>}{over.length>0&&<span>Tem mais do que vende: <b>{over.join(', ')}</b></span>}</div>
   </section>
   <section className="panel ov2-card span-5"><header><h2>Saúde do estoque</h2><p>Variações por situação na última posição</p></header>
    <ul className="health-list">{health.map(s=><li key={s.id}><div className="health-head"><b>{s.short}</b><span>saldo {int(s.balance)}{s.str!==null?` · STR ${pc(s.str)}`:''} · {dayBR(s.date).slice(0,5)}</span></div>
     <div className="stack" role="img" aria-label={`${s.short}: ${s.positive} com saldo, ${s.zero} zeradas, ${s.negative} negativas`}>{[['positive',SERIES.neutral],['zero',STATUS.muted],['negative',STATUS.critical]].map(([k,c])=>{const v=s[k as 'positive'|'zero'|'negative'];return v>0?<span key={k} style={{flexGrow:v,background:c}} title={`${v} variações`}/>:null})}</div>
     <small>{int(s.positive)} com saldo · {int(s.zero)} zeradas · <span className={s.negative?'neg':''}>{int(s.negative)} negativas</span></small></li>)}</ul>
    <div className="chart-foot2"><span className="key"><i style={{background:SERIES.neutral}}/>Com saldo</span><span className="key"><i style={{background:STATUS.muted}}/>Zerada</span><span className="key"><i style={{background:STATUS.critical}}/>Negativa</span></div>
   </section>
   <section className="panel ov2-card span-6"><header><h2>Faixas de preço</h2><p>Peças vendidas por preço médio do modelo</p></header>
    <div className="chart-box" style={{height:210}}><ResponsiveContainer width="100%" height="100%"><BarChart data={o.priceBands} margin={{left:0,right:8,top:22,bottom:0}}><XAxis dataKey="label" tickLine={false} axisLine={{stroke:INK.axis}} tick={{fontSize:11,fill:INK.secondary}} interval={0}/><YAxis hide/><Tooltip cursor={{fill:'#f1f4f6'}} content={<Tip fmt={(n,v,p)=>`${int(v)} peças · ${compact((p?.amount as number)||0)} · ${int((p?.models as number)||0)} modelos`}/>}/><Bar dataKey="qty" name="Peças" fill={SERIES.neutral} radius={[4,4,0,0]} isAnimationActive={false}><LabelList dataKey="qty" position="top" formatter={(v:unknown)=>int(Number(v))} style={{fontSize:12,fill:INK.secondary}}/></Bar></BarChart></ResponsiveContainer></div>
   </section>
   <section className="panel ov2-card span-6"><header><h2>Cores mais vendidas</h2><p>Peças no período</p></header>
    <ul className="color-bars">{o.colors.slice(0,8).map(c=>{const max=o.colors[0]?.qty||1;return <li key={c.label}><Swatch color={c.label} size={16}/><span className="cname">{c.label.toLowerCase()}</span><span className="cbar"><i style={{width:`${Math.max(2,c.qty/max*100)}%`}}/></span><b>{int(c.qty)}</b></li>})}</ul>
   </section>
  </div>
  {o.missing.length>0&&<p className="ov2-note"><AlertTriangle size={14}/>Sem arquivo de vendas: {o.missing.join(', ')}. Ausência de arquivo não é venda zero.</p>}
 </div>
}
