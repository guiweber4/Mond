'use client';
import {useEffect,useState} from 'react';
import {ArrowUp} from 'lucide-react';
/** Sticky strip with what every screen is based on: unit filter, sales period, stock dates and last import. */
export default function ContextBar({left,items,demo}:{left?:React.ReactNode;items:{label:string;value:string}[];demo?:boolean}){
 return <div className={'context-bar'+(demo?' demo':'')} role="region" aria-label="Contexto dos dados">{left&&<div className="ctx-left">{left}</div>}<dl className="ctx-items">{demo&&<div className="ctx-demo"><dt className="sr-only">Base</dt><dd>Demonstração · valores fictícios</dd></div>}{items.filter(i=>i.value).map(i=><div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl></div>
}
/** Appears after ~1,5 screens of scroll. */
export function BackToTop(){const [show,setShow]=useState(false);useEffect(()=>{const f=()=>setShow(window.scrollY>window.innerHeight*1.5);f();window.addEventListener('scroll',f,{passive:true});return()=>window.removeEventListener('scroll',f)},[]);return show?<button type="button" className="back-top" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} aria-label="Voltar ao topo"><ArrowUp size={18}/></button>:null}
