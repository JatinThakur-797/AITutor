import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, LoaderCircle, Send, Sparkles, StopCircle, Wifi, WifiOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { learningApi } from '../api/learning';
import { getErrorMessage } from '../api/client';
import { Button } from './UI';

export default function MentorChat({ lessonTitle, lessonContent }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi! I have this lesson as context. Ask me to explain a concept, walk through an example, or help you reason about the code.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(Boolean(import.meta.env.VITE_ENABLE_CHAT_STREAMING === 'true'));
  const [error, setError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput(''); setError(''); setLoading(true);
    const payload = { message: text, lessonTitle, lessonContent: (lessonContent || '').slice(0, 20000) };
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    try {
      if (streaming) {
        const controller = new AbortController(); abortRef.current = controller;
        await learningApi.streamMentor(payload, {
          signal: controller.signal,
          onToken: (token) => setMessages((prev) => {
            const copy = [...prev]; const last = copy.length - 1;
            if (copy[last]?.role === 'assistant') copy[last] = { ...copy[last], content: copy[last].content + token };
            return copy;
          }),
        });
      } else {
        const result = await learningApi.askMentor(payload);
        const answer = result?.response || 'The mentor returned an empty response. Please try again.';
        setMessages((prev) => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: answer }; return copy; });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages((prev) => { const copy = [...prev]; const i = copy.length - 1; if (copy[i]?.role === 'assistant') copy[i] = { ...copy[i], content: `${copy[i].content}\n\n*Response stopped.*` }; return copy; });
      } else {
        const message = getErrorMessage(err, 'The mentor could not respond.');
        setError(message);
        setMessages((prev) => { const copy = [...prev]; const i = copy.length - 1; if (copy[i]?.role === 'assistant') copy[i] = { ...copy[i], content: copy[i].content || 'I could not complete that response. Please try again.' }; return copy; });
      }
    } finally { abortRef.current = null; setLoading(false); }
  };

  return <section className={`mentor-panel ${minimized ? 'mentor-minimized' : ''}`}>
    <div className="mentor-header"><div className="mentor-avatar"><Bot size={18} /></div><div className="mentor-header-copy"><strong>AI study mentor</strong><span><i /> Lesson-aware assistant</span></div><button className="icon-btn" onClick={() => setMinimized((v) => !v)} title={minimized ? 'Expand chat' : 'Minimize chat'}><ChevronDown size={18} /></button></div>
    {!minimized ? <>
      <div className="mentor-context"><Sparkles size={14} /><span>Context: <strong>{lessonTitle || 'Current lesson'}</strong></span></div>
      <div className="mentor-messages">
        {messages.map((message, index) => <div className={`mentor-message ${message.role}`} key={`${message.role}-${index}`}><div className="message-label">{message.role === 'user' ? 'YOU' : 'PATHAI MENTOR'}</div><div className="message-bubble">{message.role === 'assistant' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || (loading && index === messages.length - 1 ? ' ' : '')}</ReactMarkdown> : message.content}</div></div>)}
        {loading && !messages[messages.length - 1]?.content ? <div className="mentor-thinking"><LoaderCircle size={14} className="spin" /> Thinking through your question…</div> : null}
        <div ref={bottomRef} />
      </div>
      {error ? <div className="mentor-error">{error}</div> : null}
      <form className="mentor-form" onSubmit={send}><textarea rows="2" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this lesson…" disabled={loading} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} /><div className="mentor-form-bottom"><span>Enter to send · Shift + Enter for new line</span>{loading ? <Button type="button" variant="danger" size="sm" onClick={() => abortRef.current?.abort()}><StopCircle size={14} /> Stop</Button> : <Button type="submit" size="sm" disabled={!input.trim()}><Send size={14} /> Send</Button>}</div></form>
    </> : null}
  </section>;
}
