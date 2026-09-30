/**
 * Conversational analyst over the insights engine. Flow: intent + period + scope → permissions → metrics and insights
 * → sufficiency check → grounded answer (fact first, numbers, actions) with evidence. Works without AI; when a model
 * is available it only rewrites this structured answer, and its numbers are checked against the context.
 */
import {computeInsights,diffInsights,type Insight,type InsightInput,type Snapshot} from './insights';
import {metricBrief,type MetricId} from './metrics';
import {searchKey} from './catalog';
import {br,type Capability} from './readiness';
import type {Hypothesis} from './findings';
export type Intent='desempenho'|'mix'|'grade'|'excesso'|'transferencia'|'prioridades'|'apostas'|'compras'|'mudancas'|'ecommerce';
export const intentLabels:Record<Intent,string>={desempenho:'Desempenho de vendas',mix:'Categorias e modelos',grade:'Cores, tamanhos e grade',excesso:'Estoque alto e pouca saída',transferencia:'Transferências entre unidades',prioridades:'Prioridades comerciais',apostas:'Apostas da coleção',compras:'Compras e pedidos',mudancas:'O que mudou',ecommerce:'E-commerce'};
export const exampleQuestions=['O que explica a queda de vendas da JK?','Dentro de calças, quais modelos perderam participação?','Quais cores e tamanhos merecem atenção?','Quais produtos têm estoque alto e pouca saída?','O que devemos avaliar para transferir entre RJ e JK?','Quais são as prioridades comerciais desta semana?','Como as apostas da coleção estão performando?','O que mudou desde o último relatório?'];
const months=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const has=(q:string,re:RegExp)=>re.test(q);
export function parseQuestion(question:string,ctx:{stores:{id:string;name:string;type:string}[];categories:string[];periods:{start:string;end:string}[]}){
 const q=' '+searchKey(question).replace(/[^\p{L}\p{N}]+/gu,' ')+' ';
 const stores=ctx.stores.filter(s=>{const short=searchKey(s.name.split(' · ')[0]),words=[short,searchKey(s.id),...(s.type==='online'?['ecommerce','e commerce','site','online','loja virtual']:[])].filter(w=>w.length>=2);return words.some(w=>q.includes(` ${w} `))}).map(s=>s.id);
 const stem=(w:string)=>w.replace(/(oes|aes|s)$/,'');const category=ctx.categories.find(c=>{const k=stem(searchKey(c).trim());return k.length>=3&&q.split(' ').some(w=>w&&stem(w)===k)});
 let intent:Intent='prioridades';
 if(has(q,/ mudou | mudanca| desde o ultimo| ultimo relatorio| novidade/))intent='mudancas';
 else if(has(q,/ aposta| colecao| colecoes/))intent='apostas';
 else if(has(q,/ compra| pedidos? de compra| fornecedor| otb /))intent='compras';
 else if(has(q,/ transfer| remanej| realoc| entre (as )?(lojas|unidades)/))intent='transferencia';
 else if(has(q,/ estoque alto| pouca saida| parad| encalh| excesso| sobra/))intent='excesso';
 else if(has(q,/ cor | cores | tamanho| grade /))intent='grade';
 else if(has(q,/ participac| mix | categoria/)||category&&has(q,/ modelo/))intent='mix';
 else if(has(q,/ queda| caiu| cair| cresc| subiu| vendas| vendeu| resultado| meta | desempenho| explica/))intent='desempenho';
 else if(stores.some(id=>ctx.stores.find(s=>s.id===id)?.type==='online')&&!has(q,/ priorid/))intent='ecommerce';
 const m=months.findIndex(x=>q.includes(` ${x} `));let period:string|undefined,periodNote='';
 if(m>=0){const p=[...ctx.periods].reverse().find(p=>Number(p.start.slice(5,7))===m+1);if(p)period=`${p.start}|${p.end}`;else periodNote=`Não há totalização importada para ${months[m]}; usei o período mais recente.`}
 if(has(q,/ semana| hoje| ontem/)&&!period)periodNote='As vendas importadas são totalizações por período; não há recorte por dia ou semana. Usei o período mais recente.';
 return {intent,stores,category,period,periodNote};
}
export type AskInput=InsightInput&{question:string;channel?:string;allowedStores?:string[]|null;previous?:{snapshot:Snapshot[];title:string;createdAt:string}|null};
export type Answer={question:string;intent:Intent;intentLabel:string;scope:{stores:string[];storeNames:string[];category?:string;period:string;periodSource:'pergunta'|'padrao';stock:string[]};headline:string;facts:string[];hypotheses:Hypothesis[];recommendations:string[];limitations:string[];evidence:{id:string;title:string;kind:string;priority:string;fact:string}[];metricIds:MetricId[];capabilities:Capability[]};
/** Removes other units' data before any calculation, so network totals, evidence and caches only contain allowed units. */
export function restrictInput<T extends InsightInput>(input:T,allowed?:string[]|null):T{if(!allowed)return input;const ok=new Set(allowed);return {...input,stores:input.stores.filter(s=>ok.has(s.id)),totals:input.totals.filter(t=>ok.has(t.store)),stock:input.stock.filter(s=>ok.has(s.store)),goals:input.goals?.filter(g=>ok.has(g.store)),purchases:input.purchases?.filter(p=>ok.has(p.store)),saved:input.saved?.filter(s=>{try{const p=JSON.parse(s.payload);return [p.store,p.from,p.to].filter(Boolean).every((x:string)=>ok.has(x))}catch{return false}})}}
const frontsOf:Record<Intent,string[]>={desempenho:['desempenho','rankings'],mix:['mix','rankings'],grade:['grade'],excesso:['grade'],transferencia:['transferencias'],prioridades:[],apostas:['apostas'],compras:['compras'],mudancas:[],ecommerce:['ecommerce']};
export function answerQuestion(input:AskInput):{answer:Answer;insights:Insight[]}{
 const scoped=restrictInput(input,input.allowedStores);
 const periods=[...new Set(scoped.totals.map(t=>`${t.start}|${t.end}`))].map(k=>({start:k.split('|')[0],end:k.split('|')[1]})).sort((a,b)=>a.end.localeCompare(b.end));
 const parsed=parseQuestion(input.question,{stores:input.stores,categories:[...new Set(scoped.totals.map(t=>t.category))],periods});
 const denied=parsed.stores.filter(s=>input.allowedStores&&!input.allowedStores.includes(s));
 let stores=parsed.stores.filter(s=>!denied.includes(s));if(!stores.length&&input.channel&&input.channel!=='all')stores=[input.channel];
 const {insights,readiness:rd}=computeInsights({...scoped,period:parsed.period||input.period});
 const inScope=(f:Insight)=>!stores.length||stores.some(s=>f.store===s||f.from===s||f.to===s)||(f.store==='all'&&(f.scope?.stores||[]).some(s=>stores.includes(s)));
 const local=(f:Insight)=>!stores.length||stores.some(s=>f.store===s||f.from===s||f.to===s);
 const cat=(f:Insight)=>!parsed.category||f.category===parsed.category||f.scope?.category===parsed.category;
 const sel=(kinds:string[],pred:(f:Insight)=>boolean=()=>true)=>insights.filter(f=>kinds.includes(f.kind)&&inScope(f)&&pred(f));
 let picked:Insight[]=[];const extraLimits:string[]=[];const extraFacts:string[]=[];
 switch(parsed.intent){
  case 'desempenho':{const own=sel(['desempenho'],local),net=sel(['desempenho'],f=>f.store==='all');if(stores.length&&!own.some(f=>f.id.startsWith('desempenho:'))){const lines=net.flatMap(f=>f.evidence).filter(l=>stores.some(s=>l.startsWith(input.stores.find(x=>x.id===s)?.name||'#')));extraFacts.push(`${rd.previous?'Sem variação relevante calculada':'Sem período anterior equivalente importado, não há queda ou alta calculada'} para ${stores.map(s=>input.stores.find(x=>x.id===s)?.name.split(' · ')[0]||s).join(', ')}.`,...lines)}picked=[...own,...net,...sel(['ranking'],f=>f.id.startsWith('ranking:queda')),...sel(['ruptura','reposicao'],f=>stores.length>0&&local(f)).slice(0,3)];break}
  case 'mix':picked=[...sel(['mix'],cat),...sel(['ranking'],f=>f.id.startsWith('ranking:queda'))];if(parsed.category&&!picked.some(f=>f.scope?.category===parsed.category))extraFacts.push(`Sem ${rd.previous?'perda de participação acima do limite configurado':'período anterior equivalente importado, não há perda de participação calculada'} em ${parsed.category}. Hoje, os modelos que mais pesam na categoria são:`);if(parsed.category){const rows=scoped.totals.filter(t=>t.category===parsed.category&&rd.period&&t.start===rd.period.start&&t.end===rd.period.end&&(!stores.length||stores.includes(t.store)));const by=new Map<string,{m:string;v:number}>();for(const t of rows){const x=by.get(t.reference)||{m:t.description,v:0};x.v+=t.amount;by.set(t.reference,x)}const tot=[...by.values()].reduce((a,x)=>a+x.v,0);extraFacts.push(...[...by].sort((a,b)=>b[1].v-a[1].v).slice(0,5).map(([ref,x])=>`${x.m} (${ref}): ${x.v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})} · ${(tot>0?Math.round(x.v/tot*1000)/10:0).toLocaleString('pt-BR')}% de ${parsed.category}`))}break;
  case 'grade':picked=sel(['grade'],f=>/tamanhos|concentrado|giro-alto/.test(f.id));break;
  case 'excesso':picked=[...sel(['grade'],f=>f.id.includes('giro-baixo')),...sel(['parado','realocar'])];break;
  case 'transferencia':picked=sel(['ruptura','realocar'],f=>stores.length<2||(stores.includes(f.from||'')&&stores.includes(f.to||'')));picked.push(...sel(['grade'],f=>f.id.includes('tamanhos')));extraLimits.push('Transferência é uma oportunidade para avaliar; nenhuma movimentação é executada.');for(const s of stores)if(!rd.stockStores.includes(s))extraLimits.push(`${input.stores.find(x=>x.id===s)?.name||s} sem posição de estoque: não entra nas sugestões.`);break;
  case 'prioridades':picked=insights.filter(f=>inScope(f)&&f.priority!=='baixa').slice(0,8);if(!picked.length)picked=insights.filter(inScope).slice(0,5);break;
  case 'ecommerce':picked=[...sel(['ecommerce']),...sel(['ruptura','reposicao'],f=>input.stores.find(s=>s.id===f.to)?.type==='online').slice(0,3)];break;
  case 'compras':picked=sel(['compras']);break;
  case 'mudancas':{if(!input.previous)extraFacts.push('Nenhum relatório anterior tem registro de achados; a comparação começa a partir do próximo relatório salvo.');else{const d=diffInsights(input.previous.snapshot,insights.filter(inScope));extraFacts.push(`Comparado com “${input.previous.title}” (${new Date(input.previous.createdAt).toLocaleDateString('pt-BR')}): ${d.novos.length} novos, ${d.alterados.length} com números diferentes, ${d.resolvidos.length} que não aparecem mais e ${d.mantidos.length} sem mudança.`,...d.novos.slice(0,4).map(f=>`Novo: ${f.title}`),...d.alterados.slice(0,3).map(f=>`Mudou: ${f.title}`),...d.resolvidos.slice(0,3).map(s=>`Não aparece mais: ${s.title}`));picked=[...d.novos,...d.alterados].slice(0,6)}break}
  case 'apostas':break;
 }
 picked=[...new Map(picked.map(f=>[f.id,f])).values()];
 const caps=rd.capabilities.filter(c=>frontsOf[parsed.intent].includes(c.id));
 for(const c of caps)if(c.status!=='disponivel')extraLimits.push(`${c.label}: ${c.status==='parcial'?'parcial':'indisponível'} — ${c.reason}${c.missing.length?` Falta: ${c.missing.join(', ')}.`:''}`);
 if(denied.length)extraLimits.push(`Sem acesso aos dados de: ${denied.map(s=>input.stores.find(x=>x.id===s)?.name||s).join(', ')}.`);
 if(parsed.periodNote)extraLimits.push(parsed.periodNote);
 const gaps=stores.filter(s=>rd.period&&(!rd.salesStores.includes(s)||!rd.stockStores.includes(s))).map(s=>`${input.stores.find(x=>x.id===s)?.name||s} sem ${!rd.salesStores.includes(s)?'vendas importadas':'posição de estoque importada'}: a unidade fica fora dos cálculos.`);
 const top=picked[0],lead=[...gaps,...extraFacts];
 const headline=lead.length?lead[0]:top?(top.fact||top.title):parsed.intent==='apostas'?'Não há apostas comerciais cadastradas: não é possível avaliar o desempenho delas com os dados atuais.':parsed.intent==='mudancas'&&extraFacts.length?extraFacts[0]:rd.period?'Nenhum achado calculado para esta pergunta com os dados e limites atuais.':'Ainda não há vendas importadas para responder.';
 const facts=[...new Set([...lead.slice(1),...picked.slice(lead.length?0:1,6).map(f=>f.fact||f.title),...(top?top.evidence.slice(0,5):[])])].filter(Boolean);
 const hypotheses=[...new Map(picked.flatMap(f=>f.hypotheses||[]).map(h=>[h.text,h])).values()].slice(0,5);
 const recommendations=[...new Set(picked.slice(0,5).map(f=>f.action?`${f.action}.`:f.suggestion))];
 const limitations=[...new Set([...rd.limitations.filter(l=>!stores.length||!/^Sem (vendas|posição)/.test(l)||stores.some(s=>l.includes(input.stores.find(x=>x.id===s)?.name||'#'))),...extraLimits,...picked.slice(0,4).flatMap(f=>f.limitations||[])])].slice(0,8);
 const names=stores.map(s=>input.stores.find(x=>x.id===s)?.name||s);
 const answer:Answer={question:input.question.slice(0,300),intent:parsed.intent,intentLabel:intentLabels[parsed.intent],scope:{stores,storeNames:names.length?names:['Todas as unidades com acesso'],category:parsed.category,period:rd.period?`${br(rd.period.start)} a ${br(rd.period.end)}`:'—',periodSource:parsed.period?'pergunta':'padrao',stock:rd.stockDates.filter(s=>!stores.length||stores.includes(s.store)).map(s=>`${s.name.split(' · ')[0]} ${br(s.date)}`)},
  headline,facts:facts.slice(0,10),hypotheses,recommendations,limitations,evidence:picked.slice(0,10).map(f=>({id:f.id,title:f.title,kind:f.kind,priority:f.priority,fact:f.fact||''})),metricIds:[...new Set(picked.flatMap(f=>f.metricIds||[]))],capabilities:caps};
 return {answer,insights:picked};
}
/** Compact, sanitized context for the model: the structured answer plus the insights it came from. */
export function answerContext(a:Answer,picked:Insight[]){const clip=(s:unknown)=>String(s??'').replace(/[\u0000-\u001f]+/g,' ').slice(0,240);
 return JSON.stringify({pergunta:clip(a.question),intencao:a.intentLabel,escopo:a.scope,respostaCalculada:{principal:clip(a.headline),fatos:a.facts.map(clip),hipoteses:a.hypotheses.map(h=>({hipotese:clip(h.text),apoio:clip(h.support),validarCom:h.validateWith})),recomendacoes:a.recommendations.map(clip),limitacoes:a.limitations.map(clip)},
  achados:picked.slice(0,8).map(f=>({titulo:clip(f.title),prioridade:f.priority,unidade:f.storeName,fato:clip(f.fact),numeros:f.metrics,evidencias:f.evidence.slice(0,5).map(clip)})),definicoes:metricBrief(a.metricIds)})}
