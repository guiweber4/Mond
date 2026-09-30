import {database,bucket,json} from '@/lib/db';
import {serverConfigIssues} from '@/lib/config';
export const dynamic='force-dynamic';
/** Public diagnostics for setup: variable names and check results only, never values or raw errors. */
function dbHint(e:unknown){const m=String((e as {message?:string})?.message||''),c=String((e as {code?:string})?.code||'');
 if(c==='28P01'||/password authentication failed/i.test(m))return 'senha do banco incorreta na DATABASE_URL';
 if(/Tenant or user not found/i.test(m))return 'usuário incorreto: no pooler o usuário é postgres.<id-do-projeto> (copie a string do botão Connect)';
 if(c==='42P01'||/does not exist/i.test(m))return 'tabelas não encontradas: rode as migrações no SQL Editor';
 if(/ENOTFOUND|getaddrinfo/i.test(m))return 'endereço do banco não encontrado: confira o host da DATABASE_URL';
 if(/timeout|ETIMEDOUT|ECONNREFUSED/i.test(m))return 'banco não respondeu: confira host e porta (6543)';
 if(/configuração do servidor incompleta/i.test(m))return 'DATABASE_URL não cadastrada';
 return 'falha de conexão (veja os logs da função na Vercel)'}
export async function GET(){
 const issues=serverConfigIssues(),checks:Record<string,{ok:boolean;hint?:string}>={};
 try{const r=await database().prepare("SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('imports','records','settings','actions','reports','ai_profiles','ai_quota','ai_runs','total_batches','stock_batches'))::int AS n").first<{n:number}>();checks.database=r?.n===10?{ok:true}:{ok:false,hint:`${r?.n??0} de 10 tabelas: rode as duas migrações no SQL Editor`}}catch(e){console.error('health db',e);checks.database={ok:false,hint:dbHint(e)}}
 try{await bucket().size('imports/health/check');checks.storage={ok:true}}catch(e){console.error('health storage',e);checks.storage={ok:false,hint:'bucket “imports” inacessível: rode a segunda migração e confira SUPABASE_SERVICE_ROLE_KEY'}}
 const ok=!issues.some(i=>i.required)&&Object.values(checks).every(c=>c.ok);
 return json({ok,variables:issues.length?issues:'todas presentes',checks},ok?200:503);
}
