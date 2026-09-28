import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { generateChatStream } from '../server/gemini.js';
import { normalizeForBank } from '../server/bank.js';
import type { Source } from '../shared/chat.js';
interface Draft {id:string;match:string[];answer:string;sources:Source[];language:string;verified:boolean;verifiedAt:number;verifiedBy:string;notes:string}
async function main() {
  const seeds:string[]=JSON.parse(readFileSync('server/data/verified-answers.seed.json','utf8'));
  const path='server/data/verified-answers.draft.json';
  const drafts:Draft[]=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
  const verified:Draft[]=JSON.parse(readFileSync('server/data/verified-answers.json','utf8'));
  const max=Number(process.argv.find(a=>a.startsWith('--max='))?.slice(6)||3);
  if(!Number.isInteger(max)||max<1||max>20) throw new Error('Use --max=1..20.');
  const existing=new Set([...drafts,...verified].flatMap(d=>d.match.map(normalizeForBank)));
  const questions=seeds.filter(q=>!existing.has(normalizeForBank(q))).slice(0,max);
  for(const q of questions) {
    const result=await generateChatStream(q,[],AbortSignal.timeout(55000),'fast',()=>{},()=>{});
    if(result.finishReason!=='STOP'||!result.sources.length) throw new Error('Incomplete or ungrounded draft; stopping without marking it verified.');
    drafts.push({id:'draft-'+Date.now(),match:[q],answer:result.text,sources:result.sources,language:'en',verified:false,verifiedAt:0,verifiedBy:'',notes:'Review all facts against the linked sources before publishing.'});
    writeFileSync(path,JSON.stringify(drafts,null,2));
    console.log('Saved draft; provider attempts: '+result.attempts);
    if(q!==questions.at(-1)) await new Promise(resolve=>setTimeout(resolve,11000));
  }
  console.log(questions.length+' new drafts. Existing drafts were preserved.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Drafting failed');process.exitCode=1;});
