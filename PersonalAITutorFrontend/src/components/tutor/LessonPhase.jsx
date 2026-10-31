import { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { getLessonContent, askLessonQuestion } from '../../api/tutorApi';
import MermaidViewer from './MermaidViewer';
import TaskPhase from './TaskPhase';

const mono = { fontFamily: "'Geist Mono', 'JetBrains Mono', monospace" };

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button onClick={copy}
            className="text-[9px] uppercase tracking-wider transition-colors px-2 py-1 rounded border border-[#2e303e] bg-[#0e1117] cursor-pointer"
            style={{ ...mono, color: copied ? '#10b981' : '#c9d1d9' }}>
            {copied ? 'Copied!' : 'Copy'}
        </button>
    );
}

function LessonSkeleton() {
    return (
        <div className="min-h-screen bg-[#0e1117] flex flex-col items-center justify-center gap-4 text-zinc-300">
            <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
                <div className="absolute inset-0 rounded-full border-2 border-t-[#00f0ff] animate-spin" />
            </div>
            <div className="text-center">
                <p className="text-zinc-400 text-sm font-semibold">Generating curriculum...</p>
                <p className="text-zinc-600 text-xs mt-1" style={mono}>loading custom workspace details</p>
            </div>
        </div>
    );
}

export default function LessonPhase({ goalId, dayNumber, onBack, onComplete }) {
    const [lessonData, setLessonData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showTask, setShowTask] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const [readProgress, setReadProgress] = useState(0);
    const mainRef = useRef(null);

    // Chatbot States
    const [chatOpen, setChatOpen] = useState(true);
    const [chatMessages, setChatMessages] = useState([
        { sender: 'ai', text: "Hello! I am your AI study mentor for this lesson. Ask me any questions about the concepts, code examples, or terms covered here." }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        getLessonContent(goalId, dayNumber)
            .then(res => {
                const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                setLessonData(data);
            })
            .catch(err => {
                console.error('Failed to load lesson:', err);
                setError('Failed to load lesson. Please try again.');
            })
            .finally(() => setLoading(false));
    }, [goalId, dayNumber]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [goalId, dayNumber]);

    useEffect(() => {
        const handleScroll = () => {
            const el = document.documentElement;
            const scrolled = el.scrollTop;
            const total = el.scrollHeight - el.clientHeight;
            setReadProgress(total > 0 ? Math.round((scrolled / total) * 100) : 0);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!lessonData) return;
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) setActiveSection(entry.target.id);
                });
            },
            { rootMargin: '-10% 0px -80% 0px' }
        );
        setTimeout(() => {
            document.querySelectorAll('h2[id]').forEach(el => observer.observe(el));
        }, 150);
        return () => observer.disconnect();
    }, [lessonData, showTask]);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || chatLoading) return;

        const userText = inputMessage;
        setInputMessage('');
        setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
        setChatLoading(true);

        try {
            const res = await askLessonQuestion(userText, lessonData.title, lessonData.content || lessonData.lesson);
            const reply = res.data?.response || "I couldn't get a response. Please try again.";
            setChatMessages(prev => [...prev, { sender: 'ai', text: reply }]);
        } catch (err) {
            console.error("Chat request failed:", err);
            setChatMessages(prev => [...prev, { sender: 'ai', text: "Error connecting to AI mentor. Please try again." }]);
        } finally {
            setChatLoading(false);
        }
    };

    const markdownComponents = useMemo(() => ({
        h1: ({ children }) => (
            <h1 className="text-3xl font-extrabold text-white mb-6 mt-0 tracking-tight">
                {children}
            </h1>
        ),
        h2: ({ children, id }) => (
            <h2 id={id}
                className="text-xl font-bold text-white mt-12 mb-4 pb-2 border-b border-[#2e303e]">
                {children}
            </h2>
        ),
        h3: ({ children }) => (
            <h3 className="text-base font-semibold text-zinc-200 mt-8 mb-2">{children}</h3>
        ),
        p: ({ children }) => (
            <p className="text-zinc-400 leading-[1.75] mb-4 text-[14px]">{children}</p>
        ),
        ul: ({ children }) => (
            <ul className="mb-5 space-y-2 ml-1">{children}</ul>
        ),
        li: ({ children }) => (
            <li className="flex items-start gap-2.5 text-[14px] text-zinc-400">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#00f0ff] shrink-0" />
                <span className="leading-[1.7]">{children}</span>
            </li>
        ),
        ol: ({ children }) => (
            <ol className="mb-5 space-y-2 list-decimal list-inside text-zinc-400 text-[14px]">{children}</ol>
        ),
        strong: ({ children }) => (
            <strong className="text-white font-semibold">{children}</strong>
        ),
        blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#00f0ff] bg-[#1c1e26] px-5 py-3 rounded my-6 text-zinc-400 text-sm italic">
                {children}
            </blockquote>
        ),
        table: ({ children }) => (
            <div className="overflow-x-auto my-6 border border-[#2e303e] rounded">
                <table className="w-full text-xs border-collapse">{children}</table>
            </div>
        ),
        th: ({ children }) => (
            <th className="px-4 py-2 text-left font-bold text-zinc-400 uppercase tracking-wider border-b border-[#2e303e] bg-[#1c1e26]"
                style={mono}>{children}</th>
        ),
        td: ({ children }) => (
            <td className="px-4 py-2.5 text-zinc-400 border-b border-[#2e303e]/40">{children}</td>
        ),
        code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');

            const extractText = (children) => {
                if (Array.isArray(children)) {
                    return children.map(child => typeof child === 'string' ? child : extractText(child.props.children)).join('');
                }
                return String(children);
            };

            const codeStr = extractText(children).replace(/\n$/, '');

            if (match && match[1] === 'mermaid') {
                if (!codeStr || codeStr.length < 5) return null;
                return <MermaidViewer chart={codeStr} />;
            }

            if (!inline && match) {
                return (
                    <div className="rounded overflow-hidden my-6 border border-[#2e303e]">
                        <div className="flex items-center justify-between px-4 py-2 bg-[#1c1e26] border-b border-[#2e303e]">
                            <span className="text-[9px] text-[#00f0ff] uppercase tracking-wider font-bold" style={mono}>
                                {match[1]}
                            </span>
                            <CopyButton text={codeStr} />
                        </div>

                        <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{
                                margin: 0,
                                padding: '1rem',
                                background: '#0e1117',
                                fontSize: '13px',
                                fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                                lineHeight: '1.5'
                            }}
                        >
                            {codeStr}
                        </SyntaxHighlighter>
                    </div>
                );
            }

            return (
                <code className="px-1.5 py-0.5 rounded text-[12px] text-[#00f0ff] bg-[#1c1e26] border border-[#2e303e]" style={mono}>
                    {children}
                </code>
            );
        }
    }), []);

    if (loading) return <LessonSkeleton />;

    if (error) {
        return (
            <div className="min-h-screen bg-[#0e1117] flex items-center justify-center p-6 text-zinc-300">
                <div className="text-center max-w-md">
                    <div className="w-12 h-12 rounded border border-rose-500/20 bg-rose-500/5 flex items-center justify-center mx-auto mb-4">
                        <span className="text-rose-400 text-xl font-bold">!</span>
                    </div>
                    <h2 className="text-zinc-200 font-semibold mb-2">Lesson unavailable</h2>
                    <p className="text-zinc-500 text-sm mb-6">{error}</p>
                    <button onClick={onBack}
                        className="replit-btn-secondary px-6 py-2.5 text-xs uppercase tracking-wider replit-font-mono cursor-pointer">
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    if (showTask) {
        return (
            <TaskPhase
                taskType={lessonData.taskType}
                taskData={lessonData.taskData}
                onSuccess={() => {
                    onComplete(goalId, dayNumber);
                }}
                onBack={() => setShowTask(false)}
            />
        );
    }

    const subTopics = lessonData.subTopics || lessonData.sub_topics || [];
    const markdownContent = lessonData.content || lessonData.lesson || '';

    return (
        <div className="min-h-screen bg-[#0e1117] text-zinc-300 flex flex-col">
            {/* Read progress bar */}
            <div className="fixed top-0 left-0 z-[60] h-1 bg-[#2e303e] w-full pointer-events-none">
                <div className="h-full transition-all duration-150"
                    style={{ width: `${readProgress}%`, background: '#00f0ff' }} />
            </div>

            {/* Sticky header */}
            <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[#2e303e] bg-[#1c1e26] px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack}
                        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors text-xs uppercase replit-font-mono cursor-pointer">
                        ← Roadmap
                    </button>
                    <span className="text-[#2e303e]">|</span>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500" style={mono}>Day {dayNumber}</span>
                        <span className="text-[#2e303e]">/</span>
                        <span className="font-semibold text-white truncate max-w-[300px]">
                            {lessonData.title}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setChatOpen(!chatOpen)}
                        className="replit-btn-secondary px-4 py-2 text-xs uppercase tracking-wider replit-font-mono cursor-pointer flex items-center gap-2"
                    >
                        <span className={`w-1.5 h-1.5 rounded-full transition-colors ${chatOpen ? 'bg-[#00f0ff]' : 'bg-zinc-600'}`} />
                        AI Mentor
                    </button>
                    <button
                        onClick={() => setShowTask(true)}
                        className="replit-btn-primary px-4 py-2 text-xs uppercase tracking-wider replit-font-mono cursor-pointer"
                    >
                        Take Assessment
                    </button>
                </div>
            </header>

            {/* Layout Wrapper */}
            <div className="flex-1 flex max-w-[1600px] mx-auto w-full relative">
                {/* Left TOC Sidebar */}
                <aside className="hidden xl:flex w-60 shrink-0 flex-col py-10 pl-6 pr-4 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-4 pl-3" style={mono}>
                        On this page
                    </p>
                    <nav className="flex flex-col border-l border-[#2e303e] space-y-0.5">
                        {subTopics.map((topic, i) => {
                            const id = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                            const isActive = activeSection === id;
                            return (
                                <button key={i}
                                    onClick={() => scrollToSection(id)}
                                    className="relative text-left px-3 py-2 text-xs transition-all cursor-pointer"
                                    style={{ color: isActive ? '#00f0ff' : '#6b7280' }}>
                                    {isActive && (
                                        <div className="absolute left-[-1.5px] top-1.5 bottom-1.5 w-[2px] bg-[#00f0ff]" />
                                    )}
                                    {topic}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main article content column */}
                <main ref={mainRef} className="flex-1 min-w-0 px-6 md:px-12 py-10 lg:py-14">
                    <article className="max-w-[760px] mx-auto">
                        {lessonData.isFallback && (
                            <div className="mb-8 p-5 rounded border border-amber-500/20 bg-amber-500/5 flex items-start gap-4">
                                <div className="w-10 h-10 rounded border border-amber-500/20 bg-[#0e1117] flex items-center justify-center shrink-0">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-amber-400 font-bold text-sm">
                                        AI Generation Delayed
                                    </h3>
                                    <p className="text-zinc-500 text-xs mt-1.5 leading-[1.6]">
                                        The AI service is temporarily unavailable. We are showing cached overview topics so you can continue your progress. Try refreshing the page later for the fully detailed lesson.
                                    </p>
                                </div>
                            </div>
                        )}

                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeSlug]}
                            components={markdownComponents}
                        >
                            {markdownContent}
                        </ReactMarkdown>

                        {/* Bottom card */}
                        <div className="mt-16 pt-8 border-t border-[#2e303e]">
                            <div className="rounded border border-[#2e303e] bg-[#1c1e26] p-8">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded border border-[#2e303e] bg-[#0e1117] flex items-center justify-center shrink-0">
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#00f0ff]" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[9px] text-[#00f0ff] font-semibold uppercase tracking-wider mb-2.5" style={mono}>
                                            Up Next
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1">
                                            Knowledge Check
                                        </h3>
                                        <p className="text-zinc-500 text-xs mb-4">
                                            Apply what you've studied. Complete the assessment task to unlock the next day.
                                        </p>
                                        <button
                                            onClick={() => setShowTask(true)}
                                            className="replit-btn-primary px-6 py-2.5 text-xs uppercase tracking-wider replit-font-mono cursor-pointer"
                                        >
                                            Start Assessment
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                </main>

                {/* Right Chat Panel Sidebar */}
                {chatOpen && (
                    <aside className="w-80 border-l border-[#2e303e] bg-[#1c1e26] shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
                        {/* Panel Header */}
                        <div className="p-4 border-b border-[#2e303e] flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#00f0ff]" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider replit-font-mono">AI Mentor Chat</span>
                            </div>
                            <button
                                onClick={() => setChatOpen(false)}
                                className="text-zinc-500 hover:text-white text-xs cursor-pointer replit-font-mono"
                            >
                                [x] Close
                            </button>
                        </div>

                        {/* Message Log */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1.5 replit-font-mono">
                                        {msg.sender === 'user' ? 'Student' : 'AI Assistant'}
                                    </div>
                                    <div className={`p-3 rounded text-xs leading-relaxed max-w-[90%] border ${
                                        msg.sender === 'user'
                                            ? 'bg-[#0e1117] border-[#2e303e] text-zinc-200'
                                            : 'bg-[#0e1117] border-[#00f0ff]/30 text-zinc-300'
                                    }`}>
                                        {msg.sender === 'ai' ? (
                                            <ReactMarkdown
                                                components={{
                                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                    code: ({ children }) => <code className="px-1 py-0.5 rounded bg-[#1c1e26] border border-[#2e303e] text-[#00f0ff]" style={mono}>{children}</code>
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                </div>
                            ))}

                            {chatLoading && (
                                <div className="flex flex-col items-start">
                                    <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1.5 replit-font-mono">
                                        AI Assistant
                                    </div>
                                    <div className="p-3.5 rounded border border-[#00f0ff]/20 bg-[#0e1117] text-zinc-400 text-xs flex items-center gap-2">
                                        <svg className="animate-spin w-3.5 h-3.5 text-[#00f0ff]" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        <span>Formulating explanation...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Footer Form */}
                        <form onSubmit={handleSendMessage} className="p-3 border-t border-[#2e303e] bg-[#0e1117] shrink-0">
                            <div className="flex gap-2">
                                <input
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="Ask anything about today's lesson..."
                                    className="flex-1 replit-input px-3 py-2 text-xs"
                                    disabled={chatLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputMessage.trim() || chatLoading}
                                    className="replit-btn-primary px-3 py-2 text-xs uppercase tracking-wider replit-font-mono cursor-pointer disabled:opacity-40"
                                >
                                    Send
                                </button>
                            </div>
                        </form>
                    </aside>
                )}
            </div>
        </div>
    );
}