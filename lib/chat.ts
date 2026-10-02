/**
 * Operations chat: validates the conversation, runs the model with read-only data tools over the user's data and
 * checks the numbers it wrote against what the tools returned. Without AI (not configured or failing) it falls back
 * to the computed answer of lib/analyst.ts, so a question always gets data-based content.
 */
import {TOOLS,toolContext,runTool,type DataInput} from './data-tools';
import {answerQuestion,verifyNumbers,type AskInput,type Answer} from './analyst';
import type {ChatMessage,ChatCall} from './ai-core';
export type ChatReply={mode:'ia';text:string;calls:{name:string;summary:string;args:Record<string,unknown>}[];unverified:string[];provider:string;model:string;usedFallback:boolean}|{mode:'calculado';answer:Answer;aiError?:string};
export type ChatRunner=(messages:ChatMessage[],tools:typeof TOOLS,run:(name:string,args:Record<string,unknown>)=>{result:unknown;summary:string})=>Promise<{text:string;calls:ChatCall[];provider:string;model:string;usedFallback:boolean}>;
/** Last 12 turns, user text up to 500 chars, assistant up to 4000; the last message must be the user's question. */
export function cleanConversation(raw:unknown):ChatMessage[]{
 if(!Array.isArray(raw))throw new Error('Conversa inválida.');
 const msgs=raw.slice(-12).map(m=>{const x=m as {role?:unknown;content?:unknown};if((x.role!=='user'&&x.role!=='assistant')||typeof x.content!=='string'||!x.content.trim())throw new Error('Conversa inválida.');const max=x.role==='user'?500:4000;if(x.content.length>max&&x.role==='user')throw new Error('Escreva uma pergunta de até 500 caracteres.');return {role:x.role,content:x.content.slice(0,max)} as ChatMessage});
 while(msgs.length&&msgs[0].role!=='user')msgs.shift();
 if(!msgs.length||msgs.at(-1)!.role!=='user')throw new Error('Envie uma pergunta.');return msgs;
}
export async function answerChat(o:{messages:ChatMessage[];channel:string;data:DataInput;ask:AskInput;storeName?:string},runner?:ChatRunner):Promise<ChatReply>{
 const question=o.messages.at(-1)!.content;
 const fallback=(aiError?:string):ChatReply=>({mode:'calculado',answer:answerQuestion({...o.ask,question,channel:o.channel}).answer,aiError});
 if(!runner)return fallback();
 const ctx=toolContext(o.data),outputs:string[]=[];
 const run=(name:string,args:Record<string,unknown>)=>{const r=runTool(ctx,name,args);outputs.push(JSON.stringify(r.result));return r};
 // The screen's unit filter is a default the model can override when the question names another unit.
 const msgs=o.channel!=='all'&&o.storeName?[{role:'user' as const,content:`(Contexto da tela: unidade selecionada ${o.storeName}; use como padrão quando a pergunta não citar outra.)`},{role:'assistant' as const,content:'Entendido.'},...o.messages]:o.messages;
 try{const r=await runner(msgs,TOOLS,run);
  const unverified=outputs.length?verifyNumbers(r.text,`[${outputs.join(',')}]`):verifyNumbers(r.text,'{}');
  return {mode:'ia',text:r.text,calls:r.calls.map(c=>({name:c.name,summary:c.summary,args:c.args})),unverified,provider:r.provider,model:r.model,usedFallback:r.usedFallback};
 }catch(e){return fallback(e instanceof Error?e.message:'IA indisponível.')}
}
