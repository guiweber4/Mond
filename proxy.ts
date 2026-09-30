import {NextResponse,type NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
const PUBLIC=['/login','/auth/callback'];
/** Refreshes the Supabase session cookie and sends visitors without a session to /login. API routes answer 401 themselves. */
export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll:items=>{items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}});
 const {data}=await supabase.auth.getUser();const path=request.nextUrl.pathname;
 if(!data.user&&!path.startsWith('/api/')&&!PUBLIC.some(p=>path===p||path.startsWith(p+'/'))){const url=request.nextUrl.clone();url.pathname='/login';url.search=path==='/'?'':`?next=${encodeURIComponent(path)}`;return NextResponse.redirect(url)}
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)']};
