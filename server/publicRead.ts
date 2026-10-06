// Bounded reads of explicit public college URLs. Never follow redirects or send
// a student's question, name, credentials or conversation to the website.
let activeReads=0;
export async function readPublic(url: string, signal: AbortSignal, fetcher: typeof fetch = fetch, maxBytes = 1_000_000): Promise<{text:string;bytes:Uint8Array}> {
  const target=new URL(url);
  if(target.origin!=='https://commecscollege.edu.pk'||target.username||target.password||target.search||target.hash)throw Error('Invalid public source');
  if(signal.aborted||activeReads>=3)throw Error('Public lookup unavailable');
  activeReads++;
  try {
  const response=await fetcher(target,{signal,redirect:'error',headers:{Accept:'text/html,application/pdf','User-Agent':'CommecsAssistant/2.7'}});
  if(!response.ok||!response.body)throw Error('Public source unavailable');
  const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes)throw Error('Public source too large');chunks.push(part.value);}}
  finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return {text:new TextDecoder().decode(bytes),bytes};
  } finally {activeReads--;}
}
