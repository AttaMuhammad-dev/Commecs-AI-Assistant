import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planQuery } from '../../server/queryPlan';
import { knowledgeEvidence, missingListEvidence, retrieveEvidence, type Evidence } from '../../server/knowledge';
import * as knowledgeModule from '../../server/knowledge';
import { generateChatStream } from '../../server/gemini';
import { routeQuestion } from '../../server/router';
import { isPublicCollegePage, retrieveOfficialWebsite, resetWebsiteCacheForTests, websiteText } from '../../server/officialWebsite';
import { resetQuotaForTests } from '../../server/quota';
import { getCachedResponse, setCachedResponse, clearCache } from '../../server/cache';
import { normalizeAnswerReferences } from '../../server/responseEvidence';
const clubs = 'tell me about the society and clubs which are available at commecs and how they are beneficial for students';
const feeHistory = [{ role: 'user', text: 'Explain late payment and readmission fees' }, { role: 'model', text: 'The fee policy describes penalties.' }];
const faq = 'https://commecscollege.edu.pk/faqs/';
beforeEach(() => { resetQuotaForTests(); resetWebsiteCacheForTests(); clearCache(); vi.stubEnv('FAKE_UPSTREAM_ERROR', ''); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('natural question retrieval and reasoning', () => {
  it.each([clubs, 'What extracurricular opportunities help me grow beyond studies?', 'I am shy. How can campus life help my confidence?', 'کالج کے کلب اور سوسائٹیز کے کیا فائدے ہیں؟', 'commecs ke clubs aur societies ka kya faida hai'])('retrieves developmental activities for %s', question => {
    const evidence = retrieveEvidence(question, feeHistory);
    expect(evidence.some(e => e.source.url === faq && /clubs and societies/.test(e.text))).toBe(true);
    expect(evidence.some(e => e.source.url.includes('fee-payment-policy'))).toBe(false);
    expect(evidence.some(e => e.source.url.includes('conflict-of-interest-policy'))).toBe(false);
  });
  it('routes the screenshot question to a real reasoning request', () => expect(routeQuestion(clubs, feeHistory)).toEqual({ lane: 'deep', reason: 'explanation-or-guidance' }));
  it('keeps follow-up context but drops it for a new explicit topic', () => {
    expect(planQuery('How can these help me?', [{ role: 'user', text: clubs }]).topics.map(t => t.id)).toContain('activities');
    expect(planQuery(clubs, feeHistory).topics.map(t => t.id)).not.toContain('fees');
  });
  it('covers two different subjects instead of returning only the strongest one', () => {
    const text = retrieveEvidence('Tell me about sports and how college fees are paid').map(e => e.text).join(' ');
    expect(text).toContain('Table Tennis'); expect(text).toMatch(/1,000|1,?000/);
  });
  it('does not equate a related source with coverage of a specific unknown facility', () => {
    expect(knowledgeEvidence('Is a robotics club available?', []).needsSearch).toBe(true);
    expect(knowledgeEvidence(clubs, feeHistory).needsSearch).toBe(false);
  });
  it('does not spend a remote retrieval call merely for generic guidance words', () => {
    expect(knowledgeEvidence('I am shy. How can activities at college help me develop confidence beyond classroom studies?', []).needsSearch).toBe(false);
  });
  it.each([clubs, 'Which clubs can I join?', 'commecs mein kaun se clubs available hain?', 'کالج میں کون سے کلب دستیاب ہیں؟'])('includes the actual named prospectus list for %s', question => {
    const evidence = retrieveEvidence(question, feeHistory);
    const brochure = evidence.find(e => e.source.type === 'pdf');
    expect(brochure?.text).toContain('IT Club');
    expect(brochure?.text).toContain('Commecs Choir Club');
    expect(brochure?.text).toContain('Horticulture');
    expect(brochure?.text).toContain('Photography & Videography');
    expect(brochure?.text).not.toContain('readmission fee');
    expect(brochure?.reviewedAt).toBeUndefined();
    expect(brochure?.source.modified).toBeUndefined();
    expect(brochure?.document?.publicationYear).toBe(2026);
    expect(brochure?.document?.note).toContain('not confirmation');
  });
  it('does not mistake a general statement for a requested named list', () => {
    const plan = planQuery(clubs);
    expect(missingListEvidence(plan, [{ text: 'There are clubs and societies. Students may choose one.' }])).toContain('activities');
    expect(missingListEvidence(plan, retrieveEvidence(clubs))).toEqual([]);
    expect(missingListEvidence(planQuery('How can societies help my confidence?'), [{ text: 'Clubs develop confidence.' }])).toEqual([]);
  });
  it.each(['What is Gazebo?', 'Tell me about the Commecs Gazebo blog'])('finds a named item inside a document without an exact bank/topic match: %s', question => {
    const evidence = retrieveEvidence(question);
    expect(evidence.some(e => e.source.type === 'pdf' && e.text.includes('Gazebo') && e.text.includes('literary ambitions'))).toBe(true);
  });
  it('removes unmapped provider placeholders while preserving actual public links', () => {
    expect(normalizeAnswerReferences('Hours are 8 AM [INDEX]. See [FAQs](' + faq + ') and [1] or [1, 2].')).toBe('Hours are 8 AM. See [FAQs](' + faq + ') and  or.');
  });
  it('keeps negation in the question supplied to the model even though search ignores it', () => expect(planQuery('Does Commecs not offer robotics clubs?').contextual).toContain('not offer'));
  it('passes relevant passages and helpful guidance rules to the model without a bank match', async () => {
    let system = '', thinking: unknown;
    await generateChatStream(clubs, feeHistory, new AbortController().signal, 'deep', () => undefined, () => undefined, undefined, async params => {
      system = String(params.config?.systemInstruction); thinking = params.config?.thinkingConfig?.thinkingLevel;
      return (async function* () { yield { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'The FAQs confirm clubs, societies and competitions. General guidance: these can develop communication and confidence.' }] } }] }; })();
    }, { buffered: true, requireSources: true });
    expect(system).toContain('clubs and societies'); expect(system).toContain('Missing one detail does not invalidate'); expect(thinking).toBe('LOW');
  });
  it('enables File Search for partial evidence instead of suppressing it because any source exists', async () => {
    vi.stubEnv('FILE_SEARCH_STORE_NAME', 'fileSearchStores/example'); let tools: unknown;
    await generateChatStream('Is a robotics club available?', [], new AbortController().signal, 'fast', () => undefined, () => undefined, undefined, async params => {
      tools = params.config?.tools;
      return (async function* () { yield { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Clubs exist; the exact robotics club is not specified.' }] } }] }; })();
    }, { buffered: true, requireSources: true });
    expect(tools).toEqual([{ fileSearch: { fileSearchStoreNames: ['fileSearchStores/example'] } }]);
  });
  it('keeps File Search enabled when a fresh page still supplies no requested names', async () => {
    vi.stubEnv('FILE_SEARCH_STORE_NAME', 'fileSearchStores/example');
    const current = knowledgeEvidence(clubs, []);
    const source = { title: 'FAQs', url: faq, type: 'page' };
    const general: Evidence = { source, sources: [source], text: 'Clubs and societies provide activities for personal development.', partial: true, kind: 'page', reviewedAt: undefined };
    const spy = vi.spyOn(knowledgeModule, 'knowledgeEvidence').mockReturnValue({ ...current, evidence: [general], sources: [source], prompt: general.text, needsSearch: true, missingLists: ['activities'] });
    let tools: unknown, instruction = '';
    try {
      await generateChatStream(clubs, [], new AbortController().signal, 'deep', () => undefined, () => undefined, undefined, async params => {
        tools = params.config?.tools; instruction = String(params.config?.systemInstruction);
        return (async function* () { yield { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Clubs exist, but this page does not provide their names.' }] } }] }; })();
      }, { buffered: true, requireSources: true, websiteProvider: async () => [general] });
      expect(tools).toEqual([{ fileSearch: { fileSearchStoreNames: ['fileSearchStores/example'] } }]);
      expect(instruction).toContain('REQUESTED LIST DETAILS MISSING');
    } finally { spy.mockRestore(); }
  });
});
const pageResponse = (text: string) => new Response(JSON.stringify([{ link: faq, title: { rendered: 'FAQs' }, content: { rendered: text }, modified_gmt: '2026-10-01T12:00:00' }]), { headers: { 'Content-Type': 'application/json' } });
describe('bounded official website lookup', () => {
  it.each(['https://evil.example/faqs/', 'https://commecscollege.edu.pk/admission-result/', 'https://commecscollege.edu.pk/interview-result-important-instructions/', 'http://commecscollege.edu.pk/faqs/', 'https://user:pass@commecscollege.edu.pk/faqs/'])('does not fetch unapproved or private paths: %s', url => expect(isPublicCollegePage(url)).toBe(false));
  it('cleans scripts/forms while retaining meaningful public text', () => {
    expect(websiteText('<script>secret()</script><form>private field</form><p>Students may join clubs.</p>')).toBe('Students may join clubs.');
  });
  it('refreshes approved pages, records actual retrieval and ranks each cached page for its current question', async () => {
    const fetcher = vi.fn(async () => pageResponse('<h2>Clubs</h2><p>Clubs and societies develop confidence.</p><h2>Library</h2><p>Library hours 8 AM to 2:45 PM.</p>' + '<h2>Unrelated</h2><p>Other content.</p>'.repeat(100))) as unknown as typeof fetch;
    const first = await retrieveOfficialWebsite(planQuery('Latest clubs'), [{ url: faq }], new AbortController().signal, fetcher);
    expect(first[0].source.type).toBe('live'); expect(first[0].retrievedAt).toBeTruthy(); expect(first[0].text).toContain('confidence');
    const second = await retrieveOfficialWebsite(planQuery('Library hours'), [{ url: faq }], new AbortController().signal, fetcher);
    expect(second[0].text).toContain('2:45 PM'); expect(second[0].text).not.toContain('confidence'); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('routes missing concepts to approved pages without sending a user question or name', async () => {
    const urls: string[] = [];
    const fetcher = vi.fn(async input => { const url = String(input); urls.push(url); return url.includes('/search?') ? new Response(JSON.stringify([{ url: 'https://evil.example/secret' }, { url: faq }]), { headers: { 'Content-Type': 'application/json' } }) : pageResponse('<p>The library has books for students.</p>'); }) as unknown as typeof fetch;
    await retrieveOfficialWebsite(planQuery('Ahmed wants current library books'), [], new AbortController().signal, fetcher);
    expect(urls).toHaveLength(1); expect(urls[0]).toContain('slug=faqs'); expect(urls.join(' ')).not.toContain('Ahmed'); expect(urls.every(url => url.startsWith('https://commecscollege.edu.pk/wp-json/'))).toBe(true);
  });
  it('fails safely on oversized or invalid website responses', async () => {
    const result = await retrieveOfficialWebsite(planQuery('Latest clubs'), [{ url: faq }], new AbortController().signal, (async () => new Response('x'.repeat(600_001), { headers: { 'Content-Type': 'application/json' } })) as typeof fetch);
    expect(result).toEqual([]);
  });
  it('stops a hanging lookup after eight seconds and honors cancellation', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url, opts) => new Promise<Response>((_resolve, reject) => opts?.signal?.addEventListener('abort', () => reject(new Error('stopped')), { once: true }))) as unknown as typeof fetch;
    const task = retrieveOfficialWebsite(planQuery('Latest clubs'), [{ url: faq }], new AbortController().signal, fetcher);
    await vi.advanceTimersByTimeAsync(8000); expect(await task).toEqual([]);
    const ac = new AbortController(); const canceled = retrieveOfficialWebsite(planQuery('Latest clubs'), [{ url: faq }], ac.signal, fetcher); ac.abort(); expect(await canceled).toEqual([]);
  });
  it('reads the approved public page when its REST endpoint is restricted', async () => {
    const urls: string[] = [];
    const fetcher = vi.fn(async input => { urls.push(String(input)); return String(input).includes('/wp-json/') ? new Response('Forbidden', { status: 403 }) : new Response('<header>Unrelated navigation</header><main><p>Library hours are 8 AM to 2:45 PM.</p></main>', { headers: { 'Content-Type': 'text/html' } }); }) as unknown as typeof fetch;
    const evidence = await retrieveOfficialWebsite(planQuery('Current library hours'), [{ url: faq }], new AbortController().signal, fetcher);
    expect(urls).toHaveLength(2); expect(urls[1]).toBe(faq); expect(evidence[0].source.type).toBe('live'); expect(evidence[0].source.modified).toBeUndefined(); expect(evidence[0].text).toContain('2:45 PM'); expect(evidence[0].text).not.toContain('Unrelated navigation');
  });
  it('emits the website phase before requesting the model and preserves refreshed fallback evidence', async () => {
    const events: string[] = []; let fallback: Evidence[] = [];
    const source = { title: 'FAQs', url: faq, type: 'live' };
    await generateChatStream('Latest clubs and societies', [], new AbortController().signal, 'deep', () => { events.push('answer'); }, () => undefined, undefined, async params => {
      expect(String(params.config?.systemInstruction)).toContain('OFFICIAL WEBSITE EVIDENCE'); events.push('provider');
      return (async function* () { yield { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'The public FAQs describe clubs and societies.' }] } }] }; })();
    }, { buffered: true, requireSources: true, onProgress: p => { events.push(p.phase); }, onEvidence: e => { fallback = e; }, websiteProvider: async () => [{ source, sources: [source], text: 'Clubs and societies are available.', partial: true, kind: 'page', reviewedAt: undefined, retrievedAt: new Date().toISOString() }] });
    expect(events).toEqual(['retrieving', 'website', 'preparing', 'provider', 'checking', 'answer']); expect(fallback[0].source.type).toBe('live');
  });
  it('continues with bundled evidence when the website is unavailable', async () => {
    await expect(generateChatStream('Latest clubs', [], new AbortController().signal, 'fast', () => undefined, () => undefined, undefined, async () => (async function* () { yield { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Saved FAQs confirm clubs.' }] } }] }; })(), { buffered: true, requireSources: true, websiteProvider: async () => { throw new Error('Website unavailable'); } })).resolves.toMatchObject({ finishReason: 'STOP' });
  });
  it('expires answers from website lookups after five minutes', () => {
    vi.useFakeTimers(); setCachedResponse('Latest clubs', [], 'Clubs', [{ title: 'FAQs', url: faq, type: 'live' }]);
    expect(getCachedResponse('Latest clubs', [])).toBeTruthy(); vi.advanceTimersByTime(300_001); expect(getCachedResponse('Latest clubs', [])).toBeNull();
  });
});
