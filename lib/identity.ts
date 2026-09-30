/**
 * Product identity shared by sales and stock: reference (stable key) → color → size, with category/type from explicit
 * sources only. Names are for display; different references are never merged by name similarity.
 */
import {canonColor,canonSize,NOT_INFORMED} from './catalog';
import type {Total} from './totals';
import type {Stock} from './model';
/** Explicit correspondence tables kept in settings: `reference_aliases` (source ref → canonical ref) and `reference_types` (ref → tipo). */
export type IdentityTables={aliases?:Record<string,string>;types?:Record<string,string>};
export type AttrStatus='informado'|'nao_informado'|'nao_aplicavel';
const NA=/^(N\/?A|NAO SE APLICA|NÃO SE APLICA)$/i;
/** Whitespace and letter case only; codes, zeros and punctuation stay as received. */
export const refKey=(raw:unknown)=>String(raw??'').trim().replace(/\s+/g,' ').toUpperCase();
export function canonicalRef(raw:unknown,t:IdentityTables={}){const k=refKey(raw),alias=t.aliases?.[k];return alias?refKey(alias):k}
export function attr(raw:unknown):{value:string;status:AttrStatus}{const s=String(raw??'').trim();if(!s)return {value:NOT_INFORMED,status:'nao_informado'};if(NA.test(s))return {value:'Não se aplica',status:'nao_aplicavel'};return {value:s,status:'informado'}}
export const colorKey=(raw:unknown)=>canonColor(raw)||NOT_INFORMED;
export const sizeKey=(raw:unknown)=>canonSize(raw).label||NOT_INFORMED;
/** Same key on both sides: canonical reference + canonical color + size label (`01 - 32` and `32` meet). */
export const variantKey=(ref:string,color:unknown,size:unknown)=>`${ref}|${colorKey(color)}|${sizeKey(size)}`;
export const typeOf=(ref:string,t:IdentityTables={})=>attr(t.types?.[ref]);
/** Canonical copies for analysis. The source value stays in `sourceReference`; persisted data is untouched. */
export function canonicalize(totals:Total[],stock:Stock[],t:IdentityTables={}){
 return {totals:totals.map(r=>({...r,reference:canonicalRef(r.reference,t),sourceReference:r.reference})),stock:stock.map(r=>({...r,reference:r.reference===undefined?undefined:canonicalRef(r.reference,t),sourceReference:r.reference}))};
}
/** References that only differ by spaces, dots or dashes. Reported for review, never merged automatically. */
export function nearCollisions(refs:Iterable<string>){const by=new Map<string,Set<string>>();for(const r of refs){const c=r.replace(/[\s.\-_/]/g,'');const s=by.get(c)||new Set();s.add(r);by.set(c,s)}return [...by.values()].filter(s=>s.size>1).map(s=>[...s].sort())}
/** Same display name, different references: kept separate on purpose (homonyms). */
export function homonyms(rows:{reference:string;description?:string;model?:string}[]){const by=new Map<string,Set<string>>();for(const r of rows){const n=String(r.description??r.model??'').trim().toUpperCase();if(!n)continue;const s=by.get(n)||new Set();s.add(r.reference);by.set(n,s)}return [...by].filter(([,s])=>s.size>1).map(([name,s])=>({name,references:[...s].sort()}))}
export function validateTables(v:unknown):Record<string,string>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Tabela inválida.');const out:Record<string,string>={};const entries=Object.entries(v as Record<string,unknown>);if(entries.length>5000)throw new Error('Tabela muito extensa.');for(const [k,x] of entries){if(typeof x!=='string'||!k.trim()||!x.trim()||k.length>160||x.length>160)throw new Error('Use pares texto → texto de até 160 caracteres.');out[refKey(k)]=x.trim()}return out}
