/** Checks server configuration by name and format only. Values are never echoed back. */
export type ConfigIssue={name:string;problem:string;required:boolean};
const has=(v:string|undefined)=>!!v&&v.trim()!=='';
const dirty=(v:string)=>v!==v.trim()||/^["']|["']$/.test(v)||/\s/.test(v.trim());
function url(v:string){try{const u=new URL(v);return u.protocol==='https:'||u.protocol==='http:'?u:null}catch{return null}}
/** Only the two public variables: the proxy and the login page cannot run without them. */
export function publicConfigIssues(env:Record<string,string|undefined>={NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}):ConfigIssue[]{
 const out:ConfigIssue[]=[],u=env.NEXT_PUBLIC_SUPABASE_URL,k=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!has(u))out.push({name:'NEXT_PUBLIC_SUPABASE_URL',problem:'não cadastrada (ou cadastrada depois do último deploy); aceita também SUPABASE_URL',required:true});
 else if(dirty(u!))out.push({name:'NEXT_PUBLIC_SUPABASE_URL',problem:'tem aspas ou espaços; cole só o endereço',required:true});
 else{const p=url(u!);if(!p)out.push({name:'NEXT_PUBLIC_SUPABASE_URL',problem:'não é um endereço válido; use o Project URL, ex.: https://abcd.supabase.co',required:true});else if(p.pathname!=='/'&&p.pathname!=='')out.push({name:'NEXT_PUBLIC_SUPABASE_URL',problem:'deve ser só o endereço do projeto, sem /rest/v1 ou outro caminho',required:true});else if(p.hostname.includes('supabase.com'))out.push({name:'NEXT_PUBLIC_SUPABASE_URL',problem:'é o endereço do painel; use o Project URL (termina em .supabase.co)',required:true})}
 if(!has(k))out.push({name:'SUPABASE_PUBLISHABLE_KEY',problem:'chave pública do Supabase não cadastrada (ou cadastrada depois do último deploy); aceita também SUPABASE_ANON_KEY',required:true});
 else if(dirty(k!))out.push({name:'SUPABASE_PUBLISHABLE_KEY',problem:'tem aspas ou espaços; cole só a chave',required:true});
 else if(/^sb_secret_/.test(k!))out.push({name:'SUPABASE_PUBLISHABLE_KEY',problem:'recebeu a chave secreta; aqui vai a chave publishable/anon',required:true});
 return out;
}
export function serverConfigIssues(env:Record<string,string|undefined>=process.env):ConfigIssue[]{
 const out=publicConfigIssues();
 const s=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY,d=env.DATABASE_URL,a=env.AI_VAULT_KEY,m=env.APP_ADMIN_EMAIL;
 if(!has(s))out.push({name:'SUPABASE_SERVICE_ROLE_KEY',problem:'não cadastrada',required:true});else if(dirty(s!))out.push({name:'SUPABASE_SERVICE_ROLE_KEY',problem:'tem aspas ou espaços',required:true});else if(/^sb_publishable_/.test(s!)||s===process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)out.push({name:'SUPABASE_SERVICE_ROLE_KEY',problem:'recebeu a chave pública; aqui vai a secret/service_role',required:true});
 if(!has(d))out.push({name:'DATABASE_URL',problem:'não cadastrada',required:true});
 else if(dirty(d!))out.push({name:'DATABASE_URL',problem:'tem aspas ou espaços',required:true});
 else if(!/^postgres(ql)?:\/\//.test(d!))out.push({name:'DATABASE_URL',problem:'deve começar com postgresql://',required:true});
 else if(/\[YOUR-PASSWORD\]|YOUR-PASSWORD/i.test(d!))out.push({name:'DATABASE_URL',problem:'ainda contém [YOUR-PASSWORD]; troque pela senha do banco',required:true});
 else{try{const p=new URL(d!);if(/^db\..+\.supabase\.co$/.test(p.hostname))out.push({name:'DATABASE_URL',problem:'é a “Direct connection” (db.<id>.supabase.co), que a Vercel não alcança; use a “Transaction pooler” (…pooler.supabase.com:6543, usuário postgres.<id>)',required:true});else if(!/^postgres\.[a-z0-9]+$/.test(decodeURIComponent(p.username))&&p.hostname.endsWith('pooler.supabase.com'))out.push({name:'DATABASE_URL',problem:'no pooler o usuário deve ser postgres.<id-do-projeto>',required:true});else if(p.port!=='6543')out.push({name:'DATABASE_URL',problem:`usa a porta ${p.port||'5432'}; use a conexão “Transaction pooler” (porta 6543)`,required:false})}catch{out.push({name:'DATABASE_URL',problem:'endereço inválido; se a senha tem símbolos (@ # / ? %), gere uma senha só com letras e números',required:true})}}
 if(!has(m))out.push({name:'APP_ADMIN_EMAIL',problem:'não cadastrada; ninguém terá acesso de administrador',required:false});
 if(!has(a))out.push({name:'AI_VAULT_KEY',problem:'não cadastrada; a IA fica indisponível',required:false});else{try{if(atob(a!.trim()).length!==32)throw 0}catch{out.push({name:'AI_VAULT_KEY',problem:'deve ter 32 bytes em base64 (44 caracteres terminando em =)',required:false})}}
 return out;
}
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
/** Self-contained page (no app CSS) shown instead of a bare “Internal Server Error”. */
export function configPage(title:string,lead:string,issues:ConfigIssue[]){
 const items=issues.map(i=>`<li><code>${esc(i.name)}</code> — ${esc(i.problem)}</li>`).join('');
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configuração · Mondepars</title><style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#f5f6f8;color:#22323a;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}main{max-width:620px;background:#fff;border:1px solid #e2e6ec;border-radius:12px;padding:28px}h1{font:500 26px Georgia,serif;margin:0 0 8px}p{color:#56636f}li{margin:8px 0}code{background:#eef2f5;padding:2px 6px;border-radius:4px}small{color:#56636f}</style></head><body><main><h1>${esc(title)}</h1><p>${esc(lead)}</p>${items?`<ul>${items}</ul>`:''}<p><small>Corrija em Vercel → Settings → Environment Variables e depois faça <strong>Deployments → ⋯ → Redeploy</strong>: as variáveis só valem para deploys novos. Diagnóstico completo em <code>/api/health</code>.</small></p></main></body></html>`;
}
/** Host only (no user/password) so the owner can confirm which database a deploy points to. */
export function databaseHost(v=process.env.DATABASE_URL){try{const u=new URL((v||'').trim());return `${u.hostname}:${u.port||'5432'}`}catch{return v?'inválido':'não cadastrada'}}
/**
 * Shared-pooler URLs to try, in order. New projects live on aws-0 or aws-1 of their region and the dashboard
 * does not always show which; both are tried, and a pooler user without the project ref gets it added.
 */
export function poolerCandidates(raw:string,supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL){
 let u:URL;try{u=new URL(raw.trim())}catch{return [raw]}
 const m=u.hostname.match(/^aws-([01])-(.+\.pooler\.supabase\.com)$/);if(!m)return [raw.trim()];
 let ref=decodeURIComponent(u.username).split('.')[1]||'';if(!ref){try{ref=new URL(supabaseUrl||'').hostname.split('.')[0]}catch{}}
 if(ref)u.username=`postgres.${ref}`;
 const other=new URL(u.toString());other.hostname=`aws-${m[1]==='0'?'1':'0'}-${m[2]}`;
 return [u.toString(),other.toString()];
}
