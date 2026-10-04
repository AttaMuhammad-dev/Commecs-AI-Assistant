import { ArrowUpRight, BookOpen, ClipboardList, Wallet, Compass } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useChatStore } from '../store/useChatStore';
const prompts = [
  { title: 'Find your program', subtitle: 'Explore subjects and possibilities', question: 'Programs offered', icon: BookOpen },
  { title: 'Plan your admission', subtitle: 'The process, from start to finish', question: 'How to apply', icon: ClipboardList },
  { title: 'Understand the costs', subtitle: 'Fees, scholarships and support', question: 'Fees & scholarships', icon: Wallet },
  { title: 'Get to know Commecs', subtitle: 'Campus life, clubs and facilities', question: 'What facilities and student activities does Commecs offer?', icon: Compass },
];
export default function QuickReplyChips() {
  const { sendMessage } = useChat();
  const disabled = useChatStore(s => s.isOffline || s.messages.some(m => ['sending','streaming'].includes(m.status)));
  return <div className="starter-grid">{prompts.map(({ title, subtitle, question, icon: Icon }) => <button className="starter-card" key={title} disabled={disabled} onClick={() => void sendMessage(question)}><span className="starter-icon"><Icon size={20} /></span><ArrowUpRight size={17} className="starter-arrow" /><strong>{title}</strong><span>{subtitle}</span></button>)}</div>;
}
