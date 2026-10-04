import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, RefreshCcw, ThumbsUp, ThumbsDown, Mail, Phone, MessageCircle } from 'lucide-react';
import type { ChatMessage } from '../types/chat';
import { useChatStore } from '../store/useChatStore';
import TypingIndicator from './TypingIndicator';
import { resolveLanguage, safeSourceUrl } from '../../shared/chat';
import SourceCards from './SourceCards';
import { selectAnswerSources } from '../../shared/answerSources';
export default function MessageBubble({ message, retryMessage }: { message: ChatMessage; retryMessage?: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const setMessages = useChatStore(s => s.setMessages);
  const progress = useChatStore(s => s.progress?.messageId === message.id && s.progress.conversationId === s.activeId ? s.progress : null);
  const languagePreference = useChatStore(s => s.preferences.language);
  const user = message.role === 'user';
  const waiting = !user && ['sending','streaming'].includes(message.status) && !message.text;
  const busy = ['sending','streaming'].includes(message.status);
  const incomplete = message.status === 'stopped' || message.status === 'error' || (message.finishReason && message.finishReason !== 'STOP');
  const sources = selectAnswerSources(message.text, message.sources || []);
  async function copy() {
    try { await navigator.clipboard.writeText(message.text + (sources.length ? '\n\nSources:\n' + sources.map(s => s.title + ': ' + s.url).join('\n') : '')); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  const feedback = (value: 'up' | 'down') => setMessages(messages => messages.map(m => m.id === message.id ? { ...m, feedback: m.feedback === value ? undefined : value } : m));
  const whatsapp = message.contact?.whatsapp.replace(/\D/g, '').replace(/^0/, '92');
  const phone = message.contact?.landline.split('-').slice(0, 2).join('').replace(/\D/g, '').replace(/^0/, '92');
  return <article className={'message ' + (user ? 'user-message' : 'assistant-message')}>
    {!user && <div className="message-label"><span className="assistant-avatar">C</span><strong>Commecs Assistant</strong><span className="answer-mode" title={message.verifiedAt ? "Reviewed " + new Date(message.verifiedAt).toLocaleDateString() : undefined}>{message.local ? 'Saved college information' : message.fallback ? 'Service update' : message.mode === 'verified' ? 'Reviewed answer' : message.cached ? 'Saved answer' : message.mode === 'thinking' ? 'Thoughtful answer' : 'College guide'}</span></div>}
    {waiting ? <TypingIndicator progress={progress} /> : <div className={'message-text ' + (incomplete ? 'incomplete' : '')} dir="auto">
      {user ? <p>{message.text}</p> : <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        a: ({ href, children }) => href && safeSourceUrl(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
        table: ({ children }) => <div className="table-scroll"><table>{children}</table></div>,
      }}>{message.text}</ReactMarkdown>}
    </div>}
    {!user && sources.length > 0 && !busy && <SourceCards sources={sources} language={resolveLanguage(message.text, languagePreference)} />}
    {!user && !busy && !incomplete && !message.fallback && !sources.length && <p className="incomplete-note">No college source was attached. Confirm college-specific details with admissions.</p>}
    {message.contact && <div className="contact-card"><strong>Talk to admissions</strong><a href={'tel:+' + phone}><Phone size={15} />{message.contact.landline}</a><a href={'https://wa.me/' + whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp admissions</a><a href={'mailto:' + message.contact.email}><Mail size={15} />{message.contact.email}</a></div>}
    {!user && !busy && <div className="message-actions">
      <button onClick={() => void copy()} aria-label="Copy answer">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button>
      <button onClick={() => feedback('up')} aria-label="Mark answer helpful (saved locally)" aria-pressed={message.feedback === 'up'}><ThumbsUp size={14} /></button>
      <button onClick={() => feedback('down')} aria-label="Mark answer unhelpful (saved locally)" aria-pressed={message.feedback === 'down'}><ThumbsDown size={14} /></button>
      {retryMessage && <button onClick={() => retryMessage(message.id)}><RefreshCcw size={14} />{incomplete || message.fallback ? 'Try again' : 'Regenerate'}</button>}
      {message.feedback && <span className="action-note">Feedback kept on this device</span>}
      {copyError && <span role="status">Select the answer text to copy it.</span>}
    </div>}
    {!user && incomplete && <p className="incomplete-note" role="status">{message.finishReason === 'MAX_TOKENS' ? 'This reply reached its length limit. Ask a narrower follow-up for the rest.' : message.status === 'stopped' ? 'You stopped this reply.' : 'This reply is incomplete. Try again to get a full answer.'}</p>}
  </article>;
}
