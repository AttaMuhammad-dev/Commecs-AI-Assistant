import { safeSourceUrl, type Source } from '../shared/chat.js';
function canonical(value: string) {
  try { const url = new URL(value); url.hash = ''; url.pathname = url.pathname.replace(/\/$/, '') || '/'; return url.href; } catch { return ''; }
}
export function answerLinksSupported(answer: string, sources: Source[], suppliedEvidence: string): boolean {
  const urls = (text: string) => text.match(/https?:\/\/[^\s"'<>()[\]\\]+/g) || [];
  const allowed = new Set([...sources.map(s => s.url), ...urls(suppliedEvidence)].filter(safeSourceUrl).map(canonical));
  return urls(answer).every(url => {
    const clean = url.replace(/[.,;]+$/, '');
    return safeSourceUrl(clean) && allowed.has(canonical(clean));
  });
}
