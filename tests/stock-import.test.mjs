import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {setup} from './harness.mjs';
const h=await setup('stock');
const {defaultStores,inventory}=await h.load('model');
const {normalizeRows,guessMapping,validateNormalized,norm}=await h.load('imports');
const {presenceStockFields}=await h.load('presence-stock');
const {POST}=await h.load('route');
const {readRecords}=h.db;
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
 const shown=inventory(data,defaultStores,date,store);assert.equal(shown.length,v.rows.length);assert.ok(shown.every(r=>r.model&&r.color!=='—'&&r.size!=='—'));assert.ok(shown.every(r=>r.physical>=0),'negativo conta como zero');assert.equal(shown.filter(r=>r.reported<0).length,v.rows.filter(r=>r.physical<0).length,'valor original preservado em reported');
 assert.ok(normalizeRows([...raw.slice(0,-1),{...raw.at(-1),'Saldo Base':control+1}],mapping,'stock',defaultStores,{store,start:date,end:date,date}).errors.length);
 total+=control;combined.push(...v.rows);lastSend=send;lastRows=v.rows;console.log(`${file}: ${raw.length-1} lines -> ${v.rows.length} variants, ${sum} balance reconciled; ${v.mergedRows} repeated lines merged.`);
}
assert.equal(combined.length,7039);assert.equal(Math.round(total*10)/10,8445.2);
const reduced=lastRows.slice(1);assert.equal((await lastSend(reduced)).status,200);let data=await readRecords();assert.equal(data.stock.filter(r=>r.store===lastRows[0].store).length,reduced.length,'replacing same date removes absent variants');
assert.equal((await (await lastSend(lastRows)).json()).count,lastRows.length,'older file can become current again');data=await readRecords();assert.equal(data.stock.length,7039);
const legacy=normalizeRows([{data:date,loja:'02',sku:'LEGACY',estoque:10,reservado:2,transito:1}],guessMapping(['data','loja','sku','estoque','reservado','transito'],'stock'),'stock',defaultStores);assert.deepEqual(legacy.errors,[]);validateNormalized(legacy.rows,'stock',defaultStores);
// Upload flow used by the browser: original already in Storage, referenced by key.
const key=`imports/${crypto.randomUUID()}/original`;await h.stats.files.set(key,1000);const viaKey=await POST(new Request('https://test/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'stock',rows:lastRows.map(r=>({...r,id:r.id.replace(date,'2026-09-30'),date:'2026-09-30'})),fileName:'via-storage.xlsx',fileKey:key})}));assert.equal(viaKey.status,200,await viaKey.clone().text());
const missing=await POST(new Request('https://test/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'stock',rows:lastRows,fileName:'x.xlsx',fileKey:`imports/${crypto.randomUUID()}/original`})}));assert.equal(missing.status,400,'arquivo ausente no Storage é recusado');
const bad=await POST(new Request('https://test/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'stock',rows:[{...lastRows[0],physical:'x'}],fileName:'x.xlsx',fileBase64:'AA=='})}));assert.equal(bad.status,400);
assert.equal((await h.pg.query("SELECT count(*)::int AS n FROM imports WHERE status<>'ready'")).rows[0].n,0,'nenhuma importação parcial ou pendente');
await h.cleanup();console.log('Passed: actual XLSX parsing, database writes/reads, negative and fractional quantities, source balances, snapshot replacement, retries, legacy input and inventory display.');
