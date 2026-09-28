import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync, readFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cleanHtml, decodeEntities } from './lib/cleanHtml.js';
import { classifyDocument } from './lib/classify.js';
import { WpClient } from './lib/wpClient.js';
import { config } from './ingest.config.js';
import type { WpItem } from './lib/types.js';
interface RecordEntry { id:number;slug:string;title:string;type:string;url:string;modifiedGmt:string;status:string;wordCount:number;contentHash?:string;timeSensitive?:boolean;linkOnly?:boolean;hadListingWidget?:boolean }
function atomicWrite(path: string, content: string) { writeFileSync(path+'.next',content); renameSync(path+'.next',path); }
async function main() {
  const args=process.argv.slice(2), dry=args.includes('--dry-run'), force=args.includes('--force');
  const only=args.find(a=>a.startsWith('--only='))?.slice(7);
  const client=new WpClient();
  // Finish every page of both endpoints before any local mutation.
  const pages=await client.getPages(), posts=await client.getPosts();
  const all: WpItem[]=[...pages.map(p=>({...p,type:'page' as const})),...posts.map(p=>({...p,type:'post' as const}))];
  const dir=resolve(process.cwd(),'knowledge');
  const prior:RecordEntry[]=existsSync(resolve(dir,'manifest.json'))?JSON.parse(readFileSync(resolve(dir,'manifest.json'),'utf8')):[];
  const records:RecordEntry[] = only ? prior.filter(p=>p.slug!==only) : [];
  const writes:{path:string;content:string}[]=[];
  for(const item of all.filter(p=>!only||p.slug===only)) {
    if (!/^[a-zA-Z0-9_%\-]+$/.test(item.slug)) throw new Error('Unsafe document slug.');
    const raw=item.content?.rendered || '', markdown=cleanHtml(raw), title=decodeEntities(item.title.rendered);
    const classification=classifyDocument(item.slug,markdown,raw);
    const excluded=config.rules.excludeSlugs.includes(item.slug) || config.rules.excludeTitles.some(r=>r.test(title));
    const hash=createHash('sha256').update(markdown).digest('hex');
    const record:RecordEntry={id:item.id,slug:item.slug,title,type:item.type,url:item.link,modifiedGmt:item.modified_gmt,...classification,status:excluded?'excluded':classification.status,wordCount:markdown.split(/\s+/).filter(Boolean).length,contentHash:hash,timeSensitive:/fee|admission|scholarship|deadline|policy|schedule/i.test(item.slug)};
    records.push(record);
    const old=prior.find(p=>p.id===item.id&&p.type===item.type);
    const path=resolve(dir,item.type==='post'?'posts':'pages',item.slug+'.md');
    if(record.status==='included' && (force||old?.contentHash!==hash||!existsSync(path))) writes.push({path,content:markdown});
  }
  if(only&&!all.some(p=>p.slug===only)) throw new Error('Requested slug was not found; no files changed.');
  console.log((dry?'Dry run: ':'')+records.length+' manifest entries; '+writes.length+' content files would change.');
  if(dry) return;
  mkdirSync(resolve(dir,'pages'),{recursive:true});mkdirSync(resolve(dir,'posts'),{recursive:true});
  for(const file of writes) atomicWrite(file.path,file.content);
  atomicWrite(resolve(dir,'manifest.json'),JSON.stringify(records,null,2));
  atomicWrite(resolve(dir,'report.md'),'# Knowledge ingestion\n\nGenerated: '+new Date().toISOString()+'\n\n- Pages fetched: '+pages.length+'\n- Posts fetched: '+posts.length+'\n- Content files written: '+writes.length+'\n- Included: '+records.filter(r=>r.status==='included').length+'\n\nRemote File Search is unchanged. Review removals and reindex separately.\n');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Ingestion failed');process.exitCode=1;});
