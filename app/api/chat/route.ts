import {json,fail,dataVersion} from '@/lib/db';
import {requireUser} from '@/lib/auth';
import {load} from '@/lib/server-data';
import {runChat,routing} from '@/lib/ai-server';
import {answerChat,cleanConversation} from '@/lib/chat';
import {restrictInput} from '@/lib/analyst';
export const maxDuration=120;
/** Operations chat: free questions answered by the configured AI with read-only data tools, scoped to the user's units. */
export async function POST(req:Request){try{const user=await requireUser(req);const raw=await req.text();if(raw.length>60000)throw new Error('Conversa muito extensa. Comece uma nova conversa.');const b=JSON.parse(raw) as {messages?:unknown;channel?:unknown};
 const messages=cleanConversation(b.messages);const {input,previous,allStores}=await load(user);
 const channel=typeof b.channel==='string'&&(b.channel==='all'||allStores.some(s=>s.id===b.channel))?b.channel:'all';if(user.stores&&channel!=='all'&&!user.stores.includes(channel))throw new Error('Sem acesso a esta unidade.');
 const data=restrictInput(input,user.stores),configured=!!(await routing()).primary;
 const reply=await answerChat({messages,channel,data,ask:{...input,stores:allStores,question:'',allowedStores:user.stores,previous},storeName:allStores.find(s=>s.id===channel)?.name},configured?(m,t,run)=>runChat(m,t,run):undefined);
 return json({...reply,configured,dataVersion:await dataVersion()});
}catch(e){return fail(e)}}
