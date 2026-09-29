for(const message of ['What programs do you offer?','Compare Commerce and Computer Science for a student interested in business and technology.']){
 const r=await fetch('http://localhost:3002/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history:[],preferences:{language:'auto',responseStyle:'concise'}}),signal:AbortSignal.timeout(65000)});
 const data=await r.text();console.log(JSON.stringify({question:message,fallback:data.includes('"fallback":true'),sources:data.includes('event: sources'),complete:data.includes('"finishReason":"STOP"'),lane:data.match(/"lane":"([^"]+)"/)?.[1]}));
}
