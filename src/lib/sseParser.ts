export async function* parseSSE(responseBody: ReadableStream<Uint8Array>) {
  const reader = responseBody.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let dataLines: string[] = [];
  function dispatch(): { event: string; data: Record<string, unknown> } | null {
    if (!dataLines.length) { event = 'message'; return null; }
    const raw = dataLines.join('\n');
    const name = event;
    event = 'message'; dataLines = [];
    if (raw === '[DONE]') return { event: 'done', data: { finishReason: 'STOP' } };
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error('INVALID_STREAM'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_STREAM');
    return { event: name, data: parsed as Record<string, unknown> };
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // Keep CR until the next packet, so CRLF split between packets is handled.
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        if (!line) { const frame = dispatch(); if (frame) yield frame; }
        else if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (done) {
        if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).replace(/^ /, '').replace(/\r$/, ''));
        const frame = dispatch(); if (frame) yield frame;
        break;
      }
      if (buffer.length > 1000000) throw new Error('INVALID_STREAM');
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
