/**
 * Executive presentation built from computed numbers: every slide carries its own data (KPIs, bars, models,
 * stock, priorities) and a computed message. AI only rewrites the message and bullets per slide id; anything
 * missing or invalid falls back to the computed text, and numbers the model adds are flagged.
 */
import {overviewData} from './overview-data';
import {computeInsights,type InsightInput} from './insights';
import {priorityLabels,type Finding} from './findings';
import {br} from './readiness';
import type {Stock,Store} from './model';
import type {Total} from './totals';
import {verifyNumbers} from './analyst';
export type Bar={label:string;value:number;display:string;unit?:string;muted?:boolean};
export type DeckSlide={id:string;layout:'cover'|'bars'|'models'|'stock'|'priorities'|'list';kicker:string;title:string;bullets:string[];note?:string;source:string;
 data?:{kpis?:{label:string;value:string}[];bars?:Bar[];models?:{model:string;reference:string;category:string;amount:string;qty:string;share:string;stores:{short:string;balance:number|null;state:string}[]}[];stock?:{short:string;positive:number;zero:number;negative:number;balance:string;str:string}[];sizes?:{over:string[];under:string[]};priorities?:{priority:string;level:string;unit:string;title:string;fact:string;action:string}[]};
 ai?:{title?:string;bullets?:string[];note?:string;unverified?:string[]}};
