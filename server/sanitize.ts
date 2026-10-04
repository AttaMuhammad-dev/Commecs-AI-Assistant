import { DEFAULT_PREFERENCES, MAX_MESSAGE_LENGTH, type HistoryTurn, type Preferences } from '../shared/chat.js';
const clean = (text: string) => text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
const bad = (message: string): never => { throw Object.assign(new Error(message), { code: 'BAD_REQUEST' }); };
export function sanitizeRequest(body: unknown): { message: string; history: HistoryTurn[]; preferences: Preferences; questionContext?: string } {
  if (!body || typeof body !== 'object') return bad('Expected a JSON object.');
  const data = body as Record<string, unknown>;
  if (typeof data.message !== 'string' || !clean(data.message)) return bad('Please enter a question.');
  const message = clean(data.message);
  if (message.length > MAX_MESSAGE_LENGTH) return bad('Keep your question under 600 characters.');
  if (data.questionContext !== undefined && (typeof data.questionContext !== 'string' || clean(data.questionContext).length > 2400)) return bad('Invalid question context.');
  const questionContext = typeof data.questionContext === 'string' ? clean(data.questionContext) || undefined : undefined;
  const history: HistoryTurn[] = [];
  for (const entry of (Array.isArray(data.history) ? data.history.slice(-8) : [])) {
    if (!entry || typeof entry !== 'object' || typeof entry.text !== 'string') continue;
    if (!['user', 'model', 'bot'].includes(entry.role)) continue;
    const role = entry.role === 'user' ? 'user' : 'model';
    const text = clean(entry.text).slice(0, 2400);
    if (!text || (!history.length && role === 'model')) continue;
    if (history.at(-1)?.role === role) history[history.length - 1].text = (history.at(-1)!.text + '\n' + text).slice(-2400);
    else history.push({ role, text });
  }
  // A failed/pending user turn is not a complete exchange. Keep the last assistant reply.
  if (history.at(-1)?.role === 'user') history.pop();
  const prefs = data.preferences && typeof data.preferences === 'object' ? data.preferences as Record<string, unknown> : {};
  const language = ['auto', 'en', 'ur', 'roman'].includes(String(prefs.language)) ? prefs.language as Preferences['language'] : DEFAULT_PREFERENCES.language;
  return { message, history, preferences: { language, responseStyle: prefs.responseStyle === 'detailed' ? 'detailed' : 'concise' }, ...(questionContext ? { questionContext } : {}) };
}
