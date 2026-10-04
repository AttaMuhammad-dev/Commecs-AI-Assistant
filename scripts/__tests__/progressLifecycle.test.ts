import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { BotChunk } from '../../src/types/chat';
vi.mock('../../src/lib/chatService', () => ({ streamBotResponse: vi.fn() }));
import { streamBotResponse } from '../../src/lib/chatService';
let store: typeof import('../../src/store/useChatStore')['useChatStore'];
let chat: ReturnType<typeof import('../../src/hooks/useChat')['useChat']>;
const service = vi.mocked(streamBotResponse);
beforeAll(async () => {
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('document', { documentElement: { classList: { contains: () => false } } });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  store = (await import('../../src/store/useChatStore')).useChatStore;
  chat = (await import('../../src/hooks/useChat')).useChat();
});
beforeEach(() => { chat.stopResponse(); store.setState({ messages: [], conversations: [], activeId: crypto.randomUUID(), progress: null, remember: false, isOffline: false, preferences: { language: 'en', responseStyle: 'concise' } }); service.mockReset(); });
afterEach(() => chat.stopResponse());
function controlled() {
  let resolve: (chunk: BotChunk) => void = () => undefined;
  service.mockImplementationOnce(async function* () { yield { progress: { phase: 'preparing' } }; yield await new Promise<BotChunk>(r => { resolve = r; }); yield { finishReason: 'STOP' }; });
  return (chunk: BotChunk) => resolve(chunk);
}
describe('request-scoped progress', () => {
  it('never adds progress to conversation text, saved messages, or next model history', async () => {
    service.mockImplementation(async function* () { yield { progress: { phase: 'retrieving' } }; yield { progress: { phase: 'checking' } }; yield { text: 'Answer' }; yield { finishReason: 'STOP' }; });
    await chat.sendMessage('Question');
    expect(store.getState().progress).toBeNull();
    expect(JSON.stringify(store.getState().conversations)).not.toContain('progress');
    expect(store.getState().messages.map(m => m.text)).toEqual(['Question', 'Answer']);
    await chat.sendMessage('Follow-up');
    expect(service.mock.calls[1][1].map(m => m.text)).toEqual(['Question', 'Answer']);
  });
  it('clears on failure', async () => {
    service.mockImplementation(async function* () { yield { progress: { phase: 'preparing' } }; throw new Error('UPSTREAM_ERROR'); });
    await chat.sendMessage('Question');
    expect(store.getState().progress).toBeNull(); expect(store.getState().messages[1].status).toBe('error');
  });
  it('keeps phase updates out of browser persistence', async () => {
    vi.mocked(localStorage.setItem).mockClear();
    store.getState().setRemember(true);
    const finish = controlled(), task = chat.sendMessage('Question');
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('preparing'));
    await vi.waitFor(() => expect(vi.mocked(localStorage.setItem).mock.calls.some(call => call[0] === 'commecs-chats-v2')).toBe(true));
    const saved = vi.mocked(localStorage.setItem).mock.calls.filter(call => call[0] === 'commecs-chats-v2').at(-1)?.[1];
    expect(saved).not.toContain('progress'); expect(saved).not.toContain('preparing');
    finish({ text: 'Answer' }); await task;
    store.getState().setRemember(false);
  });
  it('aborts deletion of the active chat and ignores a delayed phase', async () => {
    const finish = controlled(), task = chat.sendMessage('Question');
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('preparing'));
    store.getState().deleteChat(store.getState().activeId);
    expect(service.mock.calls[0][2]?.aborted).toBe(true);
    finish({ progress: { phase: 'checking' } }); await task;
    expect(store.getState().messages).toEqual([]); expect(store.getState().progress).toBeNull();
  });
  it('clears cancellation and rejects late chunks from the stopped stream', async () => {
    const finish = controlled(); const task = chat.sendMessage('Question');
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('preparing'));
    chat.stopResponse(); expect(store.getState().progress).toBeNull();
    finish({ text: 'Late answer' }); await task;
    expect(store.getState().messages[1].status).toBe('stopped'); expect(store.getState().messages[1].text).not.toContain('Late');
  });
  it('cancels a direct conversation switch and prevents old events from clearing a new request', async () => {
    const finishOld = controlled(), oldId = store.getState().activeId;
    const oldTask = chat.sendMessage('Old question');
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('preparing'));
    store.getState().newChat(); expect(service.mock.calls[0][2]?.aborted).toBe(true);
    const finishNew = controlled(), newTask = chat.sendMessage('New question');
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('preparing'));
    const newProgress = store.getState().progress;
    finishOld({ progress: { phase: 'checking' } }); await oldTask;
    expect(store.getState().progress).toEqual(newProgress);
    finishNew({ text: 'New answer' }); await newTask;
    expect(store.getState().messages.map(m => m.text)).toEqual(['New question', 'New answer']);
    store.getState().openChat(oldId); expect(store.getState().messages[1].status).toBe('stopped');
    expect(store.getState().progress).toBeNull();
  });
  it('starts fresh progress on regeneration and snapshots language preference', async () => {
    service.mockImplementationOnce(async function* () { yield { text: 'First answer' }; yield { finishReason: 'STOP' }; });
    await chat.sendMessage('Question'); const oldBot = store.getState().messages[1].id;
    store.getState().setPreferences({ language: 'roman' }); const finish = controlled();
    chat.retryMessage(oldBot);
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('preparing'));
    expect(store.getState().progress?.messageId).not.toBe(oldBot);
    expect(store.getState().progress?.language).toBe('roman');
    store.getState().setPreferences({ language: 'ur' });
    expect(store.getState().progress?.language).toBe('roman');
    finish({ text: 'Regenerated' }); await vi.waitFor(() => expect(store.getState().progress).toBeNull());
  });
  it('clears progress for saved-source fallback and infers Urdu in auto mode', async () => {
    store.getState().setPreferences({ language: 'auto' });
    const finish = controlled(), task = chat.sendMessage('فیس کتنی ہے؟');
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('preparing'));
    expect(store.getState().progress?.language).toBe('ur');
    finish({ text: 'Saved evidence', fallback: true, local: true }); await task;
    expect(store.getState().progress).toBeNull(); expect(store.getState().messages[1].fallback).toBe(true);
  });
});
