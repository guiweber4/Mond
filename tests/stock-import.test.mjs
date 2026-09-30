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
const dbSource=(await fs.readFile(new URL('../lib/db.ts',import.meta.url),'utf8')).replace("import { env } from 'cloudflare:workers';","const env={DB:globalThis.testDB,BUCKET:globalThis.testBucket};");
await fs.writeFile(path.join(tmp,'db.mjs'),ts.transpileModule(dbSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
let route=await fs.readFile(new URL('../app/api/import/route.ts',import.meta.url),'utf8');
await fs.writeFile(path.join(tmp,'route.mjs'),ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]@\/lib\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {POST}=await import(path.join(tmp,'route.mjs'));
const {presenceStockFields}=await import(path.join(tmp,'presence-stock.mjs'));
const {norm}=await import(path.join(tmp,'imports.mjs'));
const {readRecords}=await import(path.join(tmp,'db.mjs'));
const {inventory}=await import(path.join(tmp,'model.mjs'));
const date='2026-09-29',fixtures=process.argv[2];let total=0,combined=[],lastSend,lastRows;
for(const file of (await fs.readdir(fixtures)).filter(f=>f.startsWith('SALDO')&&f.endsWith('.xlsx'))){
 const bytes=await fs.readFile(path.join(fixtures,file)),wb=XLSX.read(bytes),raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}),headers=Object.keys(raw[0]);
 const mapping=Object.fromEntries(presenceStockFields.map(f=>[f.key,headers.find(h=>f.aliases.includes(norm(h)))||'']));
 const store=/JK/.test(file)?'02':/ECOMM/.test(file)?'03':/RJ/.test(file)?'05':'BC';
 const v=normalizeRows(raw,mapping,'stock',defaultStores,{store,start:date,end:date,date});assert.deepEqual(v.errors,[]);assert.equal(v.summaryRows,1);validateNormalized(v.rows,'stock',defaultStores);
 const control=raw.at(-1)['Saldo Base'],sum=Math.round(v.rows.reduce((a,r)=>a+r.physical,0)*1e6)/1e6;assert.equal(sum,control);assert.equal(v.rows.length,raw.length-1-v.mergedRows);
 const send=rows=>POST(new Request('https://test/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'stock',rows,fileName:file,fileBase64:bytes.toString('base64')})}));
 const response=await send(v.rows),result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.count,v.rows.length);assert.equal((await (await send(v.rows)).json()).duplicate,true);
 const data=await readRecords(),stock=data.stock.filter(r=>r.store===store);assert.equal(stock.length,v.rows.length);assert.equal(Math.round(stock.reduce((a,r)=>a+r.physical,0)*1e6)/1e6,control);
 const shown=inventory(data,defaultStores,date,store);assert.equal(shown.length,v.rows.length);assert.ok(shown.every(r=>r.model&&r.color!=='—'&&r.size!=='—'));assert.equal(shown.filter(r=>r.physical<0).length,v.rows.filter(r=>r.physical<0).length);
 assert.ok(normalizeRows([...raw.slice(0,-1),{...raw.at(-1),'Saldo Base':control+1}],mapping,'stock',defaultStores,{store,start:date,end:date,date}).errors.length);
 total+=control;combined.push(...v.rows);lastSend=send;lastRows=v.rows;console.log(`${file}: ${raw.length-1} lines -> ${v.rows.length} variants, ${sum} balance reconciled; ${v.mergedRows} repeated lines merged.`);
}
assert.equal(combined.length,7039);assert.equal(Math.round(total*10)/10,8445.2);
const reduced=lastRows.slice(1);assert.equal((await lastSend(reduced)).status,200);let data=await readRecords();assert.equal(data.stock.filter(r=>r.store===lastRows[0].store).length,reduced.length,'replacing same date removes absent variants');
assert.equal((await (await lastSend(lastRows)).json()).count,lastRows.length,'older file can become current again');data=await readRecords();assert.equal(data.stock.length,7039);
const legacy=normalizeRows([{data:date,loja:'02',sku:'LEGACY',estoque:10,reservado:2,transito:1}],guessMapping(['data','loja','sku','estoque','reservado','transito'],'stock'),'stock',defaultStores);assert.deepEqual(legacy.errors,[]);validateNormalized(legacy.rows,'stock',defaultStores);
await fs.rm(tmp,{recursive:true,force:true});console.log('Passed: actual XLSX parsing, database writes/reads, negative and fractional quantities, source balances, snapshot replacement, retries, legacy input and inventory display.');
