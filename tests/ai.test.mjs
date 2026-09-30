// AI layer: contexts per purpose from the real fixtures, slide parsing and provider envelopes (simulated; no network).
// Usage: node tests/ai.test.mjs <fixtures-dir>
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {setup} from './harness.mjs';
import ts from 'typescript';
const h=await setup('ai');
for(const lib of ['ai-core','ai-context'])await fs.writeFile(path.join(h.tmp,lib+'.mjs'),ts.transpileModule(await fs.readFile(new URL(`../lib/${lib}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
const {defaultStores}=await h.load('model'),{normalizeRows,guessMapping,norm}=await h.load('imports'),{presenceStockFields}=await h.load('presence-stock'),{defaultOps}=await h.load('operations');
const ai=await h.load('ai-core'),ctx=await h.load('ai-context');
const fixtures=process.argv[2];assert.ok(fixtures,'Informe a pasta das planilhas.');
const storeOf=f=>/JK/.test(f)?'02':/ECOMM/.test(f)?'03':/RJ/.test(f)?'05':'BC';const data={sales:[],products:[],stock:[],goals:[],totals:[]};
for(const f of await fs.readdir(fixtures)){const wb=XLSX.read(await fs.readFile(path.join(fixtures,f))),raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}),hs=Object.keys(raw[0]);
 if(f.startsWith('TOTAL')){const v=normalizeRows(raw,guessMapping(hs,'totals'),'totals',defaultStores,{store:storeOf(f),start:'2026-09-01',end:'2026-09-29'});data.totals.push(...v.rows)}
 else{const v=normalizeRows(raw,Object.fromEntries(presenceStockFields.map(x=>[x.key,hs.find(k=>x.aliases.includes(norm(k)))||''])),'stock',defaultStores,{store:storeOf(f),start:'2026-09-29',end:'2026-09-29',date:'2026-09-29'});data.stock.push(...v.rows)}}
const params={dataset:'real',start:'2026-09-01',end:'2026-09-30',channel:'all'};
for(const purpose of Object.keys(ai.purposes).filter(p=>p!=='report')){
 const text=ctx.buildContext({...params,purpose},data,defaultStores,defaultOps,[]),c=JSON.parse(text);
 assert.equal(c.vendasConsolidadas.valorTotalizado,2268565.55,purpose);assert.equal(c.vendasConsolidadas.pecasLiquidas,2681);
 assert.equal(Math.round(c.estoque.porUnidade.reduce((a,u)=>a+u.saldo,0)*10)/10,8445.2,'saldo por unidade preservado');
 assert.ok(c.sinaisVendasEstoque.disponivel&&c.sinaisVendasEstoque.vendeComSaldoBaixo.length>0,'sinais entre vendas e estoque');
 assert.equal(c.operacional.disponivel,false,'sem vendas diárias não há consumo/cobertura');
 assert.ok(text.length<60000,`contexto enxuto (${text.length})`);assert.ok(!/sb_secret|service_role|DATABASE_URL/i.test(text));
}
const jk=JSON.parse(ctx.buildContext({...params,purpose:'analysis',channel:'02'},data,defaultStores,defaultOps,[]));assert.equal(jk.vendasConsolidadas.valorTotalizado,1291617.77);assert.ok(jk.estoque.porUnidade.every(u=>u.unidade.startsWith('JK')));
const report=JSON.parse(ctx.buildContext({...params,purpose:'report',report:{period:'x',products:Array(50).fill({a:1}),ai:{text:'antigo'}}},data,defaultStores,defaultOps,[]));assert.equal(report.relatorio.products.length,20);assert.equal(report.relatorio.ai,undefined);
// Slides
const slides=ctx.parseSlides('## Visão geral\n- R$ 2,27 mi no período\n- 3 unidades com arquivo\n> Nota: RJ sem totalização\n\n## Próximos passos\n* Validar saldo negativo\nTexto solto ignorado');
assert.equal(slides.length,2);assert.deepEqual(slides[0].bullets,['R$ 2,27 mi no período','3 unidades com arquivo']);assert.equal(slides[0].note,'RJ sem totalização');assert.equal(slides[1].bullets[0],'Validar saldo negativo');
// Provider envelope per purpose (OpenAI Responses)
for(const purpose of Object.keys(ai.purposes)){let sent;const r=await ai.invokeProvider({id:'p',name:'t',provider:'openai',model:'gpt-test',enabled:true},'sk-test-123456','{}',false,async(url,init)=>{sent=JSON.parse(init.body);return Response.json({output:[{content:[{type:'output_text',text:'ok'}]}],usage:{input_tokens:1,output_tokens:1}})},purpose);
 assert.equal(r.text,'ok');assert.equal(sent.max_output_tokens,ai.purposes[purpose].max);assert.ok(sent.instructions.includes(ai.purposes[purpose].task.slice(0,20)));assert.equal(sent.store,false)}
await assert.rejects(()=>ai.invokeProvider({id:'p',name:'t',provider:'openai',model:'m',enabled:true},'sk-test-123456','{}',false,async()=>Response.json({status:'incomplete',output:[]}),'executive'),/limite de resposta/);
await h.cleanup();console.log(`Passed: ${Object.keys(ai.purposes).length} finalidades de IA com contexto conciliado (R$ 2.268.565,55 · saldo 8.445,2), filtro por unidade, relatório enxuto, slides e envelopes OpenAI simulados.`);
