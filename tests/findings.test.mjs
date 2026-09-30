// Findings engine + consolidated report on the real fixtures (RJ left out on purpose, as in production).
// Usage: node tests/findings.test.mjs <fixtures-dir>
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {setup} from './harness.mjs';
const h=await setup('findings');
const {defaultStores}=await h.load('model'),{normalizeRows,guessMapping,norm}=await h.load('imports'),{presenceStockFields}=await h.load('presence-stock'),F=await h.load('findings'),R=await h.load('consolidated-report');
const fixtures=process.argv[2];assert.ok(fixtures,'Informe a pasta das planilhas.');
const storeOf=f=>/JK/.test(f)?'02':/ECOMM/.test(f)?'03':/RJ/.test(f)?'05':'BC';const totals=[],stock=[];
for(const f of await fs.readdir(fixtures)){if(/RJ/.test(f))continue;const wb=XLSX.read(await fs.readFile(path.join(fixtures,f))),raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}),hs=Object.keys(raw[0]);
 if(f.startsWith('TOTAL'))totals.push(...normalizeRows(raw,guessMapping(hs,'totals'),'totals',defaultStores,{store:storeOf(f),start:'2026-09-01',end:'2026-09-30'}).rows);
 else stock.push(...normalizeRows(raw,Object.fromEntries(presenceStockFields.map(x=>[x.key,hs.find(k=>x.aliases.includes(norm(k)))||''])),'stock',defaultStores,{store:storeOf(f),start:'2026-09-30',end:'2026-09-30',date:'2026-09-30'}).rows)}
const out=F.computeFindings(totals,stock,defaultStores,{today:'2026-09-30'});
assert.ok(out.length>20);assert.equal(new Set(out.map(f=>f.id)).size,out.length,'ids únicos e estáveis');
assert.deepEqual(F.computeFindings(totals,stock,defaultStores,{today:'2026-09-30'}).map(f=>f.id),out.map(f=>f.id),'determinístico');
assert.ok(out.every(f=>f.title&&f.suggestion&&f.evidence.length),'todo achado tem evidência e sugestão');assert.ok(out.filter(f=>f.kind!=='dados').every(f=>f.action&&f.metrics?.length>=2&&f.subtitle),'cards com números e ação curta');
const rank={alta:0,media:1,baixa:2};assert.ok(out.every((f,i)=>i===0||rank[out[i-1].priority]<=rank[f.priority]),'ordenado por prioridade');
// RJ has no files: data findings instead of fake zeros.
assert.ok(out.some(f=>f.id==='dados:vendas:05:2026-09-01|2026-09-30')&&out.some(f=>f.id==='dados:estoque:05'));assert.ok(!out.some(f=>f.kind!=='dados'&&(f.store==='05'||f.to==='05'||f.from==='05')));
// Transfers never take more than the donor can spare (its balance minus what it sold itself).
const bal=(store,ref)=>stock.filter(r=>r.store===store&&r.reference.trim()===ref).reduce((a,r)=>a+r.physical,0),sold=(store,ref)=>totals.filter(t=>t.store===store&&t.reference.trim()===ref).reduce((a,t)=>a+t.qty,0);
for(const f of out.filter(f=>f.kind==='ruptura')){const b=bal(f.from,f.reference),own=sold(f.from,f.reference),spare=Math.floor(own>0?b-own:b/2);assert.ok(f.qty>=1&&f.qty<=spare,`${f.id}: ${f.qty} ≤ ${spare}`);assert.ok(bal(f.to,f.reference)<=0);assert.ok(sold(f.to,f.reference)>0)}
const perfume=out.find(f=>f.reference==='10HO0001'&&f.to==='02');assert.ok(perfume,'PERFUME KYOTO sem saldo na JK é sinalizado');
assert.ok(out.filter(f=>f.kind==='negativo').every(f=>/saldo negativo/i.test(f.title)&&f.metrics.length===2));
// Report: readable, bounded and reconciled.
const rep=R.consolidatedReport(totals,defaultStores,'2026-09-01','2026-09-30','all',{stock,today:'2026-09-30'});
assert.equal(rep.revenue,2268565.55);assert.equal(rep.units,2681);assert.ok(rep.products.length<=10&&rep.categories.length<=8&&rep.attention.length<=6);
assert.ok(JSON.stringify(rep).length<20000,'relatório enxuto');assert.ok(rep.summary.some(s=>/RJ/.test(s)),'avisa unidade sem arquivo');assert.equal(rep.stock.length,3);
const jk=R.consolidatedReport(totals,defaultStores,'2026-09-01','2026-09-30','02',{stock,today:'2026-09-30'});assert.equal(jk.revenue,1291617.77);assert.ok(jk.stock.every(s=>s.name.startsWith('JK')));
await h.cleanup();console.log(`Passed: ${out.length} achados (${out.filter(f=>f.priority==='alta').length} alta), transferências dentro do saldo livre da origem, RJ como falta de dados, relatório consolidado enxuto e conciliado.`);
