import { streamBotResponse } from '../lib/chatService';
import { useChatStore } from '../store/useChatStore';
import type { ChatMessage } from '../types/chat';
import { resolveLanguage } from '../../shared/chat';
let active: { controller: AbortController; id: string; conversationId: string } | null = null;
const errorText = (code: string) => code === 'RATE_LIMITED' ? 'Please wait a minute before asking again. You can still review earlier answers.' : code === 'BAD_REQUEST' ? 'Please keep your question under 600 characters.' : 'The reply was interrupted. Check your connection and try again.';
export function stopResponse() {
  if (!active) return;
  const request = active;
  active = null;
  request.controller.abort();
  const stopped = (messages: ChatMessage[]) => messages.map(m => m.id === request.id ? { ...m, status: 'stopped' as const, finishReason: 'INTERRUPTED' as const, text: m.text || 'Response stopped.' } : m);
  useChatStore.setState(s => ({
    ...(s.activeId === request.conversationId ? { messages: stopped(s.messages) } : {}),
    conversations: s.conversations.map(c => c.id === request.conversationId ? { ...c, messages: stopped(c.messages) } : c),
    ...(s.progress?.messageId === request.id ? { progress: null } : {}),
  }));
}
// Also cancel switches made outside the sidebar. An old stream cannot resume in a reopened chat.
useChatStore.subscribe((state, previous) => { if (state.activeId !== previous.activeId && active) stopResponse(); });
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
  const initialProgress = { conversationId, messageId: botId, startedAt: Date.now(), language: resolveLanguage(text, state.preferences.language), phase: 'sending' as const };
  state.setProgress(initialProgress);
  const update = (fn: (m: ChatMessage) => ChatMessage) => {
    if (active?.id === botId && !controller.signal.aborted && useChatStore.getState().activeId === conversationId) useChatStore.getState().setMessages(messages => messages.map(m => m.id === botId ? fn(m) : m));
  };
  try {
    for await (const chunk of streamBotResponse(text, history, controller.signal, state.preferences)) {
      if (controller.signal.aborted || active?.id !== botId) break;
      const { progress, ...answer } = chunk;
      if (progress) { useChatStore.getState().setProgress({ ...initialProgress, ...progress }); continue; }
      if (answer.finishReason) useChatStore.getState().clearProgress(botId);
      update(m => ({ ...m, ...answer, mode: answer.mode === 'deep' ? 'thinking' : answer.mode || m.mode, text: m.text + (answer.text || ''), status: 'streaming' }));
    }
    if (!controller.signal.aborted) update(m => ({ ...m, status: m.text.trim() ? 'complete' : 'error', text: m.text || 'No answer arrived. Please try again.' }));
  } catch (error) {
    if (!controller.signal.aborted) update(m => ({ ...m, status: 'error', finishReason: 'INTERRUPTED', text: m.text || errorText(error instanceof Error ? error.message : '') }));
  } finally { useChatStore.getState().clearProgress(botId); if (active?.id === botId) active = null; }
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
