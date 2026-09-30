import {database,json,fail,readRecords,dataVersion} from '@/lib/db';
import {requireUser} from '@/lib/auth';
import {restrictData,reportAllowed} from '@/lib/access';
import {computeInsights,type SavedAction} from '@/lib/insights';
import {ask} from '@/lib/analyst';
import {generate} from '@/lib/ai-server';
import {defaultStores,today,type Store} from '@/lib/model';
import {defaultOps} from '@/lib/operations';
export const maxDuration=120;
/** Shared entry point for dashboards, reports and future channels: same data, permissions and rules everywhere. */
async function load(user:{stores:string[]|null}){
 const db=database();const [data,settings,actions,reports]=await Promise.all([readRecords(),db.prepare("SELECT id,payload FROM settings WHERE id IN ('stores','operations','insights','reference_aliases','reference_types')").all<{id:string;payload:string}>(),db.prepare('SELECT dataset,status,payload,updated_at FROM actions').all<SavedAction>(),db.prepare("SELECT title,created_at,payload FROM reports WHERE dataset='real' ORDER BY created_at DESC LIMIT 30").all<{title:string;created_at:string;payload:string}>()]);
 const cfg=Object.fromEntries(settings.results.map(r=>[r.id,JSON.parse(r.payload)])),all:Store[]=cfg.stores||defaultStores,allowed=user.stores,d=restrictData(data,allowed);
 const prev=reports.results.find(r=>r.payload.includes('"insightSnapshot"')&&reportAllowed(r.payload,allowed,new Map(all.map(s=>[s.id,s.name]))));
 const previous=prev?(()=>{const p=JSON.parse(prev.payload);return {snapshot:p.insightSnapshot,title:prev.title,createdAt:prev.created_at}})():null;
 return {input:{totals:d.totals||[],stock:d.stock,stores:allowed?all.filter(s=>allowed.includes(s.id)):all,goals:d.goals,sales:d.sales.length,purchases:d.purchases,routes:(cfg.operations||defaultOps).routes?.length||0,saved:actions.results,today:today(),config:cfg.insights,tables:{aliases:cfg.reference_aliases,types:cfg.reference_types}},previous,allStores:all};
}
export async function GET(req:Request){try{const user=await requireUser(req);const {input}=await load(user);const url=new URL(req.url),period=url.searchParams.get('period')||undefined;const {insights,readiness}=computeInsights({...input,period});return json({insights,readiness,dataVersion:await dataVersion(),generatedAt:new Date().toISOString()})}catch(e){return fail(e)}}
export async function POST(req:Request){try{const user=await requireUser(req);const raw=await req.text();if(raw.length>4000)throw new Error('Pergunta muito extensa.');const b=JSON.parse(raw) as {action?:string;question?:unknown;channel?:unknown;period?:unknown;withAI?:unknown};
 if(b.action!=='ask'||typeof b.question!=='string'||!b.question.trim()||b.question.length>500)throw new Error('Escreva uma pergunta de até 500 caracteres.');
 const {input,previous,allStores}=await load(user);const channel=typeof b.channel==='string'&&(b.channel==='all'||allStores.some(s=>s.id===b.channel))?b.channel:'all';
 if(user.stores&&channel!=='all'&&!user.stores.includes(channel))throw new Error('Sem acesso a esta unidade.');
 // Units named in the question resolve against every unit (a denied one is reported); data stays restricted.
 const version=await dataVersion();
 // AI only rewrites the computed answer; failures keep the deterministic answer.
 const result=await ask({...input,stores:allStores,question:b.question,channel,period:typeof b.period==='string'?b.period:undefined,allowedStores:user.stores,previous},b.withAI?context=>generate(context,'real','question'):undefined);
 return json({...result,dataVersion:version});
}catch(e){return fail(e)}}
