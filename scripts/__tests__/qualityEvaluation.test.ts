import { describe, it, expect } from 'vitest';
import { qualityCases } from '../../eval/qualityCases';
import { scoreQuality } from '../../eval/qualityScoring';
import { unsupportedNumericClaims, missingLatePenalty } from '../../server/answerQuality';
const commerce = qualityCases.find(c => c.id === 'commerce-threshold')!;
const valid = { text: 'Minimum SSC marks: 60%.', sources: [{ url: 'https://commecscollege.edu.pk/eligibility/' }], finishReason: 'STOP', fallback: false };
describe('evidence-linked quality scoring', () => {
  it('checks the claim as well as the source URL', () => {
    expect(scoreQuality(commerce, valid).passed).toBe(true);
    expect(scoreQuality(commerce, { ...valid, text: 'Minimum SSC marks: 50%.' }).passed).toBe(false);
    expect(scoreQuality(commerce, { ...valid, sources: [] }).failures).toContain('missing supporting source: commerce minimum');
  });
  it('does not count a fallback or partial answer as a model-quality pass', () => {
    expect(scoreQuality(commerce, { ...valid, fallback: true }).mode).toBe('fallback');
    expect(scoreQuality(commerce, { ...valid, fallback: true }).passed).toBe(false);
    expect(scoreQuality(commerce, { ...valid, finishReason: 'INTERRUPTED' }).failures).toContain('incomplete');
  });
  it('requires every applicable condition and a separate advice heading', () => {
    const unpaid = qualityCases.find(c => c.id === 'unpaid-fee')!;
    expect(scoreQuality(unpaid, { ...valid, text: 'Admission is cancelled.', sources: [{ url: 'https://commecscollege.edu.pk/fee-payment-policy/' }] }).failures.length).toBe(unpaid.facts.length - 1);
    const advice = qualityCases.find(c => c.id === 'shy-student-guidance')!;
    const answer = { ...valid, text: 'Dramatics may build confidence.', sources: [{ url: advice.facts[0].source! }] };
    expect(scoreQuality(advice, answer).passed).toBe(false);
    expect(scoreQuality(advice, { ...answer, text: 'College information\nDramatics is listed.\n\n### General guidance\nPractice can help confidence.' }).passed).toBe(true);
  });
  it('rejects irrelevant sources and unsafe citations', () => {
    const phone = qualityCases[0];
    const answer = { ...valid, text: 'Phones are prohibited. Use the college phone.', sources: [{ url: phone.facts[0].source! }, { url: 'https://commecscollege.edu.pk/fee-payment-policy/' }] };
    expect(scoreQuality(phone, answer).failures).toContain('unrelated source: fee');
    expect(scoreQuality(commerce, { ...valid, sources: [{ url: 'https://evil.example/' }] }).failures).toContain('unsafe source');
  });
  it('checks Urdu script separately and retains a human-review requirement', () => {
    const test = qualityCases.find(c => c.id === 'urdu-science')!;
    expect(scoreQuality(test, { ...valid, text: '۶۵ فیصد نمبر ضروری ہیں۔' }).passed).toBe(true);
    expect(scoreQuality(test, { ...valid, text: '65% required.' }).failures).toContain('Urdu script missing');
    expect(scoreQuality(commerce, valid).humanReviewRequired).toBe(true);
  });
  it('accepts an alternative source backed by its own original passage', () => {
    expect(scoreQuality(commerce, { ...valid, sources: [{ url: 'https://commecscollege.edu.pk/instructions-for-admission/' }] }).passed).toBe(true);
    expect(scoreQuality(commerce, { ...valid, sources: [{ url: 'https://commecscollege.edu.pk/about/' }] }).passed).toBe(false);
  });
  it('tracks application boundaries separately from model quality', () => {
    const test = qualityCases.find(c => c.id === 'private-record')!;
    const score = scoreQuality(test, { text: 'I cannot access private records.', sources: [], finishReason: 'STOP', fallback: false, notice: 'privacy' });
    expect(score.passed).toBe(true); expect(score.mode).toBe('guarded');
    expect(scoreQuality(commerce, { ...valid, notice: 'privacy' }).passed).toBe(false);
  });
});
describe('bounded numeric support guard', () => {
  it('requires the central penalty in a late-payment follow-up, without hardcoding its amount', () => {
    const evidence = ['A penalty of Rs.2,000/- will be imposed if the fee is not paid.'];
    expect(missingLatePenalty('A readmission fee of Rs.10000 applies.', 'What happens if fees are paid late? Tell me more', evidence)).toBe(true);
    expect(missingLatePenalty('Rs. 2,000 penalty applies.', 'What happens if fees are paid late? Tell me more', evidence)).toBe(false);
    expect(missingLatePenalty('No amount known.', 'Library hours?', evidence)).toBe(false);
    expect(missingLatePenalty('No amount known.', 'Late fee?', [])).toBe(false);
    expect(missingLatePenalty('Conflicting amounts.', 'Late fee?', [...evidence, 'A penalty of Rs.3000 applies.'])).toBe(false);
  });
  it.each(['Rs. 999999', '**PKR 999,999**', '999999 PKR', '999999 rupay', '99.9 percent', '99.9 per cent', '۹۹٫۹ فیصد', '999999 روپے', '-60%'])('rejects an unsupported amount/rate: %s', text => {
    expect(unsupportedNumericClaims(text, 'Rs.1,000 penalty; 60%')).not.toEqual([]);
  });
  it('accepts supplied figures in multiple scripts and formatted currency', () => {
    expect(unsupportedNumericClaims('Rs. 1,000 and ۶۰ فیصد', 'Rs.1000 penalty; 60%')).toEqual([]);
  });
  it('permits correct explicit arithmetic with supplied inputs but rejects an invented result', () => {
    expect(unsupportedNumericClaims('Calculation: 1000 × 2 = Rs. 2000', 'Rs.1000', 'two months; 2')).toEqual([]);
    expect(unsupportedNumericClaims('1000 × 2 = Rs. 3000', 'Rs.1000', '2')).toEqual([3000]);
    expect(unsupportedNumericClaims('9 × 8 = Rs. 72', 'Rs.1000')).toEqual([72]);
  });
  it('does not treat a URL without readable figures as evidence', () => {
    expect(unsupportedNumericClaims('Rs. 777777', 'Source: https://commecscollege.edu.pk/fee-payment-policy/')).toEqual([777777]);
  });
});
