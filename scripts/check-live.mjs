// Exercise live answers through the HTTP endpoint, including conversation history.
const base = process.env.CHECK_BASE_URL || 'http://localhost:3000';
async function ask(message, history = []) {
  const started = Date.now();
  const response = await fetch(`${base}/api/chat`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history,preferences:{language:'auto',responseStyle:'concise'}}),signal:AbortSignal.timeout(65000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const raw=await response.text();
  const events=raw.split(/\r?\n\r?\n/).map(block=>{const event=block.match(/^event: (.+)$/m)?.[1];const data=block.match(/^data: (.+)$/m)?.[1];return data?{event,data:JSON.parse(data)}:null;}).filter(Boolean);
  const bad=events.some(e=>e.event==='meta'&&(e.data.fallback||e.data.cached||e.data.local||e.data.mode==='verified'));
  const text=events.filter(e=>e.event==='chunk').map(e=>e.data.text).join('');
  const sources=events.find(e=>e.event==='sources')?.data.sources || [];
  const done=events.find(e=>e.event==='done');
  if(bad || text.length<30 || sources.length===0 || done?.data.finishReason!=='STOP') throw new Error('Live answer was incomplete, unsourced, cached, or a fallback. See server diagnostics.');
  console.log(JSON.stringify({passed:true,elapsedMs:Date.now()-started,sources:sources.length,characters:text.length}));
  return text;
}
try {
  const message='Explain how late fee payments are handled, using the published rules.';
  const text=await ask(message,[{role:'user',text:'I need help understanding college payment policies.'},{role:'model',text:'Which payment policy would you like to understand?'}]);
  await ask('What does the published policy say about unpaid fees?', [{role:'user',text:message},{role:'model',text}]);
  await ask('Compare Commerce and Computer Science for a student interested in business and technology.');
  console.log('PASS: live policy lookup, conversation follow-up and comparison.');
}catch(error){console.error(`FAIL: ${error.message}`);process.exitCode=1;}


