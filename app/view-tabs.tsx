'use client';
import {useRef} from 'react';
/** Accessible tab bar (arrow keys move between tabs). The panel content is rendered by the caller. */
export default function ViewTabs({tabs,value,onChange,label,className=''}:{tabs:{id:string;label:string;count?:number}[];value:string;onChange:(id:string)=>void;label:string;className?:string}){
 const refs=useRef<(HTMLButtonElement|null)[]>([]);
 function key(e:React.KeyboardEvent,i:number){const n=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(n===null)return;e.preventDefault();const j=(n+tabs.length)%tabs.length;onChange(tabs[j].id);refs.current[j]?.focus()}
 return <div role="tablist" aria-label={label} className={'view-tabs '+className}>{tabs.map((t,i)=><button key={t.id} ref={el=>{refs.current[i]=el}} type="button" role="tab" id={`tab-${t.id}`} aria-selected={value===t.id} tabIndex={value===t.id?0:-1} className={value===t.id?'active':''} onClick={()=>onChange(t.id)} onKeyDown={e=>key(e,i)}>{t.label}{t.count!==undefined&&<span className="tab-count">{t.count}</span>}</button>)}</div>
}
