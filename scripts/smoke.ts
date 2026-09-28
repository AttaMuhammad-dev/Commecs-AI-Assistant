import 'dotenv/config';
import { generateChatStream } from '../server/gemini.js';

// One bounded live lookup. No prompts, answers, credentials or private records are logged.
try {
  const start = Date.now();
  const result = await generateChatStream('Summarize the published fee payment policy and cite its official source.', [], AbortSignal.timeout(55000), 'fast', () => undefined, () => undefined);
  const passed = result.finishReason === 'STOP' && result.sources.length > 0;
  console.log(JSON.stringify({ passed, model: result.model, finish: result.finishReason, sources: result.sources.map(s => s.url), elapsedMs: Date.now() - start }));
  if (!passed) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ passed: false, code: (error as { code?: string }).code || 'UPSTREAM_ERROR', note: 'Check provider availability and the store configuration. No knowledge was changed.' }));
  process.exitCode = 1;
}
