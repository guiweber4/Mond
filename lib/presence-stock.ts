import type {Stock,Store} from './model';
import {validDate} from './totals';
export const presenceStockFields=[
 {key:'reference',label:'Referência do modelo',required:true,aliases:['referencia']},
 {key:'model',label:'Modelo / descrição do item',required:true,aliases:['descricao_item']},
 {key:'color',label:'Cor (primeira Descrição)',required:true,aliases:['descricao','cor']},
 {key:'size',label:'Tamanho (segunda Descrição)',required:true,aliases:['descricao_1','tamanho']},
 {key:'physical',label:'Saldo Base',required:true,aliases:['saldo_base']},
];
const clean=(v:unknown)=>String(v??'').trim().replace(/\s+/g,' ');
export function presenceSku(reference:string,size:string,color:string){return 'presence:'+ [reference,size,color.replace(/\s*-\s*/g,' - ')].map(encodeURIComponent).join(':')}
export function validatePresenceStock(r:Stock,stores:Store[]){
 if(r.sourceFormat!=='presence-stock'||!stores.some(s=>s.id===r.store)||!validDate(r.date)||![r.reference,r.model,r.color,r.size].every(v=>typeof v==='string'&&v.trim()&&v.length<=160)||r.sku!==presenceSku(r.reference!,r.size!,r.color!)||r.id!==`${r.date}:${r.store}:${r.sku}`||!Number.isFinite(r.physical)||Math.abs(r.physical)>1e9||r.reserved!==0||r.incoming!==0)throw new Error('Saldo Presence inválido. Confira unidade, data, referência, cor, tamanho e saldo.');
 if(!Array.isArray(r.sourceBalances)||!r.sourceBalances.length||r.sourceBalances.some(n=>!Number.isFinite(n))||Math.abs(r.sourceBalances.reduce((a,n)=>a+n,0)-r.physical)>0.000001)throw new Error('Saldo consolidado não confere com as linhas de origem.');
}
export function normalizePresenceStock(raw:Record<string,unknown>[],mapping:Record<string,string>,stores:Store[],context?:{store:string;date?:string}){
 const rows:Stock[]=[],errors:string[]=[],grouped=new Map<string,Stock>();let summaryRows=0,control:number|undefined,mergedRows=0;
 const parse=(v:unknown)=>{const n=typeof v==='number'?v:Number(clean(v).replace(/\./g,'').replace(',','.'));if(clean(v)===''||!Number.isFinite(n))throw new Error('saldo numérico ausente ou inválido');return n};
 raw.forEach((source,index)=>{try{const v=Object.fromEntries(presenceStockFields.map(f=>[f.key,source[mapping[f.key]]]));
 if(clean(v.reference).toUpperCase()==='TOTAL'&&!clean(v.model)&&!clean(v.color)&&!clean(v.size)){summaryRows++;control=parse(v.physical);return;}
 if(!context||!context.date)throw new Error('Informe a unidade e a data da posição.');
 const reference=clean(v.reference),model=clean(v.model),color=clean(v.color).replace(/\s*-\s*/g,' - '),size=clean(v.size),physical=parse(v.physical),sku=presenceSku(reference,size,color);
 const row:Stock={id:`${context.date}:${context.store}:${sku}`,date:context.date,store:context.store,sku,reference,model,color,size,physical,reserved:0,incoming:0,sourceFormat:'presence-stock',sourceBalances:[physical]};validatePresenceStock(row,stores);
 const previous=grouped.get(sku);if(previous){if(previous.model!==model)throw new Error('Descrições diferentes para a mesma referência, cor e tamanho.');previous.physical=Math.round((previous.physical+physical)*1e6)/1e6;previous.sourceBalances!.push(physical);mergedRows++;}else grouped.set(sku,row);
 }catch(e){errors.push(`Linha ${index+2}: ${(e as Error).message}`)}});
 rows.push(...grouped.values());if(summaryRows>1)errors.push('Use uma única linha TOTAL por aba.');if(control!==undefined&&Math.abs(rows.reduce((a,r)=>a+r.physical,0)-control)>0.000001)errors.push('A linha TOTAL não confere com a soma dos saldos. Confira a planilha e o mapeamento.');
 return {rows,errors,summaryRows,mergedRows};
}
