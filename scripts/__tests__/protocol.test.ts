import { describe, it, expect } from 'vitest';
import { parseSSE } from '../../src/lib/sseParser';
import { generateKey } from '../../server/cache';
import { routeQuestion } from '../../server/router';
import { safeSourceUrl } from '../../shared/chat';
function stream(pieces: Uint8Array[]) { return new ReadableStream<Uint8Array>({start(c) { for (const p of pieces) c.enqueue(p); c.close(); }}); }
describe('protocol and context boundaries', () => {
  it('preserves every event over one-byte packets including Urdu', async () => {
    const input = 'event: status\r\ndata: {"lane":"deep"}\r\n\r\nevent: chunk\ndata: {"text":"سلام"}\n\nevent: contact\ndata: {"email":"a"}\n\nevent: done\ndata: {"finishReason":"STOP"}\n\n';
    const bytes = new TextEncoder().encode(input);
    const output = [];
    for await (const frame of parseSSE(stream(Array.from(bytes, b => Uint8Array.of(b))))) output.push(frame);
    expect(output.map(e => e.event)).toEqual(['status','chunk','contact','done']);
    expect(output[1].data.text).toBe('سلام');
  });
  it('handles multiline JSON data and an unterminated final frame', async () => {
    const output = [];
    for await (const frame of parseSSE(stream([new TextEncoder().encode('event: chunk\ndata: {"text":\ndata: "hello"}')]))) output.push(frame);
    expect(output[0].data.text).toBe('hello');
  });
  it('rejects malformed JSON rather than silently accepting broken answers', async () => {
    const consume = async () => { for await (const _ of parseSSE(stream([new TextEncoder().encode('data: {bad}\n\n')]))) { /* consume */ } };
    await expect(consume()).rejects.toThrow('INVALID_STREAM');
  });
  it('separates reply languages in the cache', () => {
    expect(generateKey('fees',[],'fast',{language:'ur',responseStyle:'concise'})).not.toBe(generateKey('fees',[],'fast',{language:'en',responseStyle:'concise'}));
  });
  it('routes Urdu comparisons and contextual percentages without expensive fee-year false positives', () => {
    expect(routeQuestion('پری میڈیکل اور کامرس میں کیا فرق ہے؟',[]).lane).toBe('deep');
    expect(routeQuestion('میرے ۷۲ فیصد ہیں کیا میں اہل ہوں؟',[]).lane).toBe('deep');
    expect(routeQuestion('What about 72%?', [{role:'user',text:'What marks do I need to be eligible?'}]).lane).toBe('deep');
    expect(routeQuestion('What are the fees for 2026?',[]).lane).toBe('fast');
  });
  it('only links official secure sources', () => {
    expect(safeSourceUrl('https://commecscollege.edu.pk/fees/')).toBe(true);
    for(const url of ['javascript:alert(1)','fileSearchStores/abc','https://commecscollege.edu.pk.evil.com/','http://commecscollege.edu.pk/']) expect(safeSourceUrl(url)).toBe(false);
  });
});
