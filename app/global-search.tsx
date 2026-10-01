'use client';
import {useMemo,useState} from 'react';
import {Search,Shirt,FolderOpen,LayoutDashboard,MessageSquareText} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Command,CommandInput,CommandList,CommandEmpty,CommandGroup,CommandItem} from '@/components/ui/command';
import {searchKey} from '@/lib/catalog';
import {exampleQuestions} from '@/lib/analyst';
export type SearchModel={reference:string;model:string;category:string;sold:boolean};
export type Pick={type:'model';model:SearchModel}|{type:'category';name:string}|{type:'view';id:string}|{type:'question';text:string};
/** Ctrl/⌘+K: models (by name or reference), categories, screens and analyst questions. Filtering is ours (bounded list). */
export default function GlobalSearch({open,onOpenChange,models,categories,views,onPick}:{open:boolean;onOpenChange:(v:boolean)=>void;models:SearchModel[];categories:string[];views:{id:string;label:string}[];onPick:(p:Pick)=>void}){
 const [q,setQ]=useState('');const k=searchKey(q.trim());
 const has=(s:string)=>!k||searchKey(s).includes(k);
 const found=useMemo(()=>({models:k?models.filter(m=>has(`${m.model} ${m.reference}`)).slice(0,12):[],categories:categories.filter(c=>has(c)).slice(0,k?6:4),views:views.filter(v=>has(v.label)).slice(0,k?6:4),questions:exampleQuestions.filter(x=>has(x)).slice(0,k?4:3)}),[k,models,categories,views]);// eslint-disable-line react-hooks/exhaustive-deps
 const pick=(p:Pick)=>{onPick(p);onOpenChange(false);setQ('')};
 return <Dialog open={open} onOpenChange={v=>{onOpenChange(v);if(!v)setQ('')}}><DialogContent className="search-dialog" showCloseButton={false}><DialogTitle className="sr-only">Busca</DialogTitle><DialogDescription className="sr-only">Procure modelos, categorias, telas e perguntas</DialogDescription>
  <Command shouldFilter={false}><CommandInput value={q} onValueChange={setQ} placeholder="Modelo, referência, categoria ou tela…"/>
   <CommandList><CommandEmpty>Nada encontrado.</CommandEmpty>
    {found.models.length>0&&<CommandGroup heading="Modelos">{found.models.map(m=><CommandItem key={m.reference} value={'m:'+m.reference} onSelect={()=>pick({type:'model',model:m})}><Shirt/><span className="search-main">{m.model}<small>{m.reference} · {m.category}{m.sold?'':' · só no estoque'}</small></span></CommandItem>)}</CommandGroup>}
    {found.categories.length>0&&<CommandGroup heading="Categorias">{found.categories.map(c=><CommandItem key={c} value={'c:'+c} onSelect={()=>pick({type:'category',name:c})}><FolderOpen/>{c}</CommandItem>)}</CommandGroup>}
    {found.views.length>0&&<CommandGroup heading="Telas">{found.views.map(v=><CommandItem key={v.id} value={'v:'+v.id} onSelect={()=>pick({type:'view',id:v.id})}><LayoutDashboard/>{v.label}</CommandItem>)}</CommandGroup>}
    {found.questions.length>0&&<CommandGroup heading="Perguntar ao analista">{found.questions.map(x=><CommandItem key={x} value={'q:'+x} onSelect={()=>pick({type:'question',text:x})}><MessageSquareText/>{x}</CommandItem>)}</CommandGroup>}
   </CommandList></Command>
 </DialogContent></Dialog>
}
export function SearchButton({onClick}:{onClick:()=>void}){return <button type="button" className="search-trigger" onClick={onClick} aria-label="Buscar (Ctrl+K)"><Search size={15}/><span>Buscar modelo, categoria ou tela</span><kbd>Ctrl K</kbd></button>}
