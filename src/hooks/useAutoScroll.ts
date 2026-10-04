import { useEffect, useRef, useState, type UIEvent } from 'react';
export function useAutoScroll(messageCount: number, lastMessageLength = 0, conversationId = '', layoutKey = '') {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const previous = useRef({ count: messageCount, conversationId });
  const handleScroll = (event: UIEvent<HTMLDivElement>) => { const el = event.currentTarget; setIsScrolledUp(el.scrollHeight - el.scrollTop - el.clientHeight > 100); };
  const scrollToBottom = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; setIsScrolledUp(false); };
  useEffect(() => {
    const force = previous.current.conversationId !== conversationId || messageCount > previous.current.count;
    previous.current = { count: messageCount, conversationId };
    if (messageCount === 0) { if (scrollRef.current) scrollRef.current.scrollTop = 0; setIsScrolledUp(false); } else if (force || !isScrolledUp) scrollToBottom();
  }, [messageCount, lastMessageLength, conversationId, layoutKey, isScrolledUp]);
  return { scrollRef, handleScroll, isScrolledUp, scrollToBottom };
}
