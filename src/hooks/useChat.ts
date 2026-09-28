import { streamBotResponse } from '../lib/chatService';
import { useChatStore } from '../store/useChatStore';
import type { ChatMessage } from '../types/chat';
let active: { controller: AbortController; id: string; conversationId: string } | null = null;
const errorText = (code: string) => code === 'RATE_LIMITED' ? 'Please wait a minute before asking again. You can still review earlier answers.' : code === 'BAD_REQUEST' ? 'Please keep your question under 600 characters.' : 'The reply was interrupted. Check your connection and try again.';
export function stopResponse() {
  if (!active) return;
  active.controller.abort();
  const botId = active.id;
  useChatStore.getState().setMessages(messages => messages.map(m => m.id === botId ? { ...m, status: 'stopped', finishReason: 'INTERRUPTED', text: m.text || 'Response stopped.' } : m));
  active = null;
}
async function sendMessage(value: string) {
  const text = value.trim();
  const state = useChatStore.getState();
  if (!text || text.length > 600 || active || state.isOffline) return;
  const controller = new AbortController();
  const botId = crypto.randomUUID();
  const conversationId = state.activeId;
  active = { controller, id: botId, conversationId };
  // Only send complete user/assistant pairs, never fallback or stopped responses.
  const history: ChatMessage[] = [];
  for (let i = 0; i + 1 < state.messages.length; i++) {
    const user = state.messages[i], bot = state.messages[i + 1];
    if (user.role === 'user' && bot.role === 'bot' && bot.status === 'complete' && !bot.fallback && (!bot.finishReason || bot.finishReason === 'STOP')) history.push(user, bot);
  }
  state.setMessages(messages => [...messages, { id: crypto.randomUUID(), role: 'user', text, status: 'complete', createdAt: Date.now() }, { id: botId, role: 'bot', text: '', status: 'sending', createdAt: Date.now() }]);
  const update = (fn: (m: ChatMessage) => ChatMessage) => {
    if (useChatStore.getState().activeId === conversationId) useChatStore.getState().setMessages(messages => messages.map(m => m.id === botId ? fn(m) : m));
  };
  try {
    for await (const chunk of streamBotResponse(text, history, controller.signal, state.preferences)) {
      if (controller.signal.aborted) break;
      update(m => ({ ...m, ...chunk, mode: chunk.mode === 'deep' ? 'thinking' : chunk.mode || m.mode, text: m.text + (chunk.text || ''), status: 'streaming' }));
    }
    if (!controller.signal.aborted) update(m => ({ ...m, status: m.text.trim() ? 'complete' : 'error', text: m.text || 'No answer arrived. Please try again.' }));
  } catch (error) {
    if (!controller.signal.aborted) update(m => ({ ...m, status: 'error', finishReason: 'INTERRUPTED', text: m.text || errorText(error instanceof Error ? error.message : '') }));
  } finally { if (active?.id === botId) active = null; }
}
function retryMessage(id: string) {
  if (active) return;
  const state = useChatStore.getState();
  if (state.isOffline) return;
  const index = state.messages.findIndex(m => m.id === id);
  // Regenerate only the latest turn; never silently rewrite later conversation context.
  if (index !== state.messages.length - 1) return;
  const user = state.messages[index - 1];
  if (user?.role !== 'user') return;
  state.setMessages(messages => messages.slice(0, index - 1));
  void sendMessage(user.text);
}
export function useChat() { return { sendMessage, handleSend: sendMessage, onSend: sendMessage, retryMessage, stopResponse }; }
export default useChat;
