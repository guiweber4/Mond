'use client';
import {useState} from 'react';
import {Sparkles,RefreshCw,Printer} from 'lucide-react';
import {requestJson} from '@/lib/request';
import {toast} from 'sonner';
export type Slide={title:string;bullets:string[];note:string};
type Result={text:string;provider:string;model:string;usedFallback?:boolean;input?:number|null;output?:number|null;slides?:Slide[];reportId?:string};
/** One AI purpose, generated on demand from the server-side context. Consultative text; nothing is executed. */
export default function AIAssist({purpose,title,description,params,cta='Gerar com IA',onDone}:{purpose:'analysis'|'report'|'executive'|'planning'|'actions';title:string;description:string;params:Record<string,unknown>;cta?:string;onDone?:(r:Result)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null);
 async function run(){setBusy(true);setError('');try{const r=await requestJson('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate',purpose,...params})},110000) as Result;setResult(r);onDone?.(r);toast.success(purpose==='executive'?'Apresentação gerada e salva em Relatórios.':purpose==='report'?'Leitura anexada ao relatório.':'Análise concluída.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="panel ai-assist" aria-busy={busy}>
  <div className="panel-head"><div><span className="eyebrow">INTELIGÊNCIA ARTIFICIAL</span><h2>{title}</h2><p>{description}</p></div><button type="button" className="btn primary" disabled={busy} onClick={run}>{busy?<RefreshCw size={17} className="spin"/>:<Sparkles size={17}/>}{busy?'Gerando… (até 1 min)':result?'Gerar novamente':cta}</button></div>
  {error&&<p className="error-box" role="alert">{error}</p>}
  {result&&<div className="ai-result">{result.slides?.length?<SlideDeck slides={result.slides}/>:parseCards(result.text).length?<AICards cards={parseCards(result.text)}/>:<Markdown text={result.text}/>}<p className="helper">{result.provider} · {result.model}{result.usedFallback?' · conexão de reserva':''} · leitura consultiva baseada nos números calculados pelo sistema. Revise antes de decidir; nenhuma ação é executada.</p></div>}
 </section>
}
export function SlideDeck({slides}:{slides:Slide[]}){return <div className="slide-deck"><div className="no-print slide-actions"><button type="button" className="btn secondary" onClick={()=>window.print()}><Printer size={16}/>Imprimir / salvar PDF</button></div>{slides.map((s,i)=><article className="slide" key={i}><span className="slide-number">{String(i+1).padStart(2,'0')}</span><h3>{s.title}</h3><ul>{s.bullets.map((b,j)=><li key={j}>{b}</li>)}</ul>{s.note&&<p className="slide-note">Nota: {s.note}</p>}</article>)}</div>}
export type AICard={title:string;priority:string;unit:string;finding:string;suggestion:string;owner:string;due:string;check:string};
const field=(block:string,label:string)=>block.match(new RegExp(`^\\s*[-*]?\\s*\\**${label}\\**\\s*:\\s*(.+)$`,'im'))?.[1].replace(/\*\*/g,'').trim()||'';
/** "### Title" blocks with "Label: value" lines, as requested from the model for plans. */
export function parseCards(text:string):AICard[]{return text.split(/^#{2,4}\s+/m).slice(1).map(b=>{const title=b.split('\n')[0].replace(/\*\*/g,'').trim();return {title,priority:field(b,'Prioridade'),unit:field(b,'Unidade'),finding:field(b,'Achado'),suggestion:field(b,'Sugest[aã]o'),owner:field(b,'Respons[aá]vel(?: sugerido)?'),due:field(b,'Prazo(?: sugerido)?'),check:field(b,'Como validar')}}).filter(c=>c.title&&c.suggestion)}
const level=(p:string)=>/alta/i.test(p)?'alta':/m[eé]dia/i.test(p)?'media':'baixa';
export function AICards({cards}:{cards:AICard[]}){return <div className="finding-grid">{cards.map((c,i)=><article key={i} className={'finding-card '+level(c.priority)}><header><span className="finding-kind">{c.unit||'Rede'}</span>{c.priority&&<span className={'priority-pill '+level(c.priority)}>{c.priority}</span>}</header><h3>{c.title}</h3>{c.finding&&<div className="finding-evidence"><span>O que vimos</span><p>{c.finding}</p></div>}<div className="finding-suggestion"><p><strong>Sugestão:</strong> {c.suggestion}</p></div><footer className="ai-card-meta">{c.owner&&<small><b>Responsável:</b> {c.owner}</small>}{c.due&&<small><b>Prazo:</b> {c.due}</small>}{c.check&&<small><b>Como validar:</b> {c.check}</small>}</footer></article>)}</div>}
/** Minimal, safe rendering of the model's markdown (headings, bullets, bold). No HTML is injected. */
export function Markdown({text}:{text:string}){
 const inline=(s:string)=>s.split(/(\*\*[^*]+\*\*)/g).map((p,i)=>p.startsWith('**')&&p.endsWith('**')?<strong key={i}>{p.slice(2,-2)}</strong>:p);
 const out:React.ReactNode[]=[];let list:string[]=[];const flush=()=>{if(list.length){out.push(<ul key={out.length}>{list.map((l,i)=><li key={i}>{inline(l)}</li>)}</ul>);list=[]}};
 for(const raw of text.split('\n')){const line=raw.trim();if(!line){flush();continue}const h=line.match(/^#{1,4}\s+(.*)$/);if(h){flush();out.push(<h4 key={out.length}>{inline(h[1].replace(/\*\*/g,''))}</h4>);continue}const b=line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);if(b){list.push(b[1]);continue}flush();out.push(<p key={out.length}>{inline(line)}</p>)}
 flush();return <div className="ai-markdown">{out}</div>;
}
