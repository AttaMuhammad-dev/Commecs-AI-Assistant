import { sanitizeSources, type Contact } from '../../shared/chat';
import type { ChatMessage, Conversation } from '../types/chat';
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const timestamp = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
function contact(value: unknown): Contact | undefined {
  const c = record(value);
  return c && typeof c.email === 'string' && /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(c.email) && typeof c.landline === 'string' && /^[+\d ()-]{5,40}$/.test(c.landline) && typeof c.whatsapp === 'string' && /^[+\d ()-]{5,40}$/.test(c.whatsapp)
    ? { email: c.email, landline: c.landline, whatsapp: c.whatsapp } : undefined;
}
function message(value: unknown, ids: Set<string>): ChatMessage | null {
  const m = record(value);
  if (!m || !['user', 'bot'].includes(String(m.role)) || typeof m.text !== 'string' || m.text.length > 100000) return null;
  let id = typeof m.id === 'string' && m.id && m.id.length <= 128 ? m.id : crypto.randomUUID();
  if (ids.has(id)) id = crypto.randomUUID(); ids.add(id);
  const interrupted = !['complete', 'error', 'stopped'].includes(String(m.status)) || (m.finishReason !== undefined && !['STOP', 'MAX_TOKENS', 'INTERRUPTED', 'BLOCKED'].includes(String(m.finishReason)));
  const status = interrupted ? 'stopped' : m.status as ChatMessage['status'];
  const details = contact(m.contact);
  // Restore only known fields. Progress and arbitrary old metadata never become history.
  return { id, role: m.role as ChatMessage['role'], text: m.text, status, createdAt: timestamp(m.createdAt), sources: sanitizeSources(m.sources),
    ...(interrupted ? { finishReason: 'INTERRUPTED' as const } : m.finishReason !== undefined ? { finishReason: m.finishReason as ChatMessage['finishReason'] } : {}),
    ...(['fast', 'thinking', 'verified'].includes(String(m.mode)) ? { mode: m.mode as ChatMessage['mode'] } : {}),
    ...(details ? { contact: details } : {}),
    ...(typeof m.cached === 'boolean' ? { cached: m.cached } : {}),
    ...(typeof m.local === 'boolean' ? { local: m.local } : {}),
    ...(typeof m.fallback === 'boolean' ? { fallback: m.fallback } : {}),
    ...(timestamp(m.verifiedAt) ? { verifiedAt: timestamp(m.verifiedAt) } : {}),
    ...(['up', 'down'].includes(String(m.feedback)) ? { feedback: m.feedback as ChatMessage['feedback'] } : {}),
  };
}
export function restoreConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const conversations: Conversation[] = [];
  for (const item of value) {
    const c = record(item);
    if (!c || typeof c.id !== 'string' || !c.id || c.id.length > 128 || ids.has(c.id) || typeof c.title !== 'string' || !Array.isArray(c.messages)) continue;
    ids.add(c.id); const messageIds = new Set<string>();
    const messages = c.messages.slice(-80).map(m => message(m, messageIds)).filter((m): m is ChatMessage => !!m);
    conversations.push({ id: c.id, title: c.title.slice(0, 100), updatedAt: timestamp(c.updatedAt), messages });
    if (conversations.length >= 15) break;
  }
  return conversations;
}
