'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {createPortal} from 'react-dom';
import {ChevronLeft,ChevronRight,Maximize2,Printer,AlertTriangle} from 'lucide-react';
import type {DeckSlide} from '@/lib/executive-deck';
export {toSlides} from '@/lib/executive-deck';
import type {Store} from '@/lib/model';
import {unitColor,SERIES,STATUS} from '@/lib/viz-palette';
const stateColor:Record<string,string>={sem_saldo:STATUS.critical,baixo:STATUS.serious,ok:STATUS.good,nao_consta:STATUS.muted};
const stateText:Record<string,string>={sem_saldo:'sem saldo',baixo:'pouco saldo',ok:'com saldo',nao_consta:'não consta'};
function Body({s,stores}:{s:DeckSlide;stores:Store[]}){
 const bullets=s.ai?.bullets||s.bullets,d=s.data||{};
 const text=bullets.length>0&&<ul className="sl-bullets">{bullets.map((b,i)=><li key={i}>{b}</li>)}</ul>;
 if(s.layout==='cover')return <><div className="sl-kpis">{(d.kpis||[]).map(k=><div key={k.label}><span>{k.label}</span><strong>{k.value}</strong></div>)}</div>{text}</>;
 if(s.layout==='bars'){const max=Math.max(1,...(d.bars||[]).map(b=>b.value));return <div className="sl-two">{text||<div/>}<ul className="sl-bars">{(d.bars||[]).slice(0,8).map(b=><li key={b.label} className={b.muted?'muted':''}><span className="sl-bar-label">{b.label}</span><span className="sl-bar-track"><i style={{width:`${b.muted?0:Math.max(2,b.value/max*100)}%`,background:b.unit?unitColor(b.unit,stores):SERIES.neutral}}/></span><span className="sl-bar-value">{b.display}</span></li>)}</ul></div>}
 if(s.layout==='models')return <><table className="sl-table"><thead><tr><th>Modelo</th><th>Categoria</th><th className="num">Valor</th><th className="num">Peças</th><th>Saldo por unidade</th></tr></thead><tbody>{(d.models||[]).map(m=><tr key={m.reference}><td><b>{m.model}</b><small>{m.reference} · {m.share}</small></td><td>{m.category}</td><td className="num">{m.amount}</td><td className="num">{m.qty}</td><td><span className="sl-chips">{m.stores.map(x=><span key={x.short} className="sl-chip" title={stateText[x.state]}><i style={{background:stateColor[x.state]}}/>{x.short} {x.balance===null?'—':x.balance.toLocaleString('pt-BR')}</span>)}</span></td></tr>)}</tbody></table>{text}</>;
 if(s.layout==='stock')return <div className="sl-two">{text||<div/>}<ul className="sl-stock">{(d.stock||[]).map(u=>{const t=u.positive+u.zero+u.negative||1;return <li key={u.short}><div><b>{u.short}</b><span>saldo {u.balance} · STR {u.str}</span></div><span className="sl-stack"><i style={{width:`${u.positive/t*100}%`,background:SERIES.neutral}}/><i style={{width:`${u.zero/t*100}%`,background:STATUS.muted}}/><i style={{width:`${u.negative/t*100}%`,background:STATUS.critical}}/></span><small>{u.positive} com saldo · {u.zero} zeradas · {u.negative} negativas</small></li>})}<li className="sl-legend"><span><i style={{background:SERIES.neutral}}/>com saldo</span><span><i style={{background:STATUS.muted}}/>zerada</span><span><i style={{background:STATUS.critical}}/>negativa</span></li></ul></div>;
 if(s.layout==='priorities')return d.priorities?.length?<div className="sl-pri">{d.priorities.map((p,i)=><article key={i} className={p.level}><span className={'priority-pill '+p.level}>{p.priority}</span><small>{p.unit}</small><b>{p.title}</b><p>{p.fact}</p><p className="sl-act">→ {p.action}</p></article>)}</div>:<p className="sl-empty">Nenhuma prioridade alta ou média com os dados atuais.</p>;
 return text||<p className="sl-empty">Sem itens.</p>;
}
export function Slide({s,i,total,stores}:{s:DeckSlide;i:number;total:number;stores:Store[]}){return <article className={'slide2 '+s.layout}><header><span className="sl-kicker">{s.kicker}</span><span className="sl-num">{String(i+1).padStart(2,'0')} / {String(total).padStart(2,'0')}</span></header><h3>{s.ai?.title||s.title}</h3><div className="sl-body"><Body s={s} stores={stores}/></div><footer><span>{s.source}</span>{(s.ai?.note||s.note)&&<span className="sl-note">Nota: {s.ai?.note||s.note}</span>}<span className="sl-brand">MONDEPARS</span></footer>{s.ai?.unverified&&s.ai.unverified.length>0&&<p className="sl-warn no-print"><AlertTriangle size={13}/>Números do texto não localizados nos dados: {s.ai.unverified.join(', ')}</p>}</article>}
/** One slide at a time, keyboard and thumbnails; fullscreen to present; print = one landscape slide per page. */
export default function SlideViewer({slides,stores}:{slides:DeckSlide[];stores:Store[]}){
 const [i,setI]=useState(0),box=useRef<HTMLDivElement>(null),total=slides.length,cur=Math.min(i,total-1);
 // Print: every slide in a body-level root, one landscape page each (see .deck-print-root in globals.css).
 const [printing,setPrinting]=useState(false);
 useEffect(()=>{if(!printing)return;document.body.classList.add('printing-deck');const done=()=>{document.body.classList.remove('printing-deck');setPrinting(false)};window.addEventListener('afterprint',done,{once:true});const t=setTimeout(()=>window.print(),60);return()=>{clearTimeout(t);window.removeEventListener('afterprint',done);document.body.classList.remove('printing-deck')}},[printing]);
 const go=useCallback((n:number)=>setI(Math.max(0,Math.min(total-1,n))),[total]);
 useEffect(()=>{const el=box.current;if(!el)return;const k=(e:KeyboardEvent)=>{if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();go(cur+1)}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(cur-1)}};el.addEventListener('keydown',k);return()=>el.removeEventListener('keydown',k)},[cur,go]);
 if(!total)return null;
 return <div className="deck">
  <div className="deck-screen no-print" ref={box} tabIndex={0} aria-roledescription="apresentação" aria-label={`Slide ${cur+1} de ${total}: ${slides[cur].ai?.title||slides[cur].title}`}>
   <div className="deck-stage"><Slide s={slides[cur]} i={cur} total={total} stores={stores}/></div>
   <div className="deck-controls"><button type="button" className="btn secondary" onClick={()=>go(cur-1)} disabled={cur===0} aria-label="Slide anterior"><ChevronLeft size={17}/></button><span>{cur+1} de {total}</span><button type="button" className="btn secondary" onClick={()=>go(cur+1)} disabled={cur===total-1} aria-label="Próximo slide"><ChevronRight size={17}/></button><span className="deck-gap"/><button type="button" className="btn secondary" onClick={()=>{box.current?.requestFullscreen?.().catch(()=>{});box.current?.focus()}}><Maximize2 size={16}/>Apresentar</button><button type="button" className="btn secondary" onClick={()=>setPrinting(true)}><Printer size={16}/>Imprimir / PDF</button></div>
   <ol className="deck-thumbs">{slides.map((s,j)=><li key={s.id}><button type="button" className={j===cur?'on':''} aria-current={j===cur} onClick={()=>go(j)}><span>{String(j+1).padStart(2,'0')}</span>{s.kicker.charAt(0)+s.kicker.slice(1).toLowerCase()}</button></li>)}</ol>
  </div>
  {printing&&createPortal(<div className="deck-print-root">{slides.map((s,j)=><Slide key={s.id} s={s} i={j} total={total} stores={stores}/>)}</div>,document.body)}
 </div>
}
