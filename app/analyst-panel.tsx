'use client';
import {useState} from 'react';
import {MessageSquareText,Sparkles,RefreshCw,Send} from 'lucide-react';
import {requestJson} from '@/lib/request';
import {exampleQuestions,type Answer} from '@/lib/analyst';
import {Markdown} from './ai-assist';
type Result={answer:Answer;ai?:{text:string;provider:string;model:string;unverified:string[]};aiError?:string};
/** Questions answered by the rules engine first; AI (optional) only rewrites the computed answer. */
export default function AnalystPanel({channel}:{channel:string}){
 const [q,setQ]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[r,setR]=useState<Result|null>(null);
 async function ask(question:string,withAI=false){if(!question.trim())return;setQ(question);setBusy(withAI?'ai':'rules');setError('');try{setR(await requestJson('/api/insights',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ask',question,channel,withAI})},withAI?110000:30000) as Result)}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 const a=r?.answer;
 return <section className="panel analyst-panel" aria-busy={!!busy}>
  <div className="panel-head"><div><span className="eyebrow">ANALISTA</span><h2>Pergunte sobre vendas e estoque</h2><p>A resposta vem das regras e dos números calculados, com período, unidades, fatos, hipóteses e limites. A IA é opcional e só redige a mesma resposta.</p></div></div>
  <form className="analyst-form" onSubmit={e=>{e.preventDefault();ask(q)}}><label className="sr-only" htmlFor="analyst-q">Pergunta</label><input id="analyst-q" maxLength={500} value={q} onChange={e=>setQ(e.target.value)} placeholder="Ex.: O que explica a queda de vendas da JK?"/><button className="btn primary" type="submit" disabled={!!busy||!q.trim()}>{busy==='rules'?<RefreshCw size={16} className="spin"/>:<Send size={16}/>}Perguntar</button></form>
  <div className="analyst-chips">{exampleQuestions.map(x=><button type="button" key={x} className="chip" disabled={!!busy} onClick={()=>ask(x)}>{x}</button>)}</div>
  {error&&<p className="error-box" role="alert">{error}</p>}
  {a&&<div className="analyst-answer">
   <p className="analyst-scope"><MessageSquareText size={15} aria-hidden="true"/>{a.intentLabel} · Período {a.scope.period}{a.scope.periodSource==='padrao'?' (mais recente importado)':''} · {a.scope.storeNames.join(', ')}{a.scope.category?` · ${a.scope.category}`:''}{a.scope.stock.length?` · Estoque: ${a.scope.stock.join(', ')}`:''}</p>
   <p className="analyst-headline">{a.headline}</p>
   {a.facts.length>0&&<div className="analyst-block"><h3>Fatos</h3><ul>{a.facts.map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
   {a.hypotheses.length>0&&<div className="analyst-block hyp"><h3>Hipóteses (não comprovadas)</h3><ul>{a.hypotheses.map((h,i)=><li key={i}>{h.text}{h.support?<small> Apoio: {h.support}</small>:null}{h.validateWith.length?<small> Validar com: {h.validateWith.join(', ')}.</small>:null}</li>)}</ul></div>}
   {a.recommendations.length>0&&<div className="analyst-block"><h3>O que fazer</h3><ul>{a.recommendations.map((x,i)=><li key={i}>{x}</li>)}</ul><small>Recomendações para avaliar; nada é executado automaticamente.</small></div>}
   {a.limitations.length>0&&<div className="analyst-block lim"><h3>Limites dos dados</h3><ul>{a.limitations.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
   {a.evidence.length>0&&<details className="fcard-more"><summary>Evidências ({a.evidence.length})</summary><ul>{a.evidence.map(e=><li key={e.id}><b>{e.title}</b> — {e.fact}</li>)}</ul></details>}
   <div className="analyst-ai"><button type="button" className="btn secondary" disabled={!!busy} onClick={()=>ask(q,true)}>{busy==='ai'?<RefreshCw size={16} className="spin"/>:<Sparkles size={16}/>}{busy==='ai'?'Redigindo… (até 1 min)':'Redigir com IA'}</button>
    {r?.aiError&&<p className="helper">IA indisponível: {r.aiError} A resposta acima continua válida.</p>}
    {r?.ai&&<div className="ai-result"><Markdown text={r.ai.text}/>{r.ai.unverified.length>0&&<p className="warn-box">Números no texto que não aparecem nos dados calculados: {r.ai.unverified.join(', ')}. Confira antes de usar.</p>}<p className="helper">{r.ai.provider} · {r.ai.model} · leitura consultiva da resposta calculada.</p></div>}
   </div>
  </div>}
 </section>
}
