import {demoData,shift,type Data} from './model';
import {defaultOps,type OpsConfig} from './operations';
export const demoOps:OpsConfig={...defaultOps,leadDays:21,routes:[{from:'05',to:'02',days:3,fixedCost:45,unitCost:2},{from:'02',to:'05',days:3,fixedCost:45,unitCost:2},{from:'03',to:'02',days:1,fixedCost:20,unitCost:1},{from:'02',to:'03',days:1,fixedCost:20,unitCost:1}],rules:[]};
export function demoOperationalData():Data{
 const data=demoData();const current=[...data.stock];data.stock=Array.from({length:28},(_,i)=>current.map(s=>({...s,id:`${shift(s.date,-i)}:${s.store}:${s.sku}`,date:shift(s.date,-i),physical:s.physical+(i%7)}))).flat();
 const controls=new Map<string,{id:string;date:string;store:string;revenue:number;units:number}>();
 for(const s of data.sales){const date=s.date.slice(0,10),id=s.store+':'+date,c=controls.get(id)||{id,date,store:s.store,revenue:0,units:0};if(s.status!=='cancelled'){c.revenue+=(s.status==='return'?-1:1)*s.amount;c.units+=(s.status==='return'?-1:1)*s.qty}controls.set(id,c)}data.controls=[...controls.values()];
 data.purchases=[{id:'DEMO-PC-001',store:'02',sku:'MP001-P',supplier:'Confecção exemplo',date:'2026-09-10',expected:'2026-10-08',qty:40,received:5,unitCost:292,status:'open'},{id:'DEMO-PC-002',store:'03',sku:'MP004-P',supplier:'Confecção exemplo',date:'2026-09-01',expected:'2026-09-24',qty:24,received:0,unitCost:132,status:'open'}];return data;
}
