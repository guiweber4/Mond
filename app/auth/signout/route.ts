import {NextResponse} from 'next/server';
import {supabaseServer} from '@/lib/auth';
import {checkOrigin} from '@/lib/db';
export async function POST(req:Request){checkOrigin(req);await (await supabaseServer()).auth.signOut();return NextResponse.redirect(new URL('/login',req.url),{status:303})}
