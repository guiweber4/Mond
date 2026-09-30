'use client';
import {Database} from 'lucide-react';
import {br,type Readiness} from '@/lib/readiness';
const status={disponivel:'Disponível',parcial:'Parcial',indisponivel:'Indisponível'} as const;
/** What the analyses are based on: period, comparison, stock dates, gaps and which analyses the base supports. */
export default function DataReadiness({readiness:r}:{readiness:Readiness}){
 return <section className="panel readiness-panel">
  <div className="panel-head"><div><span className="eyebrow">BASE DA ANÁLISE</span><h2>Com quais dados estas análises foram feitas</h2><p>Dados ausentes limitam as conclusões; nada é preenchido por suposição.</p></div><Database size={20} aria-hidden="true"/></div>
  <dl className="readiness-facts">
   <div><dt>Vendas</dt><dd>{r.period?`${br(r.period.start)} a ${br(r.period.end)}${r.period.partial?' (parcial)':''}`:'Não importadas'}</dd></div>
   <div><dt>Comparação</dt><dd>{r.previous?`${br(r.previous.start)} a ${br(r.previous.end)} · ${r.previous.label}`:'Sem período anterior equivalente'}</dd></div>
   <div><dt>Estoque</dt><dd>{r.stockDates.length?r.stockDates.map(s=>`${s.name.split(' · ')[0]} ${br(s.date)}`).join(' · '):'Não importado'}</dd></div>
   <div><dt>Unidades com vendas</dt><dd>{r.salesStores.length||'—'}{r.returns?` · ${r.returns.negativeRows} linhas de devolução/ajuste preservadas`:''}</dd></div>
  </dl>
  {r.limitations.length>0&&<ul className="readiness-limits">{r.limitations.map((l,i)=><li key={i}>{l}</li>)}</ul>}
  <details className="fcard-more"><summary>Análises disponíveis com esta base</summary><table className="rv-table"><thead><tr><th>Análise</th><th>Situação</th><th>Motivo / o que falta</th></tr></thead><tbody>{r.capabilities.map(c=><tr key={c.id}><td>{c.label}</td><td><span className={'badge '+(c.status==='disponivel'?'ok':c.status==='parcial'?'risk':'outdated')}>{status[c.status]}</span></td><td>{c.reason}{c.missing.length?<small> Falta: {c.missing.join(', ')}.</small>:null}</td></tr>)}</tbody></table></details>
 </section>
}
