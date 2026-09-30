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
  {result&&<div className="ai-result">{result.slides?.length?<SlideDeck slides={result.slides}/>:<div className="ai-prose">{result.text}</div>}<p className="helper">{result.provider} · {result.model}{result.usedFallback?' · conexão de reserva':''} · leitura consultiva baseada nos números calculados pelo sistema. Revise antes de decidir; nenhuma ação é executada.</p></div>}
 </section>
}
export function SlideDeck({slides}:{slides:Slide[]}){return <div className="slide-deck"><div className="no-print slide-actions"><button type="button" className="btn secondary" onClick={()=>window.print()}><Printer size={16}/>Imprimir / salvar PDF</button></div>{slides.map((s,i)=><article className="slide" key={i}><span className="slide-number">{String(i+1).padStart(2,'0')}</span><h3>{s.title}</h3><ul>{s.bullets.map((b,j)=><li key={j}>{b}</li>)}</ul>{s.note&&<p className="slide-note">Nota: {s.note}</p>}</article>)}</div>}
