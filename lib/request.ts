/** Bound both network and response-body waits; always release the UI on failure. */
export async function requestJson(url:string,init:RequestInit={},timeout=30000){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await fetch(url,{...init,signal:controller.signal});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('O servidor não retornou uma confirmação válida. Atualize a página e tente novamente.');
 const result=await response.json() as any;if(!response.ok)throw new Error(result.error||'Não foi possível concluir. Tente novamente.');return result;
 }catch(error){if(controller.signal.aborted)throw new Error('O servidor demorou para confirmar. Atualize o painel para verificar se a importação foi concluída antes de reenviar.');throw error;}finally{clearTimeout(timer)}
}
