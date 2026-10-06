// Bounded reads of explicit public college URLs. Never follow redirects or send
// a student's question, name, credentials or conversation to the website.
let activeReads=0;
type ReadStatus={checkedAt:string;state:'ok'|'unavailable';reason?:'http'|'network'|'cancelled'|'size'|'capacity'|'redirect'|'certificate';httpStatus?:number};
const lastReads:Partial<Record<'faculty'|'news'|'notice'|'document',ReadStatus>>={};
export const publicSourceHealth=()=>({...lastReads});
export function resetPublicSourceHealthForTests(){for(const key of Object.keys(lastReads))delete lastReads[key as keyof typeof lastReads];}
const sourceKind=(path:string)=>path==='/faculty/'?'faculty':path==='/news-and-update/'?'news':path.startsWith('/news/')?'notice':path.startsWith('/wp-content/uploads/')?'document':undefined;
export async function readPublic(url: string, signal: AbortSignal, fetcher: typeof fetch = fetch, maxBytes = 1_000_000): Promise<{text:string;bytes:Uint8Array}> {
  const target=new URL(url);
  if(target.origin!=='https://commecscollege.edu.pk'||target.username||target.password||target.search||target.hash)throw Error('Invalid public source');
  const kind=sourceKind(target.pathname);
  let reason:ReadStatus['reason']='network',httpStatus:number|undefined;
  const record=(state:ReadStatus['state'])=>{if(kind)lastReads[kind]={checkedAt:new Date().toISOString(),state,...(state==='unavailable'?{reason,...(httpStatus?{httpStatus}:{})}:{})};};
  if(signal.aborted||activeReads>=3){reason=signal.aborted?'cancelled':'capacity';record('unavailable');throw Error('Public lookup unavailable');}
  activeReads++;
  try {
  const response=await fetcher(target,{signal,redirect:'error',headers:{Accept:'text/html,application/pdf','User-Agent':'CommecsAssistant/2.7'}});
  if(!response.ok||!response.body){reason='http';httpStatus=response.status;throw Error('Public source unavailable');}
  const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes){reason='size';throw Error('Public source too large');}chunks.push(part.value);}}
  finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  record('ok');return {text:new TextDecoder().decode(bytes),bytes};
  } catch(error){
    // Categorize only: never publish arbitrary exception messages, URLs or bodies.
    const cause=error instanceof Error?(error as Error&{cause?:{code?:string}}).cause?.code:undefined;
    if(signal.aborted)reason='cancelled';
    else if(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(cause||''))reason='certificate';
    else if(cause==='UND_ERR_REDIRECT')reason='redirect';
    record('unavailable');throw error;
  } finally {activeReads--;}
}
