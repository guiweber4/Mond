import {NextResponse,type NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {publicConfigIssues,configPage} from '@/lib/config';
const PUBLIC=['/login','/auth/callback'];
const page=(html:string)=>new NextResponse(html,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
/** Refreshes the Supabase session cookie and sends visitors without a session to /login. API routes answer 401 themselves. */
export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path==='/api/health')return NextResponse.next();
 // A missing/invalid public variable used to crash here as a bare "Internal Server Error".
 const issues=publicConfigIssues();
 if(issues.length)return path.startsWith('/api/')?NextResponse.json({error:'Configuração do servidor incompleta.',issues:issues.map(i=>i.name)},{status:503}):page(configPage('Configuração incompleta','O sistema não encontrou a configuração do Supabase neste deploy:',issues));
 let response=NextResponse.next({request});
 let user=null;
 try{
  const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll:items=>{items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}});
  user=(await supabase.auth.getUser()).data.user;
 }catch(e){console.error('Supabase Auth indisponível',e);if(!path.startsWith('/api/'))return page(configPage('Supabase indisponível','Não foi possível falar com o Supabase Auth. Confira se NEXT_PUBLIC_SUPABASE_URL é o Project URL do projeto certo e se o projeto não está pausado.',[]));return NextResponse.json({error:'Supabase indisponível.'},{status:503})}
 if(!user&&!path.startsWith('/api/')&&!PUBLIC.some(p=>path===p||path.startsWith(p+'/'))){const url=request.nextUrl.clone();url.pathname='/login';url.search=path==='/'?'':`?next=${encodeURIComponent(path)}`;return NextResponse.redirect(url)}
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)']};
