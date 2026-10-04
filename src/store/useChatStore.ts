import { create } from 'zustand';
import type { ChatMessage, Conversation, Preferences, RequestProgress } from '../types/chat';
import { preferencesKey, readPreferences } from '../lib/preferences';
import { restoreConversations } from '../lib/savedChats';
interface ChatState {
  messages: ChatMessage[]; conversations: Conversation[]; activeId: string;
  isOffline: boolean; theme: 'light' | 'dark'; preferences: Preferences;
  remember: boolean; storageError: boolean; draft: string; sidebarOpen: boolean;
  progress: RequestProgress | null;
  setProgress: (progress: RequestProgress) => void;
  clearProgress: (messageId: string) => void;
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  toggleTheme: () => void; setOffline: (value: boolean) => void;
  setPreferences: (prefs: Partial<Preferences>) => void; setDraft: (value: string) => void;
  setSidebarOpen: (value: boolean) => void; setRemember: (value: boolean) => void;
  newChat: () => void; openChat: (id: string) => void; deleteChat: (id: string) => void;
}
const storageKey = 'commecs-chats-v2';
function readSaved(): Conversation[] {
  try {
    if (localStorage.getItem('commecs-remember') !== 'true') return [];
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return restoreConversations(value);
  } catch { return []; }
}
const saved = readSaved();
const id = () => crypto.randomUUID();
export const useChatStore = create<ChatState>((set) => ({
  messages: saved[0]?.messages || [], conversations: saved, activeId: saved[0]?.id || id(),
  isOffline: !navigator.onLine, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  preferences: readPreferences(), remember: saved.length > 0 || (() => { try { return localStorage.getItem('commecs-remember') === 'true'; } catch { return false; } })(),
  draft: '', sidebarOpen: false, progress: null, storageError: false,
  setProgress: progress => set(s => s.activeId === progress.conversationId && s.messages.some(m => m.id === progress.messageId && ['sending', 'streaming'].includes(m.status)) ? { progress } : {}),
  clearProgress: messageId => set(s => s.progress?.messageId === messageId ? { progress: null } : {}),
  setMessages: updater => set(s => {
    const messages = updater(s.messages);
    const entry = { id: s.activeId, title: messages.find(m => m.role === 'user')?.text.slice(0, 52) || 'New conversation', messages, updatedAt: Date.now() };
    return { messages, conversations: [entry, ...s.conversations.filter(c => c.id !== s.activeId)].slice(0, 15) };
  }),
  toggleTheme: () => set(s => {
    const theme = s.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('theme', theme); } catch { /* memory-only is fine */ }
    return { theme };
  }),
  setOffline: isOffline => set({ isOffline }),
  setPreferences: prefs => set(s => {
    const preferences = { ...s.preferences, ...prefs };
    try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); } catch { /* preferences still work in memory */ }
    return { preferences };
  }),
  setDraft: draft => set({ draft }),
  setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
  setRemember: remember => {
    let storageError = false;
    try { localStorage.setItem('commecs-remember', String(remember)); if (!remember) localStorage.removeItem(storageKey); } catch { storageError = true; }
    set({ remember, storageError });
  },
  newChat: () => set({ messages: [], activeId: id(), draft: '', sidebarOpen: false, progress: null }),
  openChat: activeId => set(s => ({ activeId, messages: s.conversations.find(c => c.id === activeId)?.messages || [], draft: '', sidebarOpen: false, ...(activeId !== s.activeId ? { progress: null } : {}) })),
  deleteChat: removedId => set(s => ({ conversations: s.conversations.filter(c => c.id !== removedId), ...(removedId === s.activeId ? { activeId: id(), messages: [], draft: '', progress: null } : {}) })),
}));
let saveTimer: ReturnType<typeof setTimeout>;
useChatStore.subscribe((state, previous) => {
  if (state.conversations === previous.conversations && state.remember === previous.remember) return;
  clearTimeout(saveTimer);
  if (!state.remember) return;
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state.conversations.map(c => ({ ...c, messages: c.messages.slice(-80) })))); useChatStore.setState({ storageError: false }); }
    catch { useChatStore.setState({ storageError: true }); }
  }, 300);
});
