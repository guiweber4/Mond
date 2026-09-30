'use client';
import {useState,useMemo,Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {createBrowserClient} from '@supabase/ssr';
import {Mail,LockKeyhole,ShieldCheck} from 'lucide-react';
function LoginForm(){
 const params=useSearchParams();const supabase=useMemo(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),[]);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(params.get('erro')==='link'?'O link expirou ou já foi usado. Solicite outro.':''),[sent,setSent]=useState(false);
 const next=(()=>{const n=params.get('next')||'/';return n.startsWith('/')&&!n.startsWith('//')?n:'/'})();
 async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error){setMessage(error.message==='Invalid login credentials'?'E-mail ou senha incorretos.':'Não foi possível entrar. Tente novamente.');setBusy(false);return}window.location.assign(next)}
 async function magicLink(){if(!email){setMessage('Informe seu e-mail para receber o link.');return}setBusy(true);setMessage('');const {error}=await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`}});setBusy(false);if(error)setMessage('Não foi possível enviar o link. Confira o e-mail ou fale com o administrador.');else setSent(true)}
 return <main className="login-page"><section className="login-card" aria-labelledby="login-title"><div className="login-brand">MONDEPARS<span>INTELLIGENCE</span></div><h1 id="login-title">Entrar</h1><p className="login-lead">Acesso restrito à equipe Mondepars. Contas são criadas pelo administrador.</p>
  {sent?<div className="login-sent" role="status"><Mail size={20}/><p>Enviamos um link de acesso para <strong>{email}</strong>. Abra-o neste navegador.</p></div>:
  <form onSubmit={signIn} className="login-form"><label>E-mail<span className="login-field"><Mail size={17} aria-hidden="true"/><input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></span></label><label>Senha<span className="login-field"><LockKeyhole size={17} aria-hidden="true"/><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></span></label>
   {message&&<p className="login-error" role="alert">{message}</p>}
   <button className="btn primary" type="submit" disabled={busy||!password}>{busy?'Entrando…':'Entrar'}</button><button className="btn secondary" type="button" disabled={busy} onClick={magicLink}>Receber link de acesso por e-mail</button></form>}
  <p className="login-foot"><ShieldCheck size={15}/> Sessão validada no servidor pelo Supabase Auth.</p></section></main>;
}
export default function Login(){return <Suspense><LoginForm/></Suspense>}
