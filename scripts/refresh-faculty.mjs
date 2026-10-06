import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { parseFaculty } from './lib/faculty.mjs';
// The rendered directory is populated from faculty posts. The page REST content
// can retain older Elementor cards even after appointments change.
const source='https://commecscollege.edu.pk/faculty/';
const response=await fetch(source,{signal:AbortSignal.timeout(8000),redirect:'error',headers:{Accept:'text/html'}});
if(!response.ok)throw Error(`Faculty refresh failed: HTTP ${response.status}. Existing directory preserved.`);
if(!response.headers.get('content-type')?.includes('text/html'))throw Error('Unexpected faculty source.');
const reader=response.body.getReader();let html='',size=0;const decoder=new TextDecoder();
try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>1000000)throw Error('Faculty source too large');html+=decoder.decode(item.value,{stream:true});}html+=decoder.decode();}finally{await reader.cancel();}
const records=parseFaculty(html);
const output={source,sourceModified:'',retrievedAt:new Date().toISOString(),contentHash:createHash('sha256').update(JSON.stringify(records)).digest('hex'),records};
const target='server/data/faculty-directory.json';
fs.writeFileSync(target+'.tmp',JSON.stringify(output,null,2)+'\n');fs.renameSync(target+'.tmp',target);
console.log(`Refreshed ${records.length} faculty appointments across ${new Set(records.map(r=>r.department)).size} directory categories. Rebuild and restart to activate.`);
