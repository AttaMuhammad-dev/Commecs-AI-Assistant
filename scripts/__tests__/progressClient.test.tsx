import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TypingIndicator from '../../src/components/TypingIndicator';
import { streamGeminiResponse } from '../../src/lib/geminiChatService';
import { PROGRESS_PHASES } from '../../shared/chat';
import { progressLabel } from '../../src/lib/progressText';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('progress protocol and presentation', () => {
  it('parses fragmented progress separately and ignores arbitrary provider text', async () => {
    const bytes = new TextEncoder().encode('event: progress\ndata: {"phase":"preparing","message":"SECRET"}\n\nevent: progress\ndata: {"phase":"unknown","message":"SECRET"}\n\nevent: progress\ndata: {"phase":"retrying","reason":"timeout"}\n\nevent: chunk\ndata: {"text":"Answer"}\n\nevent: done\ndata: {"finishReason":"STOP"}\n\n');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) { for (const b of bytes) c.enqueue(Uint8Array.of(b)); c.close(); } }))));
    const chunks = []; for await (const chunk of streamGeminiResponse('fees', [])) chunks.push(chunk);
    expect(chunks).toEqual([{ progress: { phase: 'preparing' } }, { progress: { phase: 'retrying', reason: 'timeout' } }, { text: 'Answer' }, { finishReason: 'STOP' }]);
  });
  it('retains the real phase with elapsed time outside the live announcement', () => {
    vi.spyOn(Date, 'now').mockReturnValue(20000);
    const html = renderToStaticMarkup(<TypingIndicator progress={{ conversationId: 'c', messageId: 'b', startedAt: 10000, language: 'en', phase: 'preparing' }} />);
    expect(html).toContain('Preparing your answer…');
    expect(html).toContain('<small aria-hidden="true">Still working… 10s elapsed</small>');
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(html).not.toContain('typing-dots');
  });
  it('shows no slow warning before eight seconds', () => {
    const html = renderToStaticMarkup(<TypingIndicator progress={{ conversationId: 'c', messageId: 'b', startedAt: Date.now(), language: 'en', phase: 'preparing' }} />);
    expect(html).not.toContain('Still working');
  });
  it('localizes every phase and timeout in all supported preferences', () => {
    for (const language of ['en', 'ur', 'roman'] as const) for (const phase of ['sending', ...PROGRESS_PHASES] as const) expect(progressLabel(phase, language).length).toBeGreaterThan(10);
    expect(progressLabel('retrying', 'roman', 'timeout')).toContain('zyada waqt');
    const html = renderToStaticMarkup(<TypingIndicator progress={{ conversationId: 'c', messageId: 'b', startedAt: Date.now(), language: 'ur', phase: 'retrieving' }} />);
    expect(html).toContain('dir="rtl"'); expect(html).toContain('متعلقہ معلومات');
  });
});
