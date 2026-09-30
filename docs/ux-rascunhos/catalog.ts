/** Presentation-only grouping. Source values and identities remain unchanged. */
export type CatalogRow={id:string;reference:string;model:string;category:string;color:string;size:string;qty:number;amount?:number;store?:string;date?:string;status?:string};
export type CatalogModel={key:string;reference:string;model:string;category:string;qty:number;amount:number;variants:number;rows:CatalogRow[]};
export const searchKey=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function modelKey(r:CatalogRow){return JSON.stringify([r.category,r.reference||r.model])}
export function groupCatalog(rows:CatalogRow[]):CatalogModel[]{
 const groups=new Map<string,CatalogModel>();
 for(const r of rows){const key=modelKey(r);const m=groups.get(key)||{key,reference:r.reference,model:r.model,category:r.category,qty:0,amount:0,variants:0,rows:[]};m.rows.push(r);m.qty+=r.qty;m.amount+=Math.round((r.amount||0)*100);groups.set(key,m)}
 return [...groups.values()].map(m=>({...m,qty:Math.round(m.qty*1e6)/1e6,amount:m.amount/100,variants:new Set(m.rows.map(r=>JSON.stringify([r.color,r.size]))).size}));
}
export function catalogCategories(models:CatalogModel[]){const map=new Map<string,{name:string;models:number;qty:number;amount:number}>();for(const m of models){const c=map.get(m.category)||{name:m.category,models:0,qty:0,amount:0};c.models++;c.qty+=m.qty;c.amount+=Math.round(m.amount*100);map.set(m.category,c)}return [...map.values()].map(c=>({...c,amount:c.amount/100}));}
export function filterCatalog(models:CatalogModel[],category:string,model:string,query:string){const q=searchKey(query.trim());return models.filter(m=>(!category||m.category===category)&&(!model||m.key===model)&&(!q||searchKey([m.reference,m.model,m.category,...m.rows.map(r=>`${r.color} ${r.size} ${r.store||''}`)].join(' ')).includes(q)))}
export function sizeOrder(a:string,b:string){const labels=['PP','P','M','G','GG','XG','2XG','3XG','4XG','UNI'];const label=(v:string)=>v.replace(/^\d+\s*-\s*/,'').toUpperCase();const x=label(a),y=label(b),i=labels.indexOf(x),j=labels.indexOf(y);return i>=0&&j>=0?i-j:x.localeCompare(y,'pt-BR',{numeric:true});}
export function gradeMatrix(rows:CatalogRow[]){const colors=[...new Set(rows.map(r=>r.color||'Não informado'))].sort(),sizes=[...new Set(rows.map(r=>r.size||'Não informado'))].sort(sizeOrder),cells=new Map<string,number>();for(const r of rows){const key=JSON.stringify([r.color||'Não informado',r.size||'Não informado']);cells.set(key,Math.round(((cells.get(key)||0)+r.qty)*1e6)/1e6)}return {colors,sizes,cells};}
