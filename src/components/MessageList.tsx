import { ArrowDown, Sparkles, BookOpenCheck } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useChat } from '../hooks/useChat';
import MessageBubble from './MessageBubble';
import QuickReplyChips from './QuickReplyChips';
import { getFollowUps } from '../lib/followUps';
import { resolveLanguage } from '../../shared/chat';
export default function MessageList() {
  const messages = useChatStore(s => s.messages);
  const activeId = useChatStore(s => s.activeId);
  const setDraft = useChatStore(s => s.setDraft);
  const language = useChatStore(s => s.preferences.language);
  const { retryMessage } = useChat();
  const last = messages.at(-1);
  const { scrollRef, handleScroll, isScrolledUp, scrollToBottom } = useAutoScroll(messages.length, last?.text.length || 0, activeId, `${last?.status}:${last?.sources?.length || 0}`);
  const busy = messages.some(m => ['sending','streaming'].includes(m.status));
  const choose = (text: string) => { setDraft(text); document.getElementById('question')?.focus(); };
  const question = messages.filter(m => m.role === 'user').at(-1)?.text || '';
  const followUps = getFollowUps(question, messages.at(-1)?.sources, language);
  return <div className="thread-wrap">
    <div ref={scrollRef} onScroll={handleScroll} className="thread-scroll" role="log" aria-label="Conversation" aria-live="polite" aria-busy={busy}>
      <div className="thread-content">
      {!messages.length ? <section className="welcome">
        <div className="welcome-badge"><Sparkles size={14} /> A little clarity for your next chapter</div>
        <div className="welcome-art" aria-hidden="true"><div className="art-orbit" /><div className="art-orbit second" /><BookOpenCheck size={52} strokeWidth={1.2} /><span className="art-star">✦</span></div>
        <h2>Your next chapter.<br /><em>Let’s figure it out.</em></h2>
        <p className="welcome-description">Assalam-o-Alaikum! I’m here to help you explore Commecs.<br className="desktop-break" /> Ask about admissions, programs, fees, or life at college.</p>
        <QuickReplyChips />
        <div className="try-prompt"><span>Not sure where to start?</span><button onClick={() => choose('Help me choose a program based on my interests.')}>Help me find my path <span aria-hidden="true">↗</span></button></div>
        <div className="welcome-foot"><BookOpenCheck size={16} /><span>Answers from college information. Sources when available.</span></div>
      </section> : <>
        <div className="conversation-heading">Your conversation with Commecs</div>
        {messages.map((msg, index) => <MessageBubble key={msg.id} message={msg} retryMessage={index === messages.length - 1 ? retryMessage : undefined} />)}
        {!busy && messages.at(-1)?.status === 'complete' && !messages.at(-1)?.fallback && <div className="follow-ups"><span>{resolveLanguage(question, language) === 'ur' ? 'مزید جانیں' : resolveLanguage(question, language) === 'roman' ? 'Mazeed janein' : 'Keep exploring'}</span>{followUps.map(s => <button key={s.question} onClick={() => choose(s.question)}>{s.label}</button>)}</div>}
      </>}
      </div>
    </div>
    {isScrolledUp && messages.length > 0 && <button className="scroll-bottom" onClick={scrollToBottom}><ArrowDown size={15} /> Latest reply</button>}
  </div>;
}
