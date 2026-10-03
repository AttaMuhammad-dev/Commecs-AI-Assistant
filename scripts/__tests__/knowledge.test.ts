import { describe, expect, it } from 'vitest';
import { retrieveEvidence } from '../../server/knowledge';
import { getSavedEvidence } from '../../server/savedEvidence';
import { DEFAULT_PREFERENCES } from '../../shared/chat';

describe('college evidence retrieval', () => {
  it.each(['Explain penalties for late fee payment', 'fees kitni hai', 'فیس کتنی ہے'])('retrieves relevant fee evidence: %s', question => {
    const evidence = retrieveEvidence(question);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some(e => /fee/i.test(e.source.title + e.source.url))).toBe(true);
  });
  it('retrieves fee amounts for an unfamiliar wording from existing reviewed information', () => {
    const evidence = retrieveEvidence('Computer science tuition charges and admission cost');
    expect(evidence.map(e => e.text).join('\n')).toContain('316,950');
  });
  it('resolves a short follow-up using the last user topic', () => {
    const evidence = retrieveEvidence('What about penalties?', [{ role: 'user', text: 'Fee payment rules' }]);
    expect(evidence.some(e => e.source.url.endsWith('/fee-payment-policy/'))).toBe(true);
  });
  it('excludes unrelated policies when a fee payment source strongly matches', () => {
    const evidence = retrieveEvidence('Summarize the published fee payment policy and cite its official source.');
    expect(evidence[0].source.url).toContain('/fee-payment-policy/');
    expect(evidence.some(e => e.source.url.includes('conflict-of-interest'))).toBe(false);
  });
  it('does not fabricate evidence for unrelated subjects or private records', () => {
    expect(retrieveEvidence('Explain quantum gravity wormholes')).toEqual([]);
    expect(getSavedEvidence('What is my admission result?', [], DEFAULT_PREFERENCES)).toBeNull();
  });
  it('provides dated evidence under provider failure, including Roman Urdu', () => {
    const result = getSavedEvidence('Late payment fine', [], { language: 'roman', responseStyle: 'concise' });
    expect(result?.answer).toContain('Source date:');
    expect(result?.answer).toContain('Live AI abhi');
    expect(result?.sources.length).toBeGreaterThan(0);
  });
});
