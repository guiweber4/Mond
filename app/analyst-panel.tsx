'use client';
import {useState,useEffect,useRef} from 'react';
import {MessageSquareText,RefreshCw,Send,Database,RotateCcw,Square} from 'lucide-react';
import {exampleQuestions,type Answer} from '@/lib/analyst';
import type {ChatReply} from '@/lib/chat';
import {Markdown} from './ai-assist';
type Turn={role:'user';content:string}|{role:'assistant';content:string;reply:ChatReply};
const STORE='mondepars-chat';
/** Computed answer (no AI) shown inside the conversation. */
function Computed({a}:{a:Answer}){return <div className="chat-computed"><p className="analyst-scope"><MessageSquareText size={14} aria-hidden="true"/>{a.intentLabel} · {a.scope.period} · {a.scope.storeNames.join(', ')}</p><p className="analyst-headline">{a.headline}</p>{a.facts.length>0&&<ul>{a.facts.slice(0,6).map((f,i)=><li key={i}>{f}</li>)}</ul>}{a.recommendations.length>0&&<><b>O que fazer</b><ul>{a.recommendations.slice(0,3).map((x,i)=><li key={i}>{x}</li>)}</ul></>}{a.limitations.length>0&&<details className="fcard-more"><summary>Limites dos dados</summary><ul>{a.limitations.map((x,i)=><li key={i}>{x}</li>)}</ul></details>}</div>}
/** Text kept in the history for the model: the AI text, or a short version of the computed answer. */
const asText=(r:ChatReply)=>r.mode==='ia'?r.text:[r.answer.headline,...r.answer.facts.slice(0,4)].join('\n');
/** Chat about the operation: the AI queries sales, stock, purchases and findings through server tools. */
export default function AnalystPanel({channel,initial=''}:{channel:string;initial?:string}){
 const [turns,setTurns]=useState<Turn[]>(()=>{try{const x=typeof window!=='undefined'?sessionStorage.getItem(STORE):null;return x?JSON.parse(x):[]}catch{return []}});
 const [q,setQ]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),abort=useRef<AbortController|null>(null),end=useRef<HTMLDivElement>(null);
 useEffect(()=>{try{sessionStorage.setItem(STORE,JSON.stringify(turns.slice(-24)))}catch{}end.current?.scrollIntoView({block:'nearest'})},[turns]);
 async function ask(question:string){const text=question.trim();if(!text||busy)return;setQ('');setError('');const next:Turn[]=[...turns,{role:'user',content:text}];setTurns(next);setBusy(true);const ctrl=new AbortController();abort.current=ctrl;
  try{const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,body:JSON.stringify({channel,messages:next.slice(-12).map(t=>({role:t.role,content:t.role==='assistant'?asText(t.reply):t.content}))})});const j=await res.json().catch(()=>({error:'Resposta inválida do servidor.'}));if(!res.ok)throw new Error(j.error||'Não foi possível responder.');
   const reply=j as ChatReply;setTurns([...next,{role:'assistant',content:asText(reply),reply}])}
  catch(e){if((e as Error).name==='AbortError')setError('Pergunta cancelada.');else setError((e as Error).message);setTurns(next)}finally{setBusy(false);abort.current=null}}
 // A question picked in the global search is asked once on arrival.
 const asked=useRef('');useEffect(()=>{if(initial&&asked.current!==initial){asked.current=initial;ask(initial.replace(/#\d+$/,''))}},[initial]);// eslint-disable-line react-hooks/exhaustive-deps
 return <section className="panel analyst-panel chat" aria-busy={busy}>
  <div className="panel-head"><div><span className="eyebrow">ANALISTA</span><h2>Pergunte sobre a operação</h2><p>Pergunte o que quiser sobre vendas, estoque, grade e compras. A IA consulta os dados importados, mostra o que consultou e confere os números da resposta.</p></div>{turns.length>0&&<button type="button" className="btn secondary sm" disabled={busy} onClick={()=>{setTurns([]);setError('')}}><RotateCcw size={14}/>Nova conversa</button>}</div>
  <div className="chat-log" role="log" aria-live="polite">
   {!turns.length&&<div className="chat-empty"><p>Exemplos — qualquer pergunta funciona:</p><div className="analyst-chips">{['Qual cor mais vende em calças na BC?','Quanto a JK vendeu de camisetas e qual o preço médio?','Onde está o estoque do Perfume Kyoto e quanto devo comprar?',...exampleQuestions.slice(2,6)].map(x=><button type="button" key={x} className="chip" disabled={busy} onClick={()=>ask(x)}>{x}</button>)}</div></div>}
   {turns.map((t,i)=>t.role==='user'?<div key={i} className="chat-msg user"><p>{t.content}</p></div>:<div key={i} className="chat-msg bot">
    {t.reply.mode==='ia'?<><Markdown text={t.reply.text}/>{t.reply.calls.length>0&&<details className="chat-calls"><summary><Database size={13}/>Consultou: {t.reply.calls.map(c=>c.summary).join(' · ')}</summary><ul>{t.reply.calls.map((c,j)=><li key={j}><b>{c.summary}</b> <small>{Object.entries(c.args).filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>`${k}: ${String(v)}`).join(' · ')}</small></li>)}</ul></details>}
     {t.reply.calls.length===0&&<p className="warn-box">A IA respondeu sem consultar os dados; confira antes de usar.</p>}{t.reply.unverified.length>0&&<p className="warn-box">Números que não aparecem nos dados consultados: {t.reply.unverified.join(', ')}.</p>}<p className="chat-meta">{t.reply.provider} · {t.reply.model}{t.reply.usedFallback?' · conexão de reserva':''}</p></>
    :<>{t.reply.aiError?<p className="chat-meta">IA indisponível ({t.reply.aiError}). Resposta calculada pelas regras do sistema:</p>:<p className="chat-meta">Sem conexão de IA configurada: resposta calculada pelas regras do sistema. Peça ao administrador para cadastrar a chave em Inteligência artificial.</p>}<Computed a={t.reply.answer}/></>}
   </div>)}
   {busy&&<div className="chat-msg bot pending"><RefreshCw size={15} className="spin"/>Consultando os dados…<button type="button" className="text-button" onClick={()=>abort.current?.abort()}><Square size={12}/>Cancelar</button></div>}
   <div ref={end}/>
  </div>
  {error&&<p className="error-box" role="alert">{error}</p>}
  <form className="chat-form" onSubmit={e=>{e.preventDefault();ask(q)}}><label className="sr-only" htmlFor="chat-q">Pergunta</label><textarea id="chat-q" rows={2} maxLength={500} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(q)}}} placeholder="Ex.: Qual tamanho mais falta no estoque de calças?"/><button className="btn primary" type="submit" disabled={busy||!q.trim()}><Send size={16}/>Perguntar</button></form>
  <p className="chat-foot">Enter envia · Shift+Enter quebra linha. A conversa fica só neste navegador. Recomendações são para avaliar; nada é executado.</p>
 </section>
}