/** Numbers in the model's text that do not appear (within its own rounding) in the context. Dates and small counts are ignored. */
export function verifyNumbers(text:string,context:string){
 const known:number[]=[];const walk=(v:unknown)=>{if(typeof v==='number')known.push(v);else if(typeof v==='string'){for(const m of v.matchAll(/-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:[.,]\d+)?/g))known.push(parseBR(m[0]))}else if(v&&typeof v==='object')Object.values(v).forEach(walk)};try{walk(JSON.parse(context))}catch{walk(context)}
 const clean=text.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,' ').replace(/\b(19|20)\d{2}\b/g,' ');
 const out:string[]=[];for(const m of clean.matchAll(/(-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?)(\s*(mi|milhões|milhão|mil)\b)?/gi)){
  const v=Math.abs(parseBR(m[1])),scale=/^mi/i.test(m[3]||'')?1e6:/^mil$/i.test(m[3]||'')?1e3:1,dec=(m[1].split(',')[1]||'').length;if(scale===1&&v<=12&&!dec)continue;
  // Printed with `dec` decimals at `scale`: any context number that rounds to it (or the same literal) is a match.
  const tol=0.5*10**-dec+1e-9;if(!known.some(k=>Math.abs(Math.abs(k)/scale-v)<=tol||Math.abs(Math.abs(k)-v)<=tol))out.push(m[0].trim())}
 return [...new Set(out)].slice(0,10);
}
function parseBR(s:string){return Number(s.replace(/\./g,'').replace(',','.'))}
/** Deterministic answer always; optional AI rewrite. A provider failure never discards the computed answer. */
export async function ask(input:AskInput,generate?:(context:string)=>Promise<{text:string;provider:string;model:string;usedFallback?:boolean}>){
 const {answer,insights}=answerQuestion(input);if(!generate)return {answer};const context=answerContext(answer,insights);
 try{const r=await generate(context);return {answer,ai:{text:r.text,provider:r.provider,model:r.model,usedFallback:!!r.usedFallback,unverified:verifyNumbers(r.text,context)}}}
 catch(e){return {answer,aiError:e instanceof Error?e.message:'IA indisponível.'}}
}
