import {json,fail,dataVersion} from '@/lib/db';
import {load} from '@/lib/server-data';
import {requireUser} from '@/lib/auth';
import {computeInsights} from '@/lib/insights';
import {ask} from '@/lib/analyst';
import {generate} from '@/lib/ai-server';
export const maxDuration=120;
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
