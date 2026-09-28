export default function TypingIndicator({ mode = 'fast' }: { mode?: 'fast' | 'thinking' | 'verified' }) {
  return <div className="typing" role="status"><span className="typing-dots"><i /><i /><i /></span>{mode === 'thinking' ? 'Working through your question…' : mode === 'verified' ? 'Preparing a reviewed answer…' : 'Checking college information…'}</div>;
}