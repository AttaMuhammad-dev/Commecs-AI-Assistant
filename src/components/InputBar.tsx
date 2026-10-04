import { useRef, useEffect, type KeyboardEvent } from 'react';
import { ArrowUp, Square, Globe2, SlidersHorizontal } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useChatStore } from '../store/useChatStore';
import { MAX_MESSAGE_LENGTH, type Language, type ResponseStyle } from '../../shared/chat';
export default function InputBar() {
  const state = useChatStore();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, stopResponse } = useChat();
  const busy = state.messages.some(m => ['sending','streaming'].includes(m.status));
  const send = () => {
    if (!state.draft.trim() || state.draft.length > MAX_MESSAGE_LENGTH || busy || state.isOffline) return;
    void sendMessage(state.draft); state.setDraft('');
  };
  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = 'auto';
    textarea.current.style.height = Math.min(textarea.current.scrollHeight, 130) + 'px';
  }, [state.draft]);
  const keydown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
  };
  return <footer className="composer-area"><div className="composer-inner">
    <div className="composer-options">
      <label><Globe2 size={14} /><span className="sr-only">Reply language</span><select aria-label="Reply language" value={state.preferences.language} disabled={busy} onChange={e => state.setPreferences({ language: e.target.value as Language })}><option value="auto">Auto language</option><option value="en">English</option><option value="ur">اردو</option><option value="roman">Roman Urdu</option></select></label>
      <label><SlidersHorizontal size={14} /><span className="sr-only">Answer length</span><select aria-label="Answer length" value={state.preferences.responseStyle} disabled={busy} onChange={e => state.setPreferences({ responseStyle: e.target.value as ResponseStyle })}><option value="concise">Concise answers</option><option value="detailed">Detailed answers</option></select></label>
      <span className="smart-routing"><span /> Thoughtful when it matters</span>
    </div>
    <div className="composer-box"><textarea id="question" ref={textarea} value={state.draft} onChange={e => state.setDraft(e.target.value)} onKeyDown={keydown} maxLength={MAX_MESSAGE_LENGTH} rows={1} dir="auto" aria-label="Ask Commecs a question" aria-describedby="composer-help" placeholder={state.isOffline ? 'You’re offline. Draft a question for later…' : 'Ask a question, or describe what you need help with…'} />
      {busy ? <button className="send-button stop-button" onClick={stopResponse} aria-label="Stop response"><Square size={17} fill="currentColor" /></button> : <button className="send-button" onClick={send} disabled={!state.draft.trim() || state.draft.length > MAX_MESSAGE_LENGTH || state.isOffline} aria-label="Send message"><ArrowUp size={21} /></button>}
    </div>
    <div className="composer-caption" id="composer-help"><span>Confirm time-sensitive details with admissions.</span><span>{state.draft.length > 450 ? state.draft.length + ' / 600' : 'Enter to send · Shift + Enter for a new line'}</span></div>
  </div></footer>;
}
