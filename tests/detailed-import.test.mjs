import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {setup} from './harness.mjs';
const h=await setup('totals');
const {defaultStores}=await h.load('model');
const {normalizeRows,guessMapping,validateNormalized}=await h.load('imports');
const {summarizeTotals}=await h.load('totals');
const {POST}=await h.load('route');
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
const summary=summarizeTotals(all,defaultStores,'2026-09-01','2026-09-30');assert.equal(summary.units,2681);assert.equal(summary.amount,2268565.55);assert.equal(summary.variants.reduce((s,r)=>s+r.qty,0),summary.units);assert.equal(summary.products.reduce((s,r)=>s+r.qty,0),summary.units);assert.equal((await h.pg.query("SELECT count(*)::int AS n FROM records")).rows[0].n,1022);assert.equal((await h.db.readTotals()).length,1022);assert.ok(h.stats.queries<80,`queries=${h.stats.queries}`);
const legacy=normalizeRows([{REFERENCIA:'OLD',NM_GRUPO:'CALÇAS',DESCRICAO:'Old model',QT:1,VALOR:100}],guessMapping(['REFERENCIA','NM_GRUPO','DESCRICAO','QT','VALOR'],'totals'),'totals',defaultStores,{store:'02',start:'2026-09-01',end:'2026-09-30'});assert.deepEqual(legacy.errors,[]);validateNormalized(legacy.rows,'totals',defaultStores);
await h.cleanup();console.log('Passed: 1,022 variations, model aggregation, legacy compatibility, JSON endpoint, database persistence and retries.');
