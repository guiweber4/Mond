import type {Sql,ParameterOrJSON} from 'postgres';
import type {SupabaseClient} from '@supabase/supabase-js';
import {database as wrap,type Database,type Runner} from './pg-adapter';
import {poolerCandidates,tenantNotFound} from './config';
let runner:Runner|undefined,files:Files|undefined;
/** Tests inject PGlite and an in-memory store; production connects on first use. */
export function useBackends(r:Runner,f:Files){runner=r;files=f}
function env(name:string){const v=process.env[name];if(!v)throw new Error('Serviço indisponível: configuração do servidor incompleta.');return v}
/** Host that actually answered (after the aws-0/aws-1 fallback), for /api/health. */
export let connectedHost='';
const QUERY_TIMEOUT=20000;
function postgresRunner():Runner{
 let client:Promise<Sql>|undefined;
 // Supabase pooler (transaction mode) does not support prepared statements.
 const connect=async()=>{const postgres=(await import('postgres')).default,urls=poolerCandidates(env('DATABASE_URL'));
  for(const [i,url] of urls.entries()){const sql=postgres(url,{prepare:false,max:1,idle_timeout:20,max_lifetime:300,connect_timeout:10});
   // Only the aws-0/aws-1 guess is retried; any other failure (password, network) surfaces as is.
   try{if(urls.length>1)await sql`select 1`;try{connectedHost=new URL(url).host}catch{};return sql}catch(e){await sql.end({timeout:1}).catch(()=>{});if(i<urls.length-1&&tenantNotFound(String((e as Error).message)))continue;throw e}}
  throw new Error('Banco indisponível.')};
 const get=()=>client??=connect().catch(e=>{client=undefined;throw e});
 const reset=()=>{const old=client;client=undefined;old?.then(sql=>sql.end({timeout:1})).catch(()=>{})};
 // One statement at a time per instance: concurrent queries on one connection are pipelined by postgres.js,
 // which the transaction pooler does not handle (the dashboard's parallel reads hung). A stale socket left by a
 // frozen serverless instance is dropped after QUERY_TIMEOUT instead of hanging the request.
 let queue:Promise<unknown>=Promise.resolve();
 const serial=<T,>(job:()=>Promise<T>,ms=QUERY_TIMEOUT)=>{const run=queue.then(()=>new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>{reset();reject(new Error('O banco demorou para responder. Tente novamente.'))},ms);job().then(resolve,reject).finally(()=>clearTimeout(timer))}));queue=run.catch(()=>{});return run};
 const args=(p:unknown[])=>p as ParameterOrJSON<never>[];
 return {query:(text,params)=>serial(async()=>[...await (await get()).unsafe(text,args(params))]),transaction:fn=>serial(async()=>(await (await get()).begin(tx=>fn({query:async(text,params)=>[...await tx.unsafe(text,args(params))]}))) as Awaited<ReturnType<typeof fn>>,50000)};
}
export function database():Database{runner??=postgresRunner();return wrap(runner)}
export type Files={put(key:string,bytes:ArrayBuffer):Promise<void>;uploadUrl(key:string):Promise<string>;size(key:string):Promise<number|null>;remove(key:string):Promise<void>};
const BUCKET='imports';
function supabaseFiles():Files{
 let client:SupabaseClient|undefined;
 const store=async()=>(client??=(await import('@supabase/supabase-js')).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||env('SUPABASE_URL'),process.env.SUPABASE_SECRET_KEY||env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})).storage.from(BUCKET);
 const check=<T,>(r:{data:T|null;error:unknown}):T=>{if(r.error||r.data===null)throw new Error('Armazenamento de arquivos indisponível. Tente novamente.');return r.data};
 return {
  async put(key,bytes){check(await (await store()).upload(key,bytes,{contentType:'application/octet-stream',upsert:false}))},
  async uploadUrl(key){return check(await (await store()).createSignedUploadUrl(key)).signedUrl},
  async size(key){const dir=key.slice(0,key.lastIndexOf('/')),name=key.slice(key.lastIndexOf('/')+1);const list=check(await (await store()).list(dir,{limit:10,search:name}));const f=list.find(x=>x.name===name);return f?Number(f.metadata?.size??0):null},
  async remove(key){await (await store()).remove([key])},
 };
}
export function bucket():Files{files??=supabaseFiles();return files}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export function checkOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('Origem não permitida.');}
export function fail(e:unknown){if(e instanceof Error&&/ENOTFOUND db\.[a-z0-9]+\.supabase\.co/.test(e.message)){console.error(e);return json({error:'Banco inacessível: a DATABASE_URL usa a “Direct connection” do Supabase. Troque pela “Transaction pooler” (porta 6543) na Vercel e faça Redeploy.'},503)}if(e instanceof Error&&e.name==='AuthError')return json({error:e.message,auth:true},401);console.error(e);return json({error:e instanceof Error?e.message:'Não foi possível concluir. Tente novamente.'},400)}
const LIMIT=100000;
/** Latest ready version per record; stock rows only from the active snapshot of their unit/date. */
export async function readRecords(){const rows=await database().prepare(`SELECT kind,payload FROM (SELECT r.kind,r.payload,ROW_NUMBER() OVER(PARTITION BY r.kind,r.rid ORDER BY i.created_at DESC,i.id DESC) AS rn FROM records r JOIN imports i ON i.id=r.import_id WHERE i.status='ready' AND r.kind<>'totals' AND (r.kind<>'stock' OR NOT EXISTS (SELECT 1 FROM stock_batches b WHERE b.store=r.pos_store AND b.date=r.pos_date AND b.import_id<>r.import_id))) t WHERE rn=1 LIMIT ${LIMIT+1}`).all<{kind:string;payload:string}>();if(rows.results.length>LIMIT)throw new Error('A base excedeu o limite do piloto. Solicite ampliação.');const data:any={sales:[],products:[],stock:[],goals:[],purchases:[],controls:[],totals:[]};for(const r of rows.results)data[r.kind]?.push(JSON.parse(r.payload));data.totals=await readTotals();return data;}
export async function readTotals(){const rows=await database().prepare(`SELECT r.payload,i.name,i.created_at FROM total_batches b JOIN imports i ON i.id=b.import_id JOIN records r ON r.import_id=b.import_id AND r.kind='totals' WHERE i.status='ready' ORDER BY i.created_at DESC LIMIT ${LIMIT+1}`).all<{payload:string;name:string;created_at:string}>();if(rows.results.length>LIMIT)throw new Error('Totalizações excedem o limite do piloto.');return rows.results.map(r=>({...JSON.parse(r.payload),sourceFile:r.name,importedAt:r.created_at}));}
/** Changes on every ready import (new or replacing batch). Analyses and AI texts record it to detect outdated readings. */
export async function dataVersion(){const r=await database().prepare("SELECT count(*)::int AS n, max(created_at) AS m FROM imports WHERE status='ready'").first<{n:number;m:string|null}>();return `${r?.n??0}:${r?.m??''}`}
