import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const ui = vi.hoisted(() => ({ messages: [] as import('../../src/types/chat').ChatMessage[] }));
vi.mock('../../src/store/useChatStore', () => ({ useChatStore: (selector: (state: unknown) => unknown) => selector({ messages: ui.messages, preferences: { language: 'auto' }, progress: null, activeId: 'chat', setMessages: () => undefined, setDraft: () => undefined }) }));
vi.mock('../../src/hooks/useChat', () => ({ useChat: () => ({ retryMessage: () => undefined }) }));
import MessageBubble from '../../src/components/MessageBubble';
import MessageList from '../../src/components/MessageList';
import { selectAnswerSources } from '../../shared/answerSources';
import { planQuery } from '../../shared/queryPlan';
import { retrieveEvidence } from '../../server/knowledge';
import { generateChatStream } from '../../server/gemini';
import { resetQuotaForTests } from '../../server/quota';
import { getFollowUps } from '../../src/lib/followUps';
import { streamGeminiResponse } from '../../src/lib/geminiChatService';
import { app } from '../../server/app';
const phoneQuestion = 'can student bring smart phone at campus?';
const conduct = { title: 'Students Code of Conduct', url: 'https://commecscollege.edu.pk/students-code-of-conduct/', modified: '2023-01-10' };
const fee = { title: 'Approved Fee Structure', url: 'https://commecscollege.edu.pk/wp-content/uploads/2026/07/Approved-Fee-Structure-2026-27.pdf' };
const contact = { title: 'Contact Us', url: 'https://commecscollege.edu.pk/contact-us/' };
const discipline = { title: 'Discipline Policy', url: 'https://commecscollege.edu.pk/discipline-policy/' };
const phoneAnswer = `Bringing cell phones is prohibited. Students can use the college phone to contact parents. [Source: Code of Conduct](${conduct.url}).`;
const feeHistory = [{ role: 'user', text: 'Explain late fee payments' }, { role: 'model', text: 'There is a late fee penalty.' }];
beforeEach(() => { resetQuotaForTests(); vi.stubEnv('FAKE_UPSTREAM_ERROR', ''); });
afterEach(() => { ui.messages = []; vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('source relevance for device policies', () => {
  it.each([phoneQuestion, 'Are smartphones allowed at Commecs?', 'Can I carry my mobile to college?', 'kya students campus mein mobile la sakte hain?', 'کیا طلبہ کالج میں موبائل فون لا سکتے ہیں؟'])('retrieves the conduct rule without office or fee documents: %s', question => {
    const plan = planQuery(question, feeHistory);
    expect(plan.topics.map(t => t.id)).toContain('devices');
    expect(plan.topics.map(t => t.id)).not.toContain('contact');
    expect(plan.topics.map(t => t.id)).not.toContain('fees');
    const evidence = retrieveEvidence(question, feeHistory);
    expect(evidence.some(e => e.source.url === conduct.url && e.text.includes('Bringing cell phone'))).toBe(true);
    expect(evidence.flatMap(e => e.sources).some(s => /contact-us|Fee-Structure|instructions-for-admission/.test(s.url))).toBe(false);
  });
  it.each(['What is the college phone number?', 'Admissions contact number', 'کالج کا فون نمبر کیا ہے؟'])('preserves genuine contact intent: %s', question => {
    expect(planQuery(question).topics.map(t => t.id)).toContain('contact');
    expect(planQuery(question).topics.map(t => t.id)).not.toContain('devices');
    expect(retrieveEvidence(question).some(e => e.source.url === contact.url)).toBe(true);
  });
  it('keeps both subjects in a genuine phone-policy and fee question', () => {
    const topics = planQuery('Are phones allowed on campus and what is the fee structure?').topics.map(t => t.id);
    expect(topics).toEqual(expect.arrayContaining(['devices', 'fees']));
    expect(retrieveEvidence('Are phones allowed on campus and what is the fee structure?').some(e => e.sources.some(s => /Fee-Structure/.test(s.url)))).toBe(true);
  });
  it('narrows the old source dump to explicit references and preserves dates', () => {
    expect(selectAnswerSources(phoneAnswer, [contact, fee, conduct, conduct])).toEqual([conduct]);
    expect(selectAnswerSources(`[Rule](${conduct.url}#phones)`, [{ ...conduct, url: conduct.url.replace(/\/$/, '') }])).toHaveLength(1);
  });
  it('preserves every referenced source for a combined answer', () => {
    expect(selectAnswerSources(`[Rule](${conduct.url}) and [Fees](${fee.url})`, [contact, conduct, fee])).toEqual([conduct, fee]);
  });
  it('retains explicit provider attribution alongside an inline citation', () => {
    expect(selectAnswerSources(phoneAnswer, [conduct, { ...discipline, attributed: true }, fee])).toHaveLength(2);
    expect(selectAnswerSources('A supported response with no inline links.', [conduct])).toEqual([conduct]);
  });
  it('does not substitute unrelated metadata for an unrecognized reference', () => {
    expect(selectAnswerSources('[Fake](https://commecscollege.edu.pk/fake/)', [fee])).toEqual([]);
    expect(selectAnswerSources('Answer', [{ title: 'Unsafe', url: 'javascript:alert(1)' }])).toEqual([]);
  });
  it('corrects source cards in an already saved conversation', () => {
    const html = renderToStaticMarkup(<MessageBubble message={{ id: 'old-reply', role: 'bot', text: phoneAnswer, sources: [contact, fee, conduct], status: 'complete', createdAt: 1, cached: true }} />);
    expect(html).toContain('Students Code of Conduct'); expect(html).toContain('Saved source date');
    expect(html).not.toContain('Approved Fee Structure'); expect(html).not.toContain('Contact Us');
  });
  it('emits only cited and provider-attributed sources, before answer completion', async () => {
    const events: string[] = [];
    const result = await generateChatStream(phoneQuestion, [], new AbortController().signal, 'fast', () => { events.push('answer'); }, () => { events.push('sources'); }, undefined, async () => (async function* () {
      yield { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: phoneAnswer }] }, groundingMetadata: {
        groundingChunks: [{ retrievedContext: { uri: discipline.url, title: discipline.title } }, { retrievedContext: { uri: fee.url, title: fee.title } }],
        groundingSupports: [{ groundingChunkIndices: [0], segment: { text: 'Conduct rules apply.' } }],
      } }] };
    })(), { buffered: true, requireSources: true });
    expect(result.sources.map(s => s.url)).toEqual([conduct.url, discipline.url]);
    expect(result.sources[1].attributed).toBe(true); expect(events).toEqual(['sources', 'answer']);
  });
  it('carries only a valid attribution flag through SSE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('event: sources\ndata: ' + JSON.stringify({ sources: [{ ...conduct, attributed: true }, { ...fee, attributed: 'yes' }] }) + '\n\nevent: done\ndata: {"finishReason":"STOP"}\n\n')));
    const chunks = []; for await (const chunk of streamGeminiResponse(phoneQuestion, [])) chunks.push(chunk);
    expect(chunks[0].sources?.[0].attributed).toBe(true); expect(chunks[0].sources?.[1].attributed).toBeUndefined();
  });
  it('filters uncited reviewed metadata when selecting the saved-source fallback', async () => {
    vi.stubEnv('FAKE_UPSTREAM_ERROR', 'QUOTA_EXCEEDED');
    const response = await app.request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'What is the college phone number?', history: [], preferences: { language: 'en', responseStyle: 'detailed' } }) });
    const events = [...(await response.text()).matchAll(/event: (\w+)\ndata: ([^\n]+)/g)].map(m => ({ event: m[1], data: JSON.parse(m[2]) }));
    expect(events.some(e => e.event === 'meta' && e.data.fallback)).toBe(true);
    const sources = events.find(e => e.event === 'sources')!.data.sources;
    expect(sources.some((s: { url: string }) => s.url === contact.url)).toBe(true);
    expect(sources.some((s: { url: string }) => /Fee-Structure/.test(s.url))).toBe(false);
    expect(events.at(-1)?.data.finishReason).toBe('STOP');
  });
});
describe('follow-ups follow the question, not incidental source URLs', () => {
  it('replaces fees/scholarships with parent contact and campus rules for the screenshot', () => {
    expect(getFollowUps(phoneQuestion, [contact, fee, conduct]).map(s => s.label)).toEqual(['Contacting parents', 'Campus rules']);
  });
  it.each(['ur', 'roman'] as const)('localizes both the suggestions and drafted questions: %s', language => {
    const next = getFollowUps(phoneQuestion, [fee], language);
    expect(next).toHaveLength(2); expect(next[0].label).toBe(language === 'ur' ? 'والدین سے رابطہ' : 'Parents se rabta');
    expect(next[0].question).toMatch(language === 'ur' ? /فون/ : /phones/);
  });
  it.each([
    ['What clubs are available?', ['Joining a club', 'Club activities']],
    ['What sports can students play?', ['Sports facilities', 'Sports participation']],
    ['Can I use the library computers?', ['Library access', 'Computer facilities']],
    ['College transport?', ['Transport arrangements', 'Pickup information']],
    ['What are the uniform rules?', ['Attendance rules', 'Dress code']],
    ['What counselling support is there?', ['Student support', 'Career guidance']],
  ])('uses relevant suggestions despite an incidental fee source: %s', (question, labels) => expect(getFollowUps(question as string, [fee]).map(s => s.label)).toEqual(labels));
  it('retains context for a short follow-up and drops it for an explicit topic change', () => {
    expect(getFollowUps('What if I break that rule?', [conduct], 'en', [{ role: 'user', text: phoneQuestion }]).map(s => s.label)).toEqual(['Contacting parents', 'Campus rules']);
    expect(getFollowUps('What are college fees?', [conduct], 'en', [{ role: 'user', text: phoneQuestion }]).map(s => s.label)).toEqual(['Scholarships', 'Payment rules']);
  });
  it('suggests both subjects in a multi-topic question', () => expect(getFollowUps('Are phones allowed and what are the fees?').map(s => s.label)).toEqual(['Contacting parents', 'Scholarships']));
  it('does not fill unknown topics with unrelated recommendations', () => {
    expect(getFollowUps('Explain quantum mechanics', [fee])).toEqual([]);
    expect(getFollowUps('Tell me more', [conduct]).map(s => s.label)).toEqual(['Attendance rules', 'Dress code']);
    expect(getFollowUps('Tell me more', [fee, conduct])).toEqual([]);
  });
  it('does not repeat the exact currently asked question', () => expect(getFollowUps('How can students join clubs and societies at Commecs?').map(s => s.label)).toEqual(['Club activities']));
  it('shows relevant follow-ups for substantive saved evidence without suggesting after a service failure', () => {
    const question: import('../../src/types/chat').ChatMessage = { id: 'question', role: 'user', text: phoneQuestion, status: 'complete', createdAt: 1 };
    const answer: import('../../src/types/chat').ChatMessage = { id: 'answer', role: 'bot', text: phoneAnswer, sources: [conduct], fallback: true, status: 'complete', createdAt: 2 };
    ui.messages = [question, answer];
    const html = renderToStaticMarkup(<MessageList />);
    expect(html).toContain('Contacting parents'); expect(html).toContain('Campus rules');
    expect(html).not.toContain('Scholarships'); expect(html).not.toContain('Payment rules');
    ui.messages = [question, { ...answer, text: 'Service unavailable. Try again.', sources: [] }];
    expect(renderToStaticMarkup(<MessageList />)).not.toContain('Keep exploring');
  });
});
