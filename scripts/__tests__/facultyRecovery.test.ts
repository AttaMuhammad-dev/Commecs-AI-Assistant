import {afterEach,expect,it,vi} from 'vitest';
import {refreshPublicFaculty,resetPublicFacultyForTests,getFacultyAnswer} from '../../server/faculty';
import {retrieveEvidence,knowledgeEvidence} from '../../server/knowledge';
import {getVerifiedAnswer} from '../../server/bank';
afterEach(()=>{resetPublicFacultyForTests();vi.useRealTimers();});
it('keeps dated policy evidence after review expiry without presenting it as an instant verified answer',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-12-20T12:00:00Z'));
  expect(getVerifiedAnswer('Programs offered',0)).toBeNull();
  const result=retrieveEvidence('Computer science tuition charges and admission cost');
  expect(result.flatMap(e=>e.sources).some(s=>s.url.includes('Approved-Fee-Structure'))).toBe(true);
  expect(knowledgeEvidence('Late fee fine',[]).prompt).toContain('never as proof of current fees');
});
it('backs off a blocked official source, preserves dated answers and retries after cooldown',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  const fetcher=vi.fn(async()=>new Response('Forbidden',{status:403}));
  expect(await refreshPublicFaculty(new AbortController().signal,fetcher as typeof fetch)).toBe(false);
  expect(await refreshPublicFaculty(new AbortController().signal,fetcher as typeof fetch)).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(getFacultyAnswer('List Physics teachers',[],{language:'en',responseStyle:'concise'})?.answer).toContain('saved directory');
  vi.advanceTimersByTime(60001);
  await refreshPublicFaculty(new AbortController().signal,fetcher as typeof fetch);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not start duplicate refreshes while a lookup is in progress',async()=>{
  let finish!:(r:Response)=>void;
  const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));
  const first=refreshPublicFaculty(new AbortController().signal,fetcher as typeof fetch);
  expect(await refreshPublicFaculty(new AbortController().signal,fetcher as typeof fetch)).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);finish(new Response('Forbidden',{status:403}));expect(await first).toBe(false);
});
