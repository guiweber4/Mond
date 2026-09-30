import {database,bucket,json,fail,readRecords} from '@/lib/db';
import {requireUser} from '@/lib/auth';
import {validateNormalized,type Kind} from '@/lib/imports';
import {defaultStores} from '@/lib/model';
import {totalScope} from '@/lib/totals';
import {consolidatedReport} from '@/lib/consolidated-report';
import {latestPeriod} from '@/lib/findings';
import {today} from '@/lib/model';
import {reportSnapshot} from '@/lib/report';
export const maxDuration=60;
const MAX_FILE=8000000,KEY=/^imports\/([0-9a-f-]{36})\/original$/;
/**
 * Rows arrive as validated JSON; the original file either arrives inline (small files, tests)
 * or was uploaded beforehand to Storage with /api/import/upload (Vercel limits request bodies to 4.5 MB).
 */
export async function POST(req:Request){let id='';try{const user=await requireUser(req);if(Number(req.headers.get('content-length')||0)>4400000)throw new Error('Envio muito grande. Divida a planilha em arquivos menores.');
const input=await req.json() as any;const kind:Kind=input.kind,rows:any[]=input.rows;
if(!['sales','stock','products','goals','purchases','controls','totals'].includes(kind))throw new Error('Tipo de importação inválido.');
if(typeof input.fileName!=='string'||!input.fileName.trim())throw new Error('Selecione um arquivo.');
if(!Array.isArray(rows)||rows.length===0||rows.length>8000)throw new Error('Use entre 1 e 8.000 linhas por arquivo.');
let bytes:Uint8Array|null=null,fileKey='';
if(typeof input.fileBase64==='string'){if(input.fileBase64.length>4000000)throw new Error('Arquivo grande demais para envio direto. Atualize a página e tente novamente.');bytes=Uint8Array.from(atob(input.fileBase64),c=>c.charCodeAt(0));id=crypto.randomUUID();fileKey=`imports/${id}/original`}
else{const m=typeof input.fileKey==='string'&&input.fileKey.match(KEY);if(!m)throw new Error('Arquivo original não encontrado. Envie o arquivo novamente.');fileKey=input.fileKey;id=m[1];const size=await bucket().size(fileKey);if(size===null)throw new Error('Arquivo original não encontrado. Envie o arquivo novamente.');if(size>MAX_FILE)throw new Error('Selecione um arquivo de até 8 MB.')}
if(bytes&&bytes.byteLength>MAX_FILE)throw new Error('Selecione um arquivo de até 8 MB.');
const db=database();if(await db.prepare('SELECT id FROM imports WHERE id=?').bind(id).first()){id='';throw new Error('Este envio já foi registrado. Atualize o painel.')}
const cfg=await db.prepare("SELECT payload FROM settings WHERE id='stores'").first<{payload:string}>(),stores=cfg?JSON.parse(cfg.payload):defaultStores;validateNormalized(rows,kind,stores);if(user.stores&&rows.some((r:any)=>typeof r?.store==='string'&&!user.stores!.includes(r.store)))throw new Error('Sem acesso para importar dados desta unidade.');
const body=JSON.stringify(rows);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(kind+body)))).map(n=>n.toString(16).padStart(2,'0')).join('');
// Duplicate = identical content already active for the same scope, not any historical hash.
const duplicate=await db.prepare(kind==='totals'?"SELECT i.id FROM imports i JOIN total_batches b ON b.import_id=i.id WHERE i.hash=? AND i.status='ready'":kind==='stock'?"SELECT i.id FROM imports i WHERE i.hash=? AND i.status='ready' AND NOT EXISTS (SELECT 1 FROM records r JOIN stock_batches b ON b.store=r.pos_store AND b.date=r.pos_date WHERE r.import_id=i.id AND r.kind='stock' AND b.import_id<>i.id)":"SELECT id FROM imports WHERE hash=? AND status='ready'").bind(hash).first();
if(duplicate){if(!bytes)await bucket().remove(fileKey).catch(()=>{});return json({ok:true,duplicate:true,count:0,kind,stockDate:kind==='stock'?rows.reduce((a,r)=>r.date>a?r.date:a,''):null})}
if(bytes)await bucket().put(fileKey,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer);
const statements=[db.prepare('INSERT INTO imports(id,name,kind,created_at,status,count,hash,file_key) VALUES(?,?,?,?,?,?,?,?)').bind(id,input.fileName.slice(0,180),kind,new Date().toISOString(),'processing',rows.length,hash,fileKey)];
// One statement per bounded JSON chunk instead of one query per row; json keeps each row's original text.
for(let i=0;i<rows.length;i+=500)statements.push(db.prepare("INSERT INTO records(kind,rid,import_id,payload) SELECT ?::text,COALESCE(v->>'id',v->>'sku'),?::text,v::text FROM json_array_elements(?::text::json) AS v").bind(kind,id,JSON.stringify(rows.slice(i,i+500))));
statements.push(db.prepare("UPDATE imports SET status='ready' WHERE id=?").bind(id));
if(kind==='totals')statements.push(db.prepare('INSERT INTO total_batches(scope,store,start,"end",import_id) VALUES(?,?,?,?,?) ON CONFLICT(scope) DO UPDATE SET import_id=excluded.import_id').bind(totalScope(rows[0]),rows[0].store,rows[0].start,rows[0].end,id));
if(kind==='stock'){const scopes=new Map(rows.map(r=>[JSON.stringify([r.store,r.date]),r]));for(const r of scopes.values())statements.push(db.prepare('INSERT INTO stock_batches(store,date,import_id) VALUES(?,?,?) ON CONFLICT(store,date) DO UPDATE SET import_id=excluded.import_id').bind(r.store,r.date,id));}
await db.batch(statements);
let reportWarning='';try{const data=await readRecords();const operation=await db.prepare("SELECT payload FROM settings WHERE id='operations'").first<{payload:string}>(),saved=await db.prepare('SELECT dataset,status,payload FROM actions').all();if(kind==='totals'||(kind==='stock'&&data.totals.length)){
 // One automatic consolidated report per period, refreshed by every sales or stock import instead of duplicated.
 const [start,end]=kind==='totals'?[rows[0].start,rows[0].end]:latestPeriod(data.totals).split('|');const report=consolidatedReport(data.totals,stores,start,end,'all',{stock:data.stock,today:today(),goals:data.goals,saved:saved.results as {dataset:string;status:string;payload:string}[]});
 await db.prepare('INSERT INTO reports(id,dataset,title,created_at,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,created_at=excluded.created_at,payload=excluded.payload').bind(`auto:totals:${start}:${end}`,'real',`Consolidado · ${report.period} · Automático`,new Date().toISOString(),JSON.stringify(report)).run();}
if(kind!=='totals'&&data.sales.length){const finish=data.sales.reduce((a:string,s:any)=>s.date.slice(0,10)>a?s.date.slice(0,10):a,'');for(const type of ['Diário','Semanal','Mensal']){const report=reportSnapshot(data,stores,finish,type,'real','all',operation?JSON.parse(operation.payload):undefined,saved.results);await db.prepare('INSERT INTO reports(id,dataset,title,created_at,payload) VALUES(?,?,?,?,?)').bind(id+':'+type,'real',`${type} · ${report.period} · Automático`,new Date().toISOString(),JSON.stringify(report)).run();}}}catch(e){console.error('Relatórios automáticos',e);reportWarning='Importação concluída. Gere o relatório manualmente na central.';}
return json({ok:true,count:rows.length,id,kind,stockDate:kind==='stock'?rows.reduce((a,r)=>r.date>a?r.date:a,''):null,period:kind==='totals'?{start:rows[0].start,end:rows[0].end}:null,reportWarning});}
// The batch is a single transaction: on failure nothing was written, so there is no partial snapshot to mark.
catch(e){return fail(e)}}
