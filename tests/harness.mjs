// Shared test harness: transpiles lib/ and the import route, runs them on PGlite (in-memory Postgres)
// with the real Supabase migrations and the real lib/db.ts query code. Auth is stubbed; storage is in memory.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const libs=['presence-stock','model','imports','totals','catalog','report','operations','demo-operations','pg-adapter','config','db','findings','consolidated-report','metrics','identity','readiness','insights','analyst','access','color-swatch','overview-data','executive-deck','purchasing','data-tools','ai-core','chat'];
const transpile=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
export async function setup(name){
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),`mondepars-${name}-`));
 for(const lib of libs)await fs.writeFile(path.join(tmp,lib+'.mjs'),transpile(await fs.readFile(new URL(`../lib/${lib}.ts`,import.meta.url),'utf8')).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
 await fs.writeFile(path.join(tmp,'auth.mjs'),"export const requireUser=async()=>({id:'test',email:'teste@mondepars.test',admin:true,stores:null}),requireAdmin=requireUser;");
 await fs.writeFile(path.join(tmp,'route.mjs'),transpile(await fs.readFile(new URL('../app/api/import/route.ts',import.meta.url),'utf8')).replace(/from ['"]@\/lib\/([^'"]+)['"]/g,"from './$1.mjs'"));
 const pg=new PGlite();const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const f of (await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await fs.readFile(new URL(f,dir),'utf8'));
 const stats={queries:0,files:new Map()};
 const runner={query:async(text,params)=>{stats.queries++;return (await pg.query(text,params)).rows},transaction:fn=>pg.transaction(tx=>fn({query:async(text,params)=>{stats.queries++;return (await tx.query(text,params)).rows}}))};
 const files={async put(key,bytes){stats.files.set(key,bytes.byteLength)},async uploadUrl(key){return 'memory://'+key},async size(key){return stats.files.get(key)??null},async remove(key){stats.files.delete(key)}};
 const db=await import(path.join(tmp,'db.mjs'));db.useBackends(runner,files);
 const load=async lib=>import(path.join(tmp,lib+'.mjs'));
 return {tmp,pg,stats,db,load,cleanup:async()=>{await pg.close();await fs.rm(tmp,{recursive:true,force:true})}};
}
