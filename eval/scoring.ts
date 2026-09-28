export interface EvalCase { id: string; q: string; expectLane?: string; include?: string[]; exclude?: string[]; match?: string; citeAny?: string[]; expectFallback?: boolean; note?: string; manualReview?: boolean }
export function scoreAnswer(test: EvalCase, answer: { text: string; lane: string; sources: {title:string;url:string}[]; fallback: boolean; finishReason: string }): string[] {
  const failures: string[] = [];
  const text = answer.text.toLowerCase();
  const matches = (term: string) => term.toLowerCase().split('|').some(option => text.includes(option));
  if (!text.trim()) failures.push('empty');
  if (answer.finishReason !== 'STOP') failures.push('incomplete');
  if (test.expectLane && answer.lane !== test.expectLane) failures.push('lane');
  for (const term of test.include || []) if (!matches(term)) failures.push('missing: ' + term);
  for (const term of test.exclude || []) if (matches(term)) failures.push('forbidden: ' + term);
  if (test.match && !new RegExp(test.match, 'i').test(answer.text)) failures.push('pattern');
  if (test.citeAny?.length && !test.citeAny.some(term => answer.sources.some(s => (s.title + ' ' + s.url).toLowerCase().includes(term.toLowerCase())))) failures.push('citation');
  if (answer.fallback !== (test.expectFallback || false)) failures.push('fallback');
  return failures;
}