import { create } from 'zustand';
import type { ChatMessage, Conversation, Preferences } from '../types/chat';
import { DEFAULT_PREFERENCES } from '../../shared/chat';
interface ChatState {
  messages: ChatMessage[]; conversations: Conversation[]; activeId: string;
  isOffline: boolean; theme: 'light' | 'dark'; preferences: Preferences;
  remember: boolean; draft: string; sidebarOpen: boolean;
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
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is Conversation => !!v && typeof v.id === 'string' && typeof v.title === 'string' && Array.isArray(v.messages))
      .slice(0, 15).map(v => ({ ...v, messages: v.messages.filter(m => typeof m.text === 'string' && ['user','bot'].includes(m.role)).slice(-80).map(m => ({ ...m, status: m.status === 'sending' || m.status === 'streaming' ? 'stopped' : m.status })) }));
  } catch { return []; }
}
const saved = readSaved();
const id = () => crypto.randomUUID();
export const useChatStore = create<ChatState>((set) => ({
  messages: saved[0]?.messages || [], conversations: saved, activeId: saved[0]?.id || id(),
  isOffline: !navigator.onLine, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  preferences: DEFAULT_PREFERENCES, remember: saved.length > 0 || (() => { try { return localStorage.getItem('commecs-remember') === 'true'; } catch { return false; } })(),
  draft: '', sidebarOpen: false,
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
  setPreferences: prefs => set(s => ({ preferences: { ...s.preferences, ...prefs } })),
  setDraft: draft => set({ draft }),
  setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
  setRemember: remember => {
    try { localStorage.setItem('commecs-remember', String(remember)); if (!remember) localStorage.removeItem(storageKey); } catch { /* unavailable storage */ }
    set({ remember });
  },
  newChat: () => set({ messages: [], activeId: id(), draft: '', sidebarOpen: false }),
  openChat: activeId => set(s => ({ activeId, messages: s.conversations.find(c => c.id === activeId)?.messages || [], draft: '', sidebarOpen: false })),
  deleteChat: removedId => set(s => ({ conversations: s.conversations.filter(c => c.id !== removedId), ...(removedId === s.activeId ? { activeId: id(), messages: [], draft: '' } : {}) })),
}));
let saveTimer: ReturnType<typeof setTimeout>;
useChatStore.subscribe(state => {
  clearTimeout(saveTimer);
  if (!state.remember) return;
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state.conversations.map(c => ({ ...c, messages: c.messages.slice(-80) })))); }
    catch { /* storage can be full or disabled; chat remains usable */ }
  }, 300);
});
