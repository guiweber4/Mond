import {bucket,json,fail} from '@/lib/db';
import {requireUser} from '@/lib/auth';
/** Signed, single-use upload URL for the original spreadsheet (kept private in Supabase Storage). */
export async function POST(req:Request){try{await requireUser(req);const b=await req.json() as {size?:unknown};if(typeof b.size!=='number'||b.size<=0||b.size>8000000)throw new Error('Selecione um arquivo de até 8 MB.');const key=`imports/${crypto.randomUUID()}/original`;return json({key,url:await bucket().uploadUrl(key)})}catch(e){return fail(e)}}
