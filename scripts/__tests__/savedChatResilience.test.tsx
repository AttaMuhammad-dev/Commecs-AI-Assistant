import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { restoreConversations } from '../../src/lib/savedChats';
let restored: typeof import('../../src/store/useChatStore')['useChatStore'] | undefined;
const valid = { id: 'answer', role: 'bot', text: 'A saved answer.', status: 'complete', createdAt: 1 };
async function restore(messages: unknown[]) {
  vi.resetModules();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('document', { documentElement: { classList: { contains: () => false } } });
  vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'commecs-remember' ? 'true' : key === 'commecs-chats-v2' ? JSON.stringify([{ id: 'chat', title: 'Saved chat', updatedAt: 1, messages }]) : null, setItem: vi.fn(), removeItem: vi.fn() });
  restored = (await import('../../src/store/useChatStore')).useChatStore;
  return restored;
}
afterEach(() => { restored?.getState().setRemember(false); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('saved conversation recovery', () => {
  it('keeps valid messages when an individual saved entry is null or malformed', async () => {
    const store = await restore([null, 0, { text: 'Invalid role', role: 'system' }, valid]);
    expect(store.getState().messages.map(m => m.text)).toEqual(['A saved answer.']);
  });
  it('renders safely when saved source/contact metadata has an invalid shape', async () => {
    const store = await restore([{ ...valid, sources: { title: 'Not an array' }, contact: { landline: { private: 'value' }, email: 7 }, progress: { phase: 'checking' } }]);
    const MessageBubble = (await import('../../src/components/MessageBubble')).default;
    expect(() => renderToStaticMarkup(<MessageBubble message={store.getState().messages[0]} />)).not.toThrow();
    expect(JSON.stringify(store.getState().messages)).not.toContain('private');
    expect(JSON.stringify(store.getState().messages)).not.toContain('progress');
  });
  it('restores interrupted requests as stopped and excludes forged completion metadata', async () => {
    const store = await restore([{ ...valid, status: 'streaming', sources: [null, { title: 'Unsafe', url: 'javascript:alert(1)' }], cached: 'yes' }, { ...valid, id: 'other', status: 'invented', finishReason: 'invented' }]);
    expect(store.getState().messages[0]).toMatchObject({ status: 'stopped', finishReason: 'INTERRUPTED', sources: [] });
    expect(store.getState().messages[0].cached).toBeUndefined();
    expect(store.getState().messages[1].status).toBe('stopped');
  });
  it('reports storage quota failures and recovers without losing the open conversation', async () => {
    vi.useFakeTimers();
    const store = await restore([valid]);
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('Quota exceeded'); });
    store.getState().setMessages(messages => [...messages, { ...valid, id: 'new', role: 'user', text: 'New question', status: 'complete' }]);
    await vi.advanceTimersByTimeAsync(300);
    expect(store.getState().storageError).toBe(true); expect(store.getState().messages).toHaveLength(2);
    vi.mocked(localStorage.setItem).mockImplementation(() => undefined);
    store.getState().setMessages(messages => [...messages]); await vi.advanceTimersByTimeAsync(300);
    expect(store.getState().storageError).toBe(false); expect(store.getState().messages).toHaveLength(2);
  });
  it('shows a useful message when refreshing before any answer arrives', () => {
    const saved = restoreConversations([{ id: 'pending', title: 'Question', messages: [{ ...valid, text: '', status: 'sending' }] }]);
    expect(saved[0].messages[0]).toMatchObject({ text: 'This reply was interrupted. Please try again.', status: 'stopped', finishReason: 'INTERRUPTED' });
  });
  it('handles storage denied when enabling or removing saved copies', async () => {
    const store = await restore([valid]);
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('Denied'); });
    store.getState().setRemember(true); expect(store.getState().storageError).toBe(true);
    store.getState().setRemember(false); expect(store.getState().storageError).toBe(true);
    expect(store.getState().messages[0].text).toBe(valid.text);
  });
  it('keeps IDs unique and bounds restored data while preserving valid sources', () => {
    const source = { title: 'Policy', url: 'https://commecscollege.edu.pk/students-code-of-conduct/', modified: '2023-01-10', attributed: true };
    const saved = restoreConversations(Array.from({ length: 20 }, (_, i) => ({ id: 'chat-' + i, title: 'Chat', updatedAt: Infinity, messages: Array.from({ length: 100 }, () => ({ ...valid, sources: [source, null] })) })));
    expect(saved).toHaveLength(15); expect(saved[0].messages).toHaveLength(80);
    expect(new Set(saved[0].messages.map(m => m.id)).size).toBe(80);
    expect(saved[0].messages[0].sources).toEqual([source]); expect(saved[0].updatedAt).toBe(0);
  });
});
