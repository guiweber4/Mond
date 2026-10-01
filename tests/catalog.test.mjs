// Explorer regression: category → model → grade → detail reconcile with the real Presence fixtures.
// Usage: node tests/catalog.test.mjs <fixtures-dir>
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import XLSX from 'xlsx';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'mondepars-catalog-'));
for(const name of ['presence-stock','model','imports','totals','catalog','operations','report','demo-operations']){
 const source=await fs.readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
 await fs.writeFile(path.join(tmp,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
}
const {defaultStores,inventory}=await import(path.join(tmp,'model.mjs'));
const {normalizeRows,guessMapping,norm}=await import(path.join(tmp,'imports.mjs'));
const {presenceStockFields}=await import(path.join(tmp,'presence-stock.mjs'));
const {summarizeTotals}=await import(path.join(tmp,'totals.mjs'));
const C=await import(path.join(tmp,'catalog.mjs'));
const fixtures=process.argv[2];assert.ok(fixtures,'Informe a pasta das planilhas.');
const read=async file=>{const wb=XLSX.read(await fs.readFile(path.join(fixtures,file)));return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})};
const storeOf=f=>/JK/.test(f)?'02':/ECOMM/.test(f)?'03':/RJ/.test(f)?'05':'BC';
const files=await fs.readdir(fixtures);const totals=[],stock=[];
for(const f of files.filter(f=>f.startsWith('TOTAL'))){const raw=await read(f);const v=normalizeRows(raw,guessMapping(Object.keys(raw[0]),'totals'),'totals',defaultStores,{store:storeOf(f),start:'2026-09-01',end:'2026-09-30'});assert.deepEqual(v.errors,[]);totals.push(...v.rows.map(r=>({...r,sourceFile:f})))}
for(const f of files.filter(f=>f.startsWith('SALDO'))){const raw=await read(f);const v=normalizeRows(raw,Object.fromEntries(presenceStockFields.map(f=>[f.key,Object.keys(raw[0]).find(h=>f.aliases.includes(norm(h)))||''])),'stock',defaultStores,{store:storeOf(f),start:'2026-09-29',end:'2026-09-29',date:'2026-09-29'});assert.deepEqual(v.errors,[]);stock.push(...v.rows)}
const cents=rows=>rows.reduce((a,r)=>a+Math.round((r.amount||0)*100),0);
const round=n=>Math.round(n*1e6)/1e6;

// Canonical size/color keep code apart from label; raw values stay available.
assert.deepEqual(C.canonSize('01 - 32'),{code:'01',label:'32'});assert.deepEqual(C.canonSize('03 - P      '),{code:'03',label:'P'});assert.deepEqual(C.canonSize('32'),{code:'',label:'32'});
assert.equal(C.canonColor('3    - CHUMBO   '),'3 - CHUMBO');assert.equal(C.canonColor('3   -CHUMBO'),'3 - CHUMBO');
assert.deepEqual(['G','UNI','PP','42','P','3XG','32','XPP','M','GG','XG','2XG',C.NOT_INFORMED].sort(C.sizeOrder),['XPP','PP','P','M','G','GG','XG','2XG','3XG','32','42','UNI',C.NOT_INFORMED]);

