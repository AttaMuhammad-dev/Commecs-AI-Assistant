import { safeSourceUrl } from '../shared/chat.js';
import type { QualityCase } from './qualityCases.js';
export function scoreQuality(test: QualityCase, answer: { text: string; sources: { url: string }[]; finishReason: string; fallback: boolean }) {
  const failures: string[] = [], text = answer.text.replace(/\*\*/g, '');
  if (!text.trim() || answer.finishReason !== 'STOP') failures.push('incomplete');
  const facts = test.facts.map(fact => {
    const present = new RegExp(fact.pattern, 'is').test(text);
    const sourcePresent = !fact.source || answer.sources.some(s => s.url === fact.source);
    if (!present) failures.push('missing fact: ' + fact.label);
    if (present && !sourcePresent) failures.push('missing supporting source: ' + fact.label);
    return { label: fact.label, present, sourcePresent };
  });
  if (test.language === 'ur' && !/[\u0600-\u06ff]/.test(text)) failures.push('Urdu script missing');
  if (test.language === 'roman' && /[\u0600-\u06ff]/.test(text)) failures.push('Roman Urdu expected');
  const guidanceSeparated = !test.guidance || /(?:^|\n)(?:#{1,4}\s*)?(?:General guidance|Aam rehnumai|عمومی رہنمائی|General advice|Aam mashwara)/im.test(text);
  if (!guidanceSeparated) failures.push('general advice not visibly separated');
  for (const term of test.forbidden || []) if (text.toLowerCase().includes(term.toLowerCase())) failures.push('forbidden claim: ' + term);
  if (answer.sources.some(s => !safeSourceUrl(s.url))) failures.push('unsafe source');
  for (const term of test.excludedSources || []) if (answer.sources.some(s => s.url.toLowerCase().includes(term.toLowerCase()))) failures.push('unrelated source: ' + term);
  // Service notices and extracts are tracked separately; they are not a model
  // quality pass, even if they happen to contain expected keywords.
  const substantive = !answer.fallback;
  if (!substantive) failures.push('fallback: model answer not evaluated');
  return { passed: !failures.length, failures, facts, guidanceSeparated, mode: substantive ? 'answer' : 'fallback', humanReviewRequired: true,
    limitation: 'Pattern/completeness and relevant-source checks; claim entailment, contradictions and advice quality still need review.' };
}
