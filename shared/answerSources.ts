import { safeSourceUrl, type Source } from './chat.js';

export function canonicalSourceUrl(value: string) {
  try {
    const url = new URL(value); url.hash = '';
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    return url.href;
  } catch { return ''; }
}
export function answerSourceUrls(answer: string): string[] {
  return [...new Set((answer.match(/https?:\/\/[^\s"'<>()[\]\\]+/g) || []).map(url => url.replace(/[.,;:!?]+$/, '')).filter(safeSourceUrl).map(canonicalSourceUrl))];
}
// Explicit references narrow the displayed cards. Provider supports can retain
// an additional source attributed to a claim, even without an inline link.
// With no references, callers must supply relevant evidence, never a search dump.
export function selectAnswerSources(answer: string, sources: Source[], supported: string[] = []): Source[] {
  const unique = [...new Map(sources.filter(s => !!s && typeof s.title === 'string' && typeof s.url === 'string' && safeSourceUrl(s.url)).map(s => [canonicalSourceUrl(s.url), s])).values()];
  const referenced = new Set([...answerSourceUrls(answer), ...supported.filter(safeSourceUrl).map(canonicalSourceUrl), ...unique.filter(s => s.attributed).map(s => canonicalSourceUrl(s.url))]);
  return referenced.size ? unique.filter(s => referenced.has(canonicalSourceUrl(s.url))) : unique;
}