// Sales explorer
const s=summarizeTotals(totals,defaultStores,'2026-09-01','2026-09-30');const rows=C.totalsToCatalog(s.rows,defaultStores);
assert.equal(rows.length,1022);assert.equal(rows.reduce((a,r)=>a+r.qty,0),2681);assert.equal(cents(rows),226856555);
const models=C.groupCatalog(rows),cats=C.catalogCategories(models);
assert.equal(cats.reduce((a,c)=>a+c.qty,0),2681);assert.equal(Math.round(cats.reduce((a,c)=>a+c.amount*100,0)),226856555);
assert.ok(!models.some(m=>m.reference.toUpperCase()==='TOTAL'),'TOTAL não entra como produto');
const calcas=C.filterCatalog(models,'CALÇAS','','');assert.ok(calcas.length>0);assert.ok(calcas.every(m=>m.category==='CALÇAS'&&m.rows.every(r=>r.category==='CALÇAS')));
const calcaRows=rows.filter(r=>r.category==='CALÇAS');assert.equal(calcas.reduce((a,m)=>a+m.qty,0),calcaRows.reduce((a,r)=>a+r.qty,0));assert.equal(Math.round(calcas.reduce((a,m)=>a+m.amount*100,0)),cents(calcaRows));
// Homonyms: JEANS RETO MONDEPARS has several references and stays separated.
const jeans=calcas.filter(m=>m.model==='JEANS RETO MONDEPARS');assert.ok(jeans.length>=2,'Modelos homônimos devem continuar distintos');assert.equal(new Set(jeans.map(m=>m.key)).size,jeans.length);
// Selecting a model shows only its variations; grade, detail and summary reconcile.
for(const m of calcas){
 const only=C.filterCatalog(models,'CALÇAS',m.key,'');assert.equal(only.length,1);assert.ok(only[0].rows.every(r=>r.reference===m.reference));
 const g=C.gradeMatrix(m.rows);const gridQty=round([...g.cells.values()].reduce((a,c)=>a+c.qty,0)),gridCents=[...g.cells.values()].reduce((a,c)=>a+Math.round(c.amount*100),0);
 assert.equal(gridQty,m.qty);assert.equal(gridCents,Math.round(m.amount*100));
 for(const c of g.colors)for(const z of g.sizes){const cell=g.cells.get(C.cellKey(c,z)),detail=m.rows.filter(r=>r.color===c&&r.size===z);if(!detail.length)assert.equal(cell,undefined,'Ausente ≠ zero');else assert.equal(cell.qty,round(detail.reduce((a,r)=>a+r.qty,0)))}
}
// Zero is a value, absence is not.
const zero=C.gradeMatrix([{id:'a',reference:'R',model:'M',category:'X',categoryStatus:'source',color:'1 - AZUL',size:'P',sizeCode:'',rawColor:'',rawSize:'',qty:0,amount:0}]);assert.equal(zero.cells.get(C.cellKey('1 - AZUL','P')).qty,0);assert.equal(zero.cells.get(C.cellKey('1 - AZUL','M')),undefined);
// Legacy format without size/color: shown as "Não informado", never spread across variations.
const legacy=C.totalsToCatalog([{id:'x',store:'02',start:'2026-08-01',end:'2026-08-31',reference:'OLD',category:'CALÇAS',description:'Old',qty:3,amount:30,average:null}],defaultStores);assert.equal(legacy[0].size,C.NOT_INFORMED);assert.equal(legacy[0].color,C.NOT_INFORMED);assert.equal(C.gradeMatrix(legacy).cells.size,1);

// Stock explorer: every unit's balance is preserved, category only by unambiguous reference.
const inv=inventory({sales:[],products:[],stock,goals:[]},defaultStores,'2026-09-29');assert.equal(inv.length,7039);
const idx=C.categoryIndex(totals),srows=C.stockToCatalog(inv,idx);assert.equal(srows.length,7039);const effective=round(stock.reduce((a,r)=>a+Math.max(0,r.physical),0));assert.ok(effective>8445.2,'negativos zerados aumentam o saldo efetivo');assert.equal(round(srows.reduce((a,r)=>a+r.qty,0)),effective);
const smodels=C.groupCatalog(srows);assert.equal(round(C.catalogCategories(smodels).reduce((a,c)=>a+c.qty,0)),effective);
assert.ok(srows.every(r=>r.qty>=0)&&srows.some(r=>!Number.isInteger(r.qty)),'negativo vira zero; frações preservadas');
for(const r of srows){if(r.categoryStatus==='matched')assert.ok([...idx.get(r.reference)].length===1);else assert.equal(r.category,C.NO_CATEGORY)}
const matched=new Set(srows.filter(r=>r.categoryStatus==='matched').map(r=>r.reference));assert.ok(matched.size>0);
// Sales and stock sizes/colors converge to the same canonical labels for shared references.
const saleVariants=new Set(rows.map(r=>`${r.reference}|${r.color}|${r.size}`)),stockVariants=new Set(srows.map(r=>`${r.reference}|${r.color}|${r.size}`));
const shared=[...saleVariants].filter(k=>stockVariants.has(k));assert.ok(shared.length>rows.length*0.5,`variações em comum: ${shared.length}`);
assert.ok(inv.every(r=>r.status!=='idle'),'Sem vendas transacionais o status é “sem histórico”, não “sem venda”.');
assert.ok(inv.filter(r=>r.reported<0).every(r=>r.physical===0&&(r.status==='out'||r.status==='outdated')),'negativo = sem saldo');
await fs.rm(tmp,{recursive:true,force:true});
console.log(`Passed: ${models.length} modelos de vendas em ${cats.length} categorias; CALÇAS ${calcas.length} modelos (${jeans.length} “JEANS RETO MONDEPARS” distintos); grade = detalhe = resumo; estoque ${smodels.length} modelos, ${matched.size} referências com categoria inequívoca; ${shared.length} variações casam vendas × estoque.`);
