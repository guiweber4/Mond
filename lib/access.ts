/**
 * Optional per-user unit access. `STORE_ACCESS="ana@x.com=02,03;bob@y.com=BC"` limits those users to the listed units;
 * users not listed (and the administrator) keep full access, as before. Filtering happens on the server before any
 * metric, insight, AI context or response is built, so network totals only contain allowed units.
 */
import type {Data} from './model';
export function storeAccess(email:string,admin=false,spec=process.env.STORE_ACCESS||''):string[]|null{
 if(admin)return null;const me=email.trim().toLowerCase();
 for(const part of spec.split(';')){const [who,units]=part.split('=');if(who?.trim().toLowerCase()===me)return (units||'').split(',').map(s=>s.trim()).filter(Boolean)}
 return null;
}
const inside=(ok:Set<string>)=>(r:{store?:string})=>!!r.store&&ok.has(r.store);
export function restrictData<T extends Partial<Data>>(data:T,allowed:string[]|null):T{
 if(!allowed)return data;const ok=new Set(allowed),f=inside(ok);
 return {...data,sales:data.sales?.filter(f),stock:data.stock?.filter(f),totals:data.totals?.filter(f),goals:data.goals?.filter(f),purchases:data.purchases?.filter(f),controls:data.controls?.filter(f)};
}
/** Saved action visible only when every unit it mentions is allowed (network-wide cards stay hidden). */
export function actionAllowed(payload:string,allowed:string[]|null){if(!allowed)return true;try{const p=JSON.parse(payload),units=[p.store,p.from,p.to].filter((x:unknown)=>typeof x==='string'&&x);return units.length>0&&units.every((x:string)=>allowed.includes(x))}catch{return false}}
/** Saved report visible only when it is about a single allowed unit. */
export function reportAllowed(payload:string,allowed:string[]|null,names:Map<string,string>){if(!allowed)return true;try{const p=JSON.parse(payload);return allowed.some(id=>names.get(id)===p.channel)}catch{return false}}
