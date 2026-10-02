import {database,readRecords} from './db';
import {restrictData,reportAllowed} from './access';
import type {SavedAction} from './insights';
import {defaultStores,today,type Store} from './model';
import {defaultOps} from './operations';
/** Shared entry point for dashboards, reports and future channels: same data, permissions and rules everywhere. */
export async function load(user:{stores:string[]|null}){
 const db=database();const [data,settings,actions,reports]=await Promise.all([readRecords(),db.prepare("SELECT id,payload FROM settings WHERE id IN ('stores','operations','insights','reference_aliases','reference_types')").all<{id:string;payload:string}>(),db.prepare('SELECT dataset,status,payload,updated_at FROM actions').all<SavedAction>(),db.prepare("SELECT title,created_at,payload FROM reports WHERE dataset='real' ORDER BY created_at DESC LIMIT 30").all<{title:string;created_at:string;payload:string}>()]);
 const cfg=Object.fromEntries(settings.results.map(r=>[r.id,JSON.parse(r.payload)])),all:Store[]=cfg.stores||defaultStores,allowed=user.stores,d=restrictData(data,allowed);
 const prev=reports.results.find(r=>r.payload.includes('"insightSnapshot"')&&reportAllowed(r.payload,allowed,new Map(all.map(s=>[s.id,s.name]))));
 const previous=prev?(()=>{const p=JSON.parse(prev.payload);return {snapshot:p.insightSnapshot,title:prev.title,createdAt:prev.created_at}})():null;
 return {input:{ops:cfg.operations||defaultOps,totals:d.totals||[],stock:d.stock,stores:allowed?all.filter(s=>allowed.includes(s.id)):all,goals:d.goals,sales:d.sales.length,purchases:d.purchases,routes:(cfg.operations||defaultOps).routes?.length||0,saved:actions.results,today:today(),config:cfg.insights,tables:{aliases:cfg.reference_aliases,types:cfg.reference_types}},previous,allStores:all};
}
