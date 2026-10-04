import { describe, expect, it } from 'vitest';
import { retrieveEvidence, selectEvidenceText, knowledgeEvidence, sourceWithDates } from '../../server/knowledge';
import { answerLinksSupported } from '../../server/responseEvidence';
import { resolveLanguage } from '../../shared/chat';
import { getSavedEvidence } from '../../server/savedEvidence';
import { SYSTEM_PROMPT } from '../../server/systemPrompt';
import { generateChatStream } from '../../server/gemini';
import { resetQuotaForTests } from '../../server/quota';
const url = 'https://commecscollege.edu.pk/fee-payment-policy/';
describe('answer quality and citation boundaries', () => {
  it.each([
    ['Explain penalties for late fee payment', '/fee-payment-policy/'],
    ['Computer science tuition charges and admission cost', 'Approved-Fee-Structure'],
    ['Minimum marks for Commerce admission', '/eligibility/'],
    ['College transport facilities', '/faqs/'],
  ])('finds the expected evidence for %s', (question, path) => {
    expect(knowledgeEvidence(question, []).sources.some(s => s.url.includes(path))).toBe(true);
  });
  it('preserves all citations attached to a reviewed answer, including the fee PDF', () => {
    const evidence = retrieveEvidence('Computer science tuition charges and admission cost');
    expect(evidence.flatMap(e => e.sources).some(s => s.url.endsWith('.pdf'))).toBe(true);
    expect(evidence.flatMap(e => e.sources).some(s => s.url.endsWith('/downloads/'))).toBe(true);
  });
  it('keeps the source update separate from the human review timestamp', () => {
    const source = sourceWithDates({ title: 'Fee policy', url }, Date.UTC(2026, 9, 4));
    expect(source.reviewedAt).toBe('2026-10-04T00:00:00.000Z');
    expect(source.modified).not.toBe(source.reviewedAt);
    expect(source.modified).toBeTruthy();
    const prompt = knowledgeEvidence('Explain penalties for late fee payment', []).prompt;
    expect(prompt).toContain('human review date is NOT');
    expect(SYSTEM_PROMPT).toContain('preserves all applicable exclusions');
  });
  it('keeps FAQ questions and answers together without packing unrelated sections', () => {
    const sections = Array.from({ length: 20 }, (_, i) => `${i + 1}. ${i === 5 ? 'Are transport facilities available?' : 'What about unrelated topic ' + i + '?'}\n\n${i === 5 ? 'College arranges a contractor for transport.' : 'Unrelated details '.repeat(15)}`).join('\n\n');
    const result = selectEvidenceText(sections, ['transport']);
    expect(result.text).toContain('Are transport facilities available?');
    expect(result.text).toContain('arranges a contractor');
    expect(result.text).not.toContain('unrelated'); expect(result.partial).toBe(true);
  });
  it('keeps a complete short eligibility source with its exclusions', () => {
    const result = retrieveEvidence('Eligibility requirements for science students');
    const original = result.find(e => e.kind === 'page' && e.source.url.endsWith('/eligibility/'));
    expect(original?.text.toLowerCase()).toContain('not eligible'); expect(original?.text).toContain('Computer Studies');
  });
  it('does not inherit a fee topic when the user explicitly changes to transport', () => {
    const evidence = retrieveEvidence('What about transport?', [{ role: 'user', text: 'Fee payment policy and readmission penalties' }]);
    expect(evidence.some(e => e.source.url.endsWith('/fee-payment-policy/'))).toBe(false);
  });
  it('rejects fabricated citations even when the host looks official', () => {
    const sources = [{ title: 'Fee policy', url }];
    expect(answerLinksSupported('[Policy](' + url + ')', sources, '')).toBe(true);
    expect(answerLinksSupported('[Policy](' + url + '#late)', sources, '')).toBe(true);
    expect(answerLinksSupported('[Scholarship](https://commecscollege.edu.pk/invented-scholarship/)', sources, '')).toBe(false);
    expect(answerLinksSupported('[Policy](https://evil.example/policy)', sources, '')).toBe(false);
    expect(answerLinksSupported('[PDF](https://commecscollege.edu.pk/fee.pdf)', sources, 'Linked document: https://commecscollege.edu.pk/fee.pdf')).toBe(true);
  });
  it('discards an invented citation before release and uses an actual retry', async () => {
    resetQuotaForTests(); let calls = 0; const received: string[] = [], phases: string[] = [];
    await generateChatStream('Explain the late payment penalty', [], new AbortController().signal, 'fast', text => { received.push(text); }, () => undefined, undefined, async () => {
      const text = ++calls === 1 ? '[Fake policy](https://commecscollege.edu.pk/fake-policy/)' : 'A late payment penalty of Rs. 1,000 is described in the supplied policy.';
      return (async function* () { yield { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }; })();
    }, { buffered: true, requireSources: true, onProgress: p => { phases.push(p.phase); } });
    expect(received).toHaveLength(1); expect(received[0]).not.toContain('Fake'); expect(calls).toBe(2);
    expect(phases).toContain('retrying');
  });
  it.each([
    ['fees kitni hai', 'roman'], ['mujhe admission details chahiye', 'roman'], ['فیس کتنی ہے؟', 'ur'], ['What are the fees?', 'en'],
  ] as const)('detects the latest question language: %s', (question, language) => expect(resolveLanguage(question, 'auto')).toBe(language));
  it('honors an explicit language over auto detection', () => expect(resolveLanguage('فیس کتنی ہے؟', 'en')).toBe('en'));
  it('automatically localizes saved evidence for Roman Urdu', () => expect(getSavedEvidence('fees kitni hai', [], { language: 'auto', responseStyle: 'concise' })?.answer).toContain('Live AI abhi'));
  it('returns only the related club extract without claiming a robotics club exists', () => {
    const answer = getSavedEvidence('Is there a robotics club at Commecs?', [], { language: 'en', responseStyle: 'concise' })?.answer;
    expect(answer).toContain('only part of your question'); expect(answer).toContain('clubs and societies');
    expect(answer).not.toContain('When does admission start'); expect(answer).not.toContain('robotics');
  });
  it('avoids repeated history and reviewed extracts from the same source in a concise fallback', () => {
    const result = getSavedEvidence('Programs offered', [], { language: 'en', responseStyle: 'concise' });
    expect(result?.answer).toContain('Intermediate programme'); expect(result?.answer).not.toContain('History and Background');
    expect(result?.answer.match(/Read the official source/g)).toHaveLength(1);
  });
});
