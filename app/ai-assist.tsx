'use client';
import {useState} from 'react';
import {Sparkles,RefreshCw} from 'lucide-react';
import {requestJson} from '@/lib/request';
import {toast} from 'sonner';
import SlideViewer,{toSlides} from './slide-viewer';
import type {Deck} from '@/lib/executive-deck';
import type {Store} from '@/lib/model';
export type Slide={title:string;bullets:string[];note:string};
type Result={deck?:Deck;unverified?:string[];text:string;provider:string;model:string;usedFallback?:boolean;input?:number|null;output?:number|null;slides?:Slide[];reportId?:string};
/** One AI purpose, generated on demand from the server-side context. Consultative text; nothing is executed. */
export default function AIAssist({purpose,title,description,params,cta='Gerar com IA',onDone,stores=[]}:{purpose:'analysis'|'report'|'executive'|'planning'|'actions';title:string;description:string;params:Record<string,unknown>;cta?:string;onDone?:(r:Result)=>void;stores?:Store[]}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null);
 async function run(){setBusy(true);setError('');try{const r=await requestJson('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate',purpose,...params})},110000) as Result;setResult(r);onDone?.(r);toast.success(purpose==='executive'?'Apresentação gerada e salva em Relatórios.':purpose==='report'?'Leitura anexada ao relatório.':'Análise concluída.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="panel ai-assist" aria-busy={busy}>
  <div className="panel-head"><div><span className="eyebrow">INTELIGÊNCIA ARTIFICIAL</span><h2>{title}</h2><p>{description}</p></div><button type="button" className="btn primary" disabled={busy} onClick={run}>{busy?<RefreshCw size={17} className="spin"/>:<Sparkles size={17}/>}{busy?'Gerando… (até 1 min)':result?'Gerar novamente':cta}</button></div>
  {error&&<p className="error-box" role="alert">{error}</p>}
  {result&&<details className="ai-result-wrap" open><summary>Resultado gerado · {result.provider} · {result.model}</summary><div className="ai-result">{result.deck||result.slides?.length?<SlideViewer slides={toSlides(result.deck,result.slides)} stores={stores}/>:parseCards(result.text).length?<AICards cards={parseCards(result.text)}/>:<Markdown text={result.text}/>}{result.unverified&&result.unverified.length>0&&<p className="warn-box">Números no texto que não aparecem nos dados calculados: {result.unverified.join(', ')}. Confira antes de usar.</p>}<p className="helper">{result.provider} · {result.model}{result.usedFallback?' · conexão de reserva':''} · leitura consultiva baseada nos números calculados pelo sistema. Revise antes de decidir; nenhuma ação é executada.</p></div></details>}
 </section>
}
export type AICard={title:string;priority:string;unit:string;finding:string;suggestion:string;owner:string;due:string;check:string};
const field=(block:string,label:string)=>block.match(new RegExp(`^\\s*[-*]?\\s*\\**${label}\\**\\s*:\\s*(.+)$`,'im'))?.[1].replace(/\*\*/g,'').trim()||'';
/** "### Title" blocks with "Label: value" lines, as requested from the model for plans. */
export function parseCards(text:string):AICard[]{return text.split(/^#{2,4}\s+/m).slice(1).map(b=>{const title=b.split('\n')[0].replace(/\*\*/g,'').trim();return {title,priority:field(b,'Prioridade'),unit:field(b,'Unidade'),finding:field(b,'Achado'),suggestion:field(b,'Sugest[aã]o'),owner:field(b,'Respons[aá]vel(?: sugerido)?'),due:field(b,'Prazo(?: sugerido)?'),check:field(b,'Como validar')}}).filter(c=>c.title&&c.suggestion)}
const level=(p:string)=>/alta/i.test(p)?'alta':/m[eé]dia/i.test(p)?'media':'baixa';
export function AICards({cards}:{cards:AICard[]}){return <div className="fcard-grid ai-cards">{cards.map((c,i)=><article key={i} className={'fcard '+level(c.priority)}><div className="fcard-top">{c.priority&&<span className={'priority-pill '+level(c.priority)}>{c.priority}</span>}<span className="fcard-unit">{c.unit||'Rede'}</span></div><h4>{c.title}</h4>{c.finding&&<p className="fcard-sub">{c.finding}</p>}<div className="fcard-action"><strong>{c.suggestion}</strong></div>{(c.owner||c.due||c.check)&&<details className="fcard-more"><summary>Responsável, prazo e validação</summary><ul>{c.owner&&<li><b>Responsável:</b> {c.owner}</li>}{c.due&&<li><b>Prazo:</b> {c.due}</li>}{c.check&&<li><b>Como validar:</b> {c.check}</li>}</ul></details>}</article>)}</div>}
/** Minimal, safe rendering of the model's markdown (headings, bullets, bold). No HTML is injected. */
export function Markdown({text}:{text:string}){
 const inline=(s:string)=>s.split(/(\*\*[^*]+\*\*)/g).map((p,i)=>p.startsWith('**')&&p.endsWith('**')?<strong key={i}>{p.slice(2,-2)}</strong>:p);
 const out:React.ReactNode[]=[];let list:string[]=[];const flush=()=>{if(list.length){out.push(<ul key={out.length}>{list.map((l,i)=><li key={i}>{inline(l)}</li>)}</ul>);list=[]}};
 for(const raw of text.split('\n')){const line=raw.trim();if(!line){flush();continue}const h=line.match(/^#{1,4}\s+(.*)$/);if(h){flush();out.push(<h4 key={out.length}>{inline(h[1].replace(/\*\*/g,''))}</h4>);continue}const b=line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);if(b){list.push(b[1]);continue}flush();out.push(<p key={out.length}>{inline(line)}</p>)}
 flush();return <div className="ai-markdown">{out}</div>;
}
