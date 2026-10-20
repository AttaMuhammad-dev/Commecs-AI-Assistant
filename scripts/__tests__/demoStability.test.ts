import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {getLocalGuideAnswer} from '../../server/localGuide';
import {getProgramAnswer} from '../../server/programs';
import {generateChatStream} from '../../server/gemini';
import {resetQuotaForTests} from '../../server/quota';
const prefs = {language:'en' as const,responseStyle:'concise' as const};
beforeEach(()=>{resetQuotaForTests();vi.stubEnv('FAKE_UPSTREAM_ERROR','');});
afterEach(()=>vi.unstubAllEnvs());
it.each(['hi','Hello!','hey there','aoa','السلام علیکم'])('answers greeting %s without a provider',message=>{
  const answer=getLocalGuideAnswer(message,prefs);
  expect(answer?.answer).toMatch(/Welcome/);expect(answer?.sources).toEqual([]);
});
it('does not swallow a real question prefixed by hello',()=>expect(getLocalGuideAnswer('Hello, what are the fees?',prefs)).toBeNull());
it('does not replace the owner’s multi-part career question with a programs list',()=>{
  expect(getProgramAnswer('mujhe yeh batao agr mai mujhe konsi field mai jaana chaheye hai mujhe tech based work bht psnd hai or iske elawa skill development program ka kia scene hai college mai?',prefs)).toBeNull();
  expect(getProgramAnswer('Which programs are currently offered?',prefs)?.answer).toContain('Computer Science');
});
it('recovers from an inaccessible optional store with the same model and local evidence',async()=>{
  vi.stubEnv('FILE_SEARCH_STORE_NAME','fileSearchStores/old-project');
  const calls:any[]=[];const received:string[]=[];
  const result=await generateChatStream('Is a robotics club available?',[],new AbortController().signal,'fast',s=>{received.push(s);},()=>{},prefs,async params=>{
    calls.push(params);
    if(calls.length===1)throw {status:403,message:'Permission denied for File Search store'};
    return (async function*(){yield {candidates:[{finishReason:'STOP',content:{parts:[{text:'The FAQs mention clubs and societies. The exact robotics club is not confirmed.'}]}}]};})();
  },{buffered:true,requireSources:true});
  expect(calls).toHaveLength(2);expect(calls[0].config.tools).toBeDefined();expect(calls[1].config.tools).toBeUndefined();
  expect(calls[0].model).toBe(calls[1].model);expect(result.sources.length).toBeGreaterThan(0);expect(received).toHaveLength(1);
});
