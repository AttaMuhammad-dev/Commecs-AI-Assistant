import assert from 'node:assert/strict';
import {app} from '../dist-server/server/app.js';
import {resetQuotaForTests} from '../dist-server/server/quota.js';
import {getSavedEvidence} from '../dist-server/server/savedEvidence.js';
const prefs={language:'auto',responseStyle:'concise'};
// These flags apply only to this test process. No provider request is sent.
process.env.NODE_ENV='test';process.env.GEMINI_API_KEY='test-only';process.env.FILE_SEARCH_STORE_NAME='test-only';process.env.CACHE_ENABLED='false';
const warn=console.warn,info=console.info;console.warn=()=>{};console.info=()=>{};
const history=[{role:'user',text:'Tell me about Physics faculty'},{role:'model',text:'Here are the Physics faculty.'}];
async function ask(message,history=[]){const r=await app.request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history,preferences:prefs})});assert.equal(r.status,200);return r.text();}
try {
 const start=Date.now();
 for(let i=0;i<30;i++){
  process.env.FAKE_UPSTREAM_ERROR=i%2?'429-minute':'503';
  const result=await ask('also tell me about the urdu teachers',history);
  assert(result.includes('"local":true'));assert(!result.includes('"fallback":true'));assert(result.includes('Muhammad Muzaffar'));assert(result.includes('event: sources'));assert(result.includes('"finishReason":"STOP"'));
 }
 const elapsed=Date.now()-start;
 assert(elapsed<3000,'Faculty answers should not wait for an API');
 for(const failure of ['503','429-minute']){
  resetQuotaForTests();process.env.FAKE_UPSTREAM_ERROR=failure;
  const result=await ask('Explain penalties for late fee payment',[{role:'user',text:'Help with college policies'},{role:'model',text:'What would you like to know?'}]);
  assert(result.includes('saved official-source extracts'));assert(result.includes('Fee Payment Policy'));assert(result.includes('event: sources'));assert(result.includes('"fallback":true'));assert(!result.includes('Talk to admissions'));
 }
 const compare=await ask('Compare Ammar Bin Ahsan and Hiba Kafeel qualifications');assert(compare.includes('Ammar Bin Ahsan'));assert(compare.includes('Hiba Kafeel'));assert(compare.includes('saved official-source extracts'));
 assert.equal(getSavedEvidence('What is my admission result?',[],prefs),null);
 assert.equal(getSavedEvidence('Explain quantum gravity wormholes',[],prefs),null);
 if(process.argv.includes('--slow')) {
  resetQuotaForTests();delete process.env.FAKE_UPSTREAM_ERROR;const originalFetch=globalThis.fetch;
  globalThis.fetch=()=>new Promise(()=>{});const stalledAt=Date.now();
  try {const stalled=await ask('Explain the late fee payment penalties again', [{role:'user',text:'Payment policy'},{role:'model',text:'Which part?'}]);assert(stalled.includes('saved official-source extracts'));assert(Date.now()-stalledAt<18000);console.log('PASS: stalled provider returned saved evidence within 18 seconds.');}finally{globalThis.fetch=originalFetch;}
 }
 const health=await (await app.request('/api/health')).json();assert.equal(health.build,'public-source-runtime-20261006');
 console.log(`PASS: 30 repeated Urdu follow-ups in ${elapsed}ms; 503/429 source fallback; faculty comparison backup; unsupported/private requests; build identity.`);
} finally {console.warn=warn;console.info=info;}

