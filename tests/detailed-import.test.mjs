import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import XLSX from 'xlsx';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'mondepars-import-'));
for(const name of ['presence-stock','model','imports','totals','report','operations','demo-operations']){
 const source=await fs.readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
 await fs.writeFile(path.join(tmp,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
}
const {defaultStores}=await import(path.join(tmp,'model.mjs'));
const {normalizeRows,guessMapping,validateNormalized}=await import(path.join(tmp,'imports.mjs'));
const {summarizeTotals}=await import(path.join(tmp,'totals.mjs'));
const db=new DatabaseSync(':memory:');
for(const file of (await fs.readdir(new URL('../drizzle',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())db.exec(await fs.readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
let queries=0;
globalThis.testDB={prepare(sql){const statement={bind(...args){statement.args=args;return statement},async first(){return db.prepare(sql).get(...(statement.args||[]))||null},async all(){return {results:db.prepare(sql).all(...(statement.args||[]))}},async run(){queries++;return db.prepare(sql).run(...(statement.args||[]))}};return statement},async batch(statements){db.exec('BEGIN');try{for(const s of statements)await s.run();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}};
globalThis.testBucket={async put(){}};
await fs.writeFile(path.join(tmp,'db.mjs'),`export const database=()=>globalThis.testDB,bucket=()=>globalThis.testBucket,json=(v,s=200)=>Response.json(v,{status:s}),fail=e=>Response.json({error:e.message},{status:400}),checkOrigin=()=>{},readRecords=async()=>({sales:[],totals:(await database().prepare("SELECT r.payload FROM records r JOIN total_batches b ON b.import_id=r.import_id").all()).results.map(r=>JSON.parse(r.payload))});`);
let route=await fs.readFile(new URL('../app/api/import/route.ts',import.meta.url),'utf8');
await fs.writeFile(path.join(tmp,'route.mjs'),ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]@\/lib\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {POST}=await import(path.join(tmp,'route.mjs'));
const fixtures=process.argv[2];let all=[];
for(const file of (await fs.readdir(fixtures)).filter(f=>f.startsWith('TOTAL')&&f.endsWith('.xlsx'))){
 const bytes=await fs.readFile(path.join(fixtures,file));const wb=XLSX.read(bytes);const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
 const store=/JK/.test(file)?'02':/ECOMM/.test(file)?'03':'BC';const mapping=guessMapping(Object.keys(raw[0]),'totals');
 const context={store,start:'2026-09-01',end:'2026-09-30'};
 const v=normalizeRows(raw,mapping,'totals',defaultStores,context);assert.deepEqual(v.errors,[]);assert.equal(v.summaryRows,1);assert.equal(v.rows.length,raw.length-1);validateNormalized(v.rows,'totals',defaultStores);
 const control=raw.at(-1);assert.equal(v.rows.reduce((s,r)=>s+r.qty,0),control.QT);assert.equal(v.rows.reduce((s,r)=>s+Math.round(r.amount*100),0),Math.round(control.VALOR*100));
 const send=rows=>POST(new Request('https://test/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'totals',rows,fileName:file,fileBase64:bytes.toString('base64')})}));
 const response=await send(v.rows);const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.count,v.rows.length);assert.equal(result.reportWarning,'');assert.equal((await (await send(v.rows)).json()).duplicate,true);
 assert.ok(normalizeRows([...raw.slice(0,-1),{...control,QT:control.QT+1}],mapping,'totals',defaultStores,context).errors.length);
 assert.throws(()=>validateNormalized([v.rows[0],v.rows[0]],'totals',defaultStores));
 all.push(...v.rows);console.log(`${file}: ${v.rows.length} variants persisted, control totals match, duplicate retry protected.`);
}
const summary=summarizeTotals(all,defaultStores,'2026-09-01','2026-09-30');assert.equal(summary.units,2681);assert.equal(summary.amount,2268565.55);assert.equal(summary.variants.reduce((s,r)=>s+r.qty,0),summary.units);assert.equal(summary.products.reduce((s,r)=>s+r.qty,0),summary.units);assert.equal(db.prepare("SELECT count(*) AS n FROM records").get().n,1022);assert.ok(queries<40,`queries=${queries}`);
const legacy=normalizeRows([{REFERENCIA:'OLD',NM_GRUPO:'CALÇAS',DESCRICAO:'Old model',QT:1,VALOR:100}],guessMapping(['REFERENCIA','NM_GRUPO','DESCRICAO','QT','VALOR'],'totals'),'totals',defaultStores,{store:'02',start:'2026-09-01',end:'2026-09-30'});assert.deepEqual(legacy.errors,[]);validateNormalized(legacy.rows,'totals',defaultStores);
await fs.rm(tmp,{recursive:true,force:true});console.log('Passed: 1,022 variations, model aggregation, legacy compatibility, JSON endpoint, database persistence and retries.');
