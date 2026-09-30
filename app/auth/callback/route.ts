import {NextResponse} from 'next/server';
import {supabaseServer} from '@/lib/auth';
/** Link de acesso por e-mail (PKCE): troca o código pela sessão e volta ao painel. */
export async function GET(req:Request){const url=new URL(req.url),code=url.searchParams.get('code'),next=url.searchParams.get('next')||'/';const safe=next.startsWith('/')&&!next.startsWith('//')?next:'/';if(code){const {error}=await (await supabaseServer()).auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(safe,url.origin))}return NextResponse.redirect(new URL('/login?erro=link',url.origin))}
