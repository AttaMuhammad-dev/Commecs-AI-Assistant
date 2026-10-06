import {afterEach,describe,expect,it,vi} from 'vitest';
import {getProgramAnswer} from '../../server/programs';
import {getFacultyAnswer,selectFaculty,parseRenderedFaculty,refreshPublicFaculty,resetPublicFacultyForTests} from '../../server/faculty';
import {checkTimetable,getTimetableAnswer,resetTimetableCacheForTests} from '../../server/timetable';
import {readPublic} from '../../server/publicRead';
import {app} from '../../server/app';
import {getFollowUps} from '../../src/lib/followUps';
import faculty from '../../server/data/faculty-directory.json';
import timetable from '../../server/data/timetable.json';
const prefs={language:'en',responseStyle:'concise'} as const;
// Current Elementor news templates have no main element.
const html=(content:string)=>new Response('<html><body><div>'+content+'</div></body></html>',{headers:{'Content-Type':'text/html'}});
afterEach(()=>{resetPublicFacultyForTests();resetTimetableCacheForTests();vi.useRealTimers();vi.unstubAllGlobals();});
describe('current programs and rendered faculty',()=>{
  it.each(['What programs do you offer?','List current courses','کون سے پروگرام دستیاب ہیں؟','College mein kon se programs hain?'])('lists four current groups: %s',question=>{
    const result=getProgramAnswer(question,prefs);expect(result).not.toBeNull();expect(result?.answer).toContain('Computer Science');expect(result?.answer).not.toMatch(/Humanities|BBA|MBA/);expect(result?.sources.map(s=>s.url)).not.toContain('https://commecscollege.edu.pk/about/');
  });
  it.each(['en','ur','roman'] as const)('explains a Humanities conflict in %s without offering admission',language=>{
    const result=getProgramAnswer('Is Humanities available?',{...prefs,language});expect(result?.answer).toContain(language==='ur'?'ہیومینٹیز':'Humanities');expect(result?.sources).toHaveLength(2);
  });
  it('leaves comparisons, eligibility and historical questions for evidence synthesis',()=>{
    for(const q of ['Compare Computer Science and Commerce','Which programs accept 62% marks?','Tell me about Humanities history in 2021'])expect(getProgramAnswer(q,prefs)).toBeNull();
  });
  it('matches the updated Computer Science and Maths rosters',()=>{
    const cs=getFacultyAnswer('Who are Computer Science teachers?',[],prefs)!;expect(cs.answer).toContain('Aisha Shakir');expect(cs.answer).toContain('Laiba Binte Musharraf');expect(cs.answer).not.toContain('Jawwad');
    const maths=getFacultyAnswer('List Maths teachers',[],prefs)!;expect(maths.answer).toContain('M. Hashim');expect(maths.answer).not.toContain('Sayem');expect(selectFaculty('List Maths teachers')?.records).toHaveLength(7);
  });
  it.each(['Who is Sir Jawwad?','Who is M. Sayem Hanif?'])('does not resurrect an absent appointment: %s',question=>{
    const result=getFacultyAnswer(question,[],prefs)!;expect(result.answer).toContain('not listed');expect(result.answer).not.toContain('| Lecturer');
  });
  it('rejects layout changes without replacing the roster',async()=>{
    expect(()=>parseRenderedFaculty('<h4>Wrong layout</h4>')).toThrow();
    expect(await refreshPublicFaculty(new AbortController().signal,vi.fn(async()=>html('<h4>Wrong layout</h4>')) as typeof fetch)).toBe(false);
    expect(selectFaculty('List Maths teachers')?.records).toHaveLength(7);
  });
  it('uses rendered cards, caches only successful reads and never requests stale page REST',async()=>{
    const cards=faculty.records.map(r=>`<div><div><div><p>${r.department}</p><h4>${r.name}</h4><p>${r.qualification}</p>${r.roles.map(role=>'<p>'+role+'</p>').join('')}</div></div></div>`).join('');
    const fetcher=vi.fn(async()=>html(cards)) as unknown as typeof fetch;
    expect(await refreshPublicFaculty(new AbortController().signal,fetcher)).toBe(true);
    expect(await refreshPublicFaculty(new AbortController().signal,fetcher)).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();expect(String(vi.mocked(fetcher).mock.calls[0][0])).toBe(faculty.source);
    expect(getFacultyAnswer('List computer teachers',[],prefs)?.sources[0].type).toBe('live');
  });
});
describe('public timetable and ambiguity handling',()=>{
  it('preserves 130 section/day rows, with a shorter Friday and no guessed teacher names',()=>{
    expect(timetable.rows).toHaveLength(130);
    expect(timetable.rows.reduce((n,r)=>n+r.periods.length,0)).toBe(1092);
    expect(timetable.rows.filter(r=>r.day==='Friday').every(r=>r.periods.length===6&&r.times.length===6)).toBe(true);
    expect(timetable.rows.filter(r=>r.day!=='Friday').every(r=>r.periods.length===9&&r.times.length===9)).toBe(true);
  });
  it('asks for a section instead of guessing a generic schedule',()=>{
    const result=getTimetableAnswer('Latest timetable',[],prefs)!;expect(result.answer).toContain('Which year, group and section');expect(result.answer).toContain(timetable.source);expect(result.answer).toContain('cannot confirm');
  });
  it('returns the correct Monday row including breaks, with teacher codes intact',()=>{
    const result=getTimetableAnswer('XI Computer Science section CRES Monday timetable',[],prefs)!;
    expect(result.answer).toContain('| 1 | 8:15-09:00 | RA(MATH) |');expect(result.answer).toContain('| 4 | 10:20-11:00 | BREAK |');expect(result.answer).toContain('LM(CS)');expect(result.answer).not.toContain('Jawwad');expect(result.answer).not.toContain('Tuesday —');
  });
  it('handles a short section/day follow-up and Friday six periods',()=>{
    const result=getTimetableAnswer('And Friday section CRES?',[{role:'user',text:'XI Computer Science timetable'}],prefs)!;
    expect(result.answer).toContain('Friday — XI CS');expect(result.answer).toContain('| 6 |');expect(result.answer).not.toContain('| 7 |');
  });
  it('shows all weekdays for a primary section when secondary labels vary',()=>{
    const result=getTimetableAnswer('XI CS section CR-V weekly timetable',[],prefs)!;
    expect(result.answer).toContain('Monday —');expect(result.answer).toContain('Friday —');expect(result.answer).not.toContain('Which year');
  });
  it.each(['Latest timetable section ZZZ','XI Computer Science CRES Saturday timetable','Timetable session 2027-2028'])('does not guess missing information: %s',question=>expect(getTimetableAnswer(question,[],prefs)?.answer).toContain('do not have an exact match'));
  it('resolves today in Karachi, not the server timezone',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-05T21:00:00Z'));
    expect(getTimetableAnswer('XI CS CRES today timetable',[],prefs)?.answer).toContain('Tuesday — XI CS');
  });
  it.each(['en','ur','roman'] as const)('localizes a clarifying timetable answer in %s',language=>{
    const result=getTimetableAnswer('Time table',[],{...prefs,language})!;expect(result.answer).toContain(language==='ur'?'سیکشن':language==='roman'?'Aapki class':'Which year');expect(getFollowUps('Time table',[],language).map(x=>x.label).join(' ')).not.toMatch(/Scholarships|Payment rules/);
  });
  it('does not confuse an academic planner or macro plan with a timetable',()=>{
    expect(getTimetableAnswer('Academic planner and macro plans',[],prefs)).toBeNull();
  });
  it('quarantines older periods when a new notice links a different PDF',async()=>{
    const next='https://commecscollege.edu.pk/news/new-time-table/',pdf='https://commecscollege.edu.pk/wp-content/uploads/2026/10/New-Timetable.pdf';
    const fetcher=vi.fn(async(input:URL|RequestInfo)=>String(input).endsWith('/news-and-update/')?html(`<a href="${next}">Time Table Updated</a>`):html(`<a href="${pdf}">PDF</a>`)) as unknown as typeof fetch;
    const status=await checkTimetable(new AbortController().signal,fetcher);expect(status.state).toBe('changed');
    const result=getTimetableAnswer('XI CS CRES Monday timetable',[],prefs,status)!;expect(result.answer).toContain(pdf);expect(result.answer).not.toContain('RA(MATH)');expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('detects changed bytes even when the PDF URL stays the same',async()=>{
    const fetcher=vi.fn(async(input:URL|RequestInfo)=>String(input).endsWith('/news-and-update/')?html(`<a href="${timetable.notice}">Time Table Updated</a>`):String(input)===timetable.notice?html(`<a href="${timetable.source}">PDF</a>`):new Response('different PDF')) as unknown as typeof fetch;
    expect((await checkTimetable(new AbortController().signal,fetcher)).state).toBe('changed');expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('marks failures unknown and never fetches external timetable links',async()=>{
    const fetcher=vi.fn(async()=>html('<a href="https://evil.example/news/time-table/">Time Table Updated</a>')) as unknown as typeof fetch;
    expect((await checkTimetable(new AbortController().signal,fetcher)).state).toBe('unavailable');expect(fetcher).toHaveBeenCalledOnce();
  });
  it('honors cancellation before any website read',async()=>{
    const ac=new AbortController();ac.abort();const fetcher=vi.fn();expect((await checkTimetable(ac.signal,fetcher)).state).toBe('unavailable');expect(await refreshPublicFaculty(ac.signal,fetcher)).toBe(false);expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds stalled public lookups at eight seconds',async()=>{
    vi.useFakeTimers();
    const fetcher=vi.fn((_url,opts)=>new Promise<Response>((_,reject)=>opts?.signal?.addEventListener('abort',()=>reject(Error('Stopped')),{once:true}))) as unknown as typeof fetch;
    const task=checkTimetable(new AbortController().signal,fetcher);await vi.advanceTimersByTimeAsync(8000);expect((await task).state).toBe('unavailable');
    const roster=refreshPublicFaculty(new AbortController().signal,fetcher);await vi.advanceTimersByTimeAsync(8000);expect(await roster).toBe(false);
  });
  it('ignores a private results PDF even on a timetable notice',async()=>{
    const fetcher=vi.fn(async(input:URL|RequestInfo)=>String(input).endsWith('/news-and-update/')?html(`<a href="${timetable.notice}">Time Table Updated</a>`):html('<a href="https://commecscollege.edu.pk/wp-content/uploads/2026/10/Admission-Results.pdf">PDF Link</a>')) as unknown as typeof fetch;
    expect((await checkTimetable(new AbortController().signal,fetcher)).state).toBe('unavailable');expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
describe('bounded public reads and provider-independent routes',()=>{
  it.each(['https://evil.example/faculty/','https://user:secret@commecscollege.edu.pk/faculty/','https://commecscollege.edu.pk/faculty/?student=Ali'])('rejects unsafe public targets %s',async url=>{
    const fetcher=vi.fn();await expect(readPublic(url,new AbortController().signal,fetcher)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds response bytes',async()=>await expect(readPublic(faculty.source,new AbortController().signal,async()=>html('a'.repeat(101)),100)).rejects.toThrow('too large'));
  it('bounds simultaneous faculty/timetable reads and releases capacity on completion',async()=>{
    const resolves:((r:Response)=>void)[]=[];
    const fetcher=vi.fn(()=>new Promise<Response>(resolve=>resolves.push(resolve))) as unknown as typeof fetch;
    const requests=Array.from({length:3},()=>readPublic(faculty.source,new AbortController().signal,fetcher));
    await expect(readPublic(faculty.source,new AbortController().signal,fetcher)).rejects.toThrow('unavailable');
    resolves.forEach(resolve=>resolve(html('Completed')));await Promise.all(requests);
    expect((await readPublic(faculty.source,new AbortController().signal,async()=>html('New request'))).text).toContain('New request');
  });
  it.each(['Which programs are currently available?','List Computer Science teachers','List Mathematics faculty','Show latest timetable','Who is Sir Jawwad?'])('finishes with sources and no provider key: %s',async message=>{
    const response=await app.request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,preferences:prefs})});const text=await response.text();expect(response.status).toBe(200);expect(text).toContain('"local":true');expect(text).toContain('event: sources');expect(text).toContain('"finishReason":"STOP"');expect(text).not.toContain('"fallback":true');
  });
});