export type Deck={version:2;period:string;start:string;end:string;channel:string;createdAt:string;slides:DeckSlide[]};
const money=(v:number)=>Math.abs(v)>=1e6?`R$ ${(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})} mi`:Math.abs(v)>=1e4?`R$ ${(v/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0})} mil`:v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const n=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:1});
const pc=(v:number|null|undefined)=>v==null?'—':`${n(v)}%`;
export type DeckInput={totals:Total[];stock:Stock[];stores:Store[];channel?:string;today:string;period?:string;saved?:InsightInput['saved'];goals?:InsightInput['goals'];config?:InsightInput['config'];tables?:InsightInput['tables']};
export function buildDeck(i:DeckInput):Deck|null{
 const channel=i.channel||'all',o=overviewData({totals:i.totals,stock:i.stock,stores:i.stores,channel,period:i.period});if(!o)return null;
 const {insights,readiness}=computeInsights({totals:i.totals,stock:i.stock,stores:i.stores,today:i.today,period:o.period,saved:i.saved,goals:i.goals,config:i.config,tables:i.tables});
 const inScope=(f:Finding)=>channel==='all'||f.store===channel||f.to===channel||f.from===channel;
 const period=`${br(o.start)} a ${br(o.end)}`,scope=channel==='all'?'todas as unidades com arquivo':i.stores.find(s=>s.id===channel)?.name||channel;
 const units=o.unitsData.filter(u=>u.hasData).sort((a,b)=>b.amount-a.amount),lead=units[0],cat=o.categories[0];
 const top5=o.highlights.slice(0,5),top5share=top5.reduce((s,h)=>s+(h.share||0),0);
 const pri=insights.filter(f=>inScope(f)&&f.kind!=='dados'&&f.priority!=='baixa').slice(0,4),alta=insights.filter(f=>inScope(f)&&f.kind!=='dados'&&f.priority==='alta').length;
 const over=o.sizeCurve.filter(s=>s.stock-s.sold>=1.5).map(s=>s.size),under=o.sizeCurve.filter(s=>s.sold-s.stock>=1.5).map(s=>s.size);
 const neg=o.stockHealth.reduce((s,u)=>s+u.negative,0);
 const approved=(i.saved||[]).filter(s=>s.dataset==='real'&&s.status==='approved').map(s=>{try{const p=JSON.parse(s.payload);return `${p.title}${p.owner?` · ${p.owner}`:''}${p.due?` · até ${br(p.due)}`:''}`}catch{return ''}}).filter(Boolean);
 const slides:DeckSlide[]=[
  {id:'capa',layout:'cover',kicker:'APRESENTAÇÃO EXECUTIVA',title:`Resultado de ${period}`,bullets:[lead&&units.length>1?`${lead.short} lidera com ${pc(lead.share)} das vendas.`:'',cat?`${cat.name} é a categoria de maior valor (${pc(cat.share)}).`:'',o.missing.length?`Sem arquivo de vendas: ${o.missing.join(', ')} (não é venda zero).`:''].filter(Boolean),source:`Totalização por produto · ${scope}`,
   data:{kpis:[{label:'Vendas',value:money(o.amount)},{label:'Peças líquidas',value:n(o.units)},{label:'Preço médio por peça',value:o.avg===null?'—':money(o.avg)},{label:'Saldo em estoque',value:o.stockBalance===null?'—':n(o.stockBalance)}]}},
  {id:'unidades',layout:'bars',kicker:'UNIDADES',title:lead?(units.length>1?`${lead.short} responde por ${pc(lead.share)} das vendas`:`${lead.short}: ${money(lead.amount)} no período`):'Sem vendas por unidade',bullets:units.map(u=>`${u.short}: ${money(u.amount)} · ${n(u.qty)} peças · ${u.avg===null?'—':money(u.avg)} por peça`).slice(0,4),source:'Participação no valor do período',
   data:{bars:o.unitsData.map(u=>({label:u.short,value:u.hasData?u.amount:0,display:u.hasData?`${money(u.amount)} · ${pc(u.share)}`:'sem arquivo',unit:u.id,muted:!u.hasData}))}},
  {id:'categorias',layout:'bars',kicker:'CATEGORIAS',title:cat?`${cat.name} lidera com ${pc(cat.share)} do valor`:'Categorias',bullets:o.categories.slice(0,3).map(c=>`${c.name}: ${money(c.amount)} · ${n(c.qty)} peças`),source:'Valor por categoria (NM_GRUPO da Presence)',
   data:{bars:o.categories.map(c=>({label:c.name,value:c.amount,display:`${money(c.amount)} · ${pc(c.share)}`}))}},
  {id:'destaques',layout:'models',kicker:'PEÇAS EM DESTAQUE',title:`5 modelos somam ${pc(Math.round(top5share*10)/10)} das vendas`,bullets:top5.filter(h=>h.stores.some(s=>s.state==='sem_saldo')).slice(0,2).map(h=>`${h.model} vendeu ${n(h.qty)} peças e está sem saldo em ${h.stores.filter(s=>s.state==='sem_saldo').map(s=>s.short).join(', ')}.`),source:'Modelos de maior valor; saldo na última posição',
   data:{models:top5.map(h=>({model:h.model,reference:h.reference,category:h.category,amount:money(h.amount),qty:n(h.qty),share:pc(h.share),stores:h.stores.map(s=>({short:s.short,balance:s.balance,state:s.state}))}))}},
  {id:'estoque',layout:'stock',kicker:'ESTOQUE',title:o.stockBalance===null?'Sem posição de estoque importada':`Saldo de ${n(o.stockBalance)} peças em ${o.stockHealth.length} ${o.stockHealth.length===1?'unidade':'unidades'}`,bullets:[under.length?`Vende mais do que tem em estoque: ${under.join(', ')}.`:'',over.length?`Tem mais em estoque do que vende: ${over.join(', ')}.`:'',neg?`${n(neg)} variações com saldo negativo para conferir.`:''].filter(Boolean),source:`Saldo Base por unidade · posições ${o.stockDates.map(s=>`${s.short} ${br(s.date)}`).join(', ')||'—'}`,
   data:{stock:o.stockHealth.map(s=>({short:s.short,positive:s.positive,zero:s.zero,negative:s.negative,balance:n(s.balance),str:pc(s.str)})),sizes:{over,under}}},
  {id:'prioridades',layout:'priorities',kicker:'PRIORIDADES',title:alta?`${alta} ${alta===1?'ponto':'pontos'} de prioridade alta`:'Prioridades do período',bullets:[],source:'Achados calculados; recomendações para avaliar, nada é executado',
   data:{priorities:pri.map(f=>({priority:priorityLabels[f.priority],level:f.priority,unit:f.storeName.split(' · ')[0],title:f.reference?`${f.title} · ${f.reference}`:f.title,fact:((f.reference?f.evidence[0]:f.fact)||f.evidence[0]||'').slice(0,180),action:f.action||f.suggestion}))}},
  {id:'limites',layout:'list',kicker:'LIMITES DOS DADOS',title:'O que os dados ainda não permitem afirmar',bullets:readiness.limitations.slice(0,5),source:'Diagnóstico da base usada'},
  {id:'proximos',layout:'list',kicker:'PRÓXIMOS PASSOS',title:approved.length?`${approved.length} ${approved.length===1?'ação aprovada':'ações aprovadas'} em andamento`:'Próximos passos sugeridos',bullets:[...approved.slice(0,3),...pri.slice(0,4-Math.min(3,approved.length)).map(f=>`${f.action||f.suggestion} (${f.storeName.split(' · ')[0]})`)].slice(0,5),source:'Plano de ação'},
 ];
 return {version:2,period,start:o.start,end:o.end,channel:scope,createdAt:new Date().toISOString(),slides};
}
/** What the model receives: slide ids with their computed message, bullets and numbers. */
export function deckContext(d:Deck){return JSON.stringify({periodo:d.period,unidades:d.channel,slides:d.slides.map(s=>({id:s.id,tema:s.kicker,mensagemCalculada:s.title,marcadores:s.bullets,dados:s.data}))})}
/** `## [id] Mensagem` blocks with `- ` bullets and an optional `> Nota:`. Unknown ids are ignored. */
export function parseDeckText(text:string){const out=new Map<string,{title:string;bullets:string[];note:string}>();
 for(const block of text.split(/^##\s+/m).slice(1)){const [head,...lines]=block.split('\n');const m=head.match(/^\[([a-z]+)\]\s*(.*)$/i);if(!m)continue;const title=m[2].replace(/\*\*/g,'').trim();
  out.set(m[1].toLowerCase(),{title,bullets:lines.map(l=>l.trim()).filter(l=>/^[-*•]\s+/.test(l)).map(l=>l.replace(/^[-*•]\s+/,'').replace(/\*\*/g,'')).slice(0,3),note:lines.map(l=>l.trim()).find(l=>/^>\s*/.test(l))?.replace(/^>\s*(Nota:)?\s*/i,'')||''})}
 return out}
/** Applies the model's text per slide when valid; keeps computed text otherwise and flags unverifiable numbers. */
export function mergeDeckText(d:Deck,text:string,context=deckContext(d)):Deck{const parsed=parseDeckText(text);
 return {...d,slides:d.slides.map(s=>{const p=parsed.get(s.id);if(!p||!p.title||p.title.length>140||p.bullets.some(b=>b.length>220))return s;const unverified=verifyNumbers([p.title,...p.bullets,p.note].join('\n'),context);return {...s,ai:{title:p.title,bullets:p.bullets.length?p.bullets:undefined,note:p.note||undefined,unverified}}})}}
/** Old presentations (AI bullets only, before version 2) open in the same viewer as list slides. */
export function toSlides(deck?:Deck|null,legacy?:{title:string;bullets:string[];note:string}[]):DeckSlide[]{if(deck?.slides?.length)return deck.slides;return (legacy||[]).map((s,i)=>({id:`s${i}`,layout:'list' as const,kicker:'APRESENTAÇÃO EXECUTIVA',title:s.title,bullets:s.bullets,note:s.note,source:'Texto gerado com IA a partir dos números calculados'}))}
