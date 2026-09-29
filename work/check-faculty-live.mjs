import 'dotenv/config';
import { generateChatStream } from '../dist-server/server/gemini.js';
let text='';
const result=await generateChatStream('Compare the published qualifications of Ammar Bin Ahsan and Hiba Kafeel. Use only the official faculty evidence.',[],AbortSignal.timeout(55000),'fast',part=>{text+=part;},()=>{});
const passed=result.finishReason==='STOP'&&text.includes('Ammar')&&text.includes('Hiba')&&result.sources.some(s=>s.url==='https://commecscollege.edu.pk/faculty/');
console.log(JSON.stringify({passed,finish:result.finishReason,sources:result.sources.length,text}));if(!passed)process.exitCode=1;
