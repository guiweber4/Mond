import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {checkOrigin} from './db';
export type User={id:string;email:string;admin:boolean};
export class AuthError extends Error{constructor(message='Sessão expirada. Entre novamente.'){super(message);this.name='AuthError'}}
const list=(v?:string)=>(v||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
/** Optional allowlist on top of Supabase Auth (signups should stay disabled in the project). */
export function allowedEmail(email:string){const allowed=list(process.env.ALLOWED_EMAILS);return !allowed.length||allowed.includes(email.toLowerCase())}
export function adminEmail(email:string){const admin=(process.env.APP_ADMIN_EMAIL||'').trim().toLowerCase();return !!admin&&admin===email.toLowerCase()}
export async function supabaseServer(){const store=await cookies();return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>store.getAll(),setAll:items=>{try{items.forEach(({name,value,options})=>store.set(name,value,options))}catch{/* Server Components cannot set cookies; the proxy refreshes them. */}}}})}
/** `getUser` validates the token with Supabase Auth; request headers are never trusted for identity. */
export async function currentUser():Promise<User|null>{const {data}=await (await supabaseServer()).auth.getUser();const u=data.user;if(!u?.email||!allowedEmail(u.email))return null;return {id:u.id,email:u.email,admin:adminEmail(u.email)}}
export async function requireUser(req:Request){checkOrigin(req);const user=await currentUser();if(!user)throw new AuthError();return user}
export async function requireAdmin(req:Request){const user=await requireUser(req);if(!user.admin)throw new AuthError('Disponível apenas para o administrador.');return user}
