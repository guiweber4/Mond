import type {Sql,ParameterOrJSON} from 'postgres';
import type {SupabaseClient} from '@supabase/supabase-js';
import {database as wrap,type Database,type Runner} from './pg-adapter';
let runner:Runner|undefined,files:Files|undefined;
/** Tests inject PGlite and an in-memory store; production connects on first use. */
export function useBackends(r:Runner,f:Files){runner=r;files=f}
function env(name:string){const v=process.env[name];if(!v)throw new Error('Serviço indisponível: configuração do servidor incompleta.');return v}
function postgresRunner():Runner{
 let client:Sql|undefined;
 // Supabase pooler (transaction mode) does not support prepared statements.
 const get=async()=>client??=(await import('postgres')).default(env('DATABASE_URL'),{prepare:false,max:3,idle_timeout:20,connect_timeout:10});
 const args=(p:unknown[])=>p as ParameterOrJSON<never>[];
 return {query:async(text,params)=>[...await (await get()).unsafe(text,args(params))],transaction:async fn=>(await (await get()).begin(tx=>fn({query:async(text,params)=>[...await tx.unsafe(text,args(params))]}))) as Awaited<ReturnType<typeof fn>>};
}
export function database():Database{runner??=postgresRunner();return wrap(runner)}
export type Files={put(key:string,bytes:ArrayBuffer):Promise<void>;uploadUrl(key:string):Promise<string>;size(key:string):Promise<number|null>;remove(key:string):Promise<void>};
const BUCKET='imports';
function supabaseFiles():Files{
 let client:SupabaseClient|undefined;
 const store=async()=>(client??=(await import('@supabase/supabase-js')).createClient(env('NEXT_PUBLIC_SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})).storage.from(BUCKET);
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
export function fail(e:unknown){if(e instanceof Error&&e.name==='AuthError')return json({error:e.message,auth:true},401);console.error(e);return json({error:e instanceof Error?e.message:'Não foi possível concluir. Tente novamente.'},400)}
const LIMIT=100000;
/** Latest ready version per record; stock rows only from the active snapshot of their unit/date. */
export async function readRecords(){const rows=await database().prepare(`SELECT kind,payload FROM (SELECT r.kind,r.payload,ROW_NUMBER() OVER(PARTITION BY r.kind,r.rid ORDER BY i.created_at DESC,i.id DESC) AS rn FROM records r JOIN imports i ON i.id=r.import_id WHERE i.status='ready' AND r.kind<>'totals' AND (r.kind<>'stock' OR NOT EXISTS (SELECT 1 FROM stock_batches b WHERE b.store=r.pos_store AND b.date=r.pos_date AND b.import_id<>r.import_id))) t WHERE rn=1 LIMIT ${LIMIT+1}`).all<{kind:string;payload:string}>();if(rows.results.length>LIMIT)throw new Error('A base excedeu o limite do piloto. Solicite ampliação.');const data:any={sales:[],products:[],stock:[],goals:[],purchases:[],controls:[],totals:[]};for(const r of rows.results)data[r.kind]?.push(JSON.parse(r.payload));data.totals=await readTotals();return data;}
export async function readTotals(){const rows=await database().prepare(`SELECT r.payload,i.name,i.created_at FROM total_batches b JOIN imports i ON i.id=b.import_id JOIN records r ON r.import_id=b.import_id AND r.kind='totals' WHERE i.status='ready' ORDER BY i.created_at DESC LIMIT ${LIMIT+1}`).all<{payload:string;name:string;created_at:string}>();if(rows.results.length>LIMIT)throw new Error('Totalizações excedem o limite do piloto.');return rows.results.map(r=>({...JSON.parse(r.payload),sourceFile:r.name,importedAt:r.created_at}));}
