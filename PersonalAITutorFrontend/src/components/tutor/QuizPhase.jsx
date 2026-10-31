import { useState } from 'react';

export default function QuizPhase({ quizData, userAnswers, setUserAnswers, onFinish, loading }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [animating, setAnimating] = useState(false);

    const q = quizData.quiz[currentIndex];
    const isLast = currentIndex === quizData.quiz.length - 1;
    const answered = !!userAnswers[q.id];
    const progress = ((currentIndex + 1) / quizData.quiz.length) * 100;

    const difficultyConfig = {
        easy: { color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', label: 'Easy' },
        medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', label: 'Medium' },
        hard: { color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', label: 'Hard' },
    };
    const diff = difficultyConfig[q.difficulty?.toLowerCase()] || difficultyConfig.easy;

    const handleNext = () => {
        if (animating) return;
        setAnimating(true);
        setTimeout(() => {
            if (isLast) onFinish();
            else setCurrentIndex(i => i + 1);
            setAnimating(false);
        }, 200);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0e1117] p-6 text-zinc-300">
            <div className="relative w-full max-w-2xl">
                {/* Top bar */}
                <div className="flex items-center justify-between mb-4">
                    <div style={{ fontFamily: "'Geist Mono', monospace" }} className="text-xs text-zinc-500">
                        QUESTION {String(currentIndex + 1).padStart(2, '0')} / {String(quizData.quiz.length).padStart(2, '0')}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded border font-semibold replit-font-mono"
                            style={{ color: diff.color, background: diff.bg, borderColor: diff.border }}>
                            {diff.label}
                        </span>
                        <span className="text-[10px] text-zinc-400 border border-[#2e303e] px-2 py-0.5 rounded replit-font-mono bg-[#1c1e26]">
                            {q.concept}
                        </span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-[#2e303e] rounded mb-6 overflow-hidden">
                    <div className="h-full rounded transition-all duration-300"
                        style={{ width: `${progress}%`, background: '#00f0ff' }} />
                </div>

                {/* Question card */}
                <div className="rounded border border-[#2e303e] bg-[#1c1e26] overflow-hidden"
                    style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateY(4px)' : 'translateY(0)', transition: 'all 0.15s ease' }}>
                    <div className="p-8">
                        <h2 className="text-lg font-bold text-white leading-relaxed mb-6">
                            {q.question}
                        </h2>

                        <div className="space-y-2.5">
                            {Object.entries(q.options).map(([key, val]) => {
                                const isSelected = userAnswers[q.id] === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setUserAnswers({ ...userAnswers, [q.id]: key })}
                                        className="w-full text-left rounded p-3.5 transition-all duration-150 flex items-center gap-4 group cursor-pointer"
                                        style={{
                                            background: isSelected ? 'rgba(0,240,255,0.06)' : '#0e1117',
                                            border: `1px solid ${isSelected ? '#00f0ff' : '#2e303e'}`,
                                        }}>
                                        <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                                            style={{
                                                fontFamily: "'Geist Mono', monospace",
                                                background: isSelected ? '#00f0ff' : '#2e303e',
                                                color: isSelected ? '#0e1117' : '#c9d1d9',
                                            }}>
                                            {key}
                                        </span>
                                        <span className="text-sm font-medium" style={{ color: isSelected ? '#e0e7ff' : '#c9d1d9' }}>
                                            {val}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="px-8 pb-8 flex justify-between items-center">
                        <div className="flex gap-1.5">
                            {quizData.quiz.map((_, i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded transition-all"
                                    style={{
                                        background: i < currentIndex ? '#0f62fe' : i === currentIndex ? '#00f0ff' : '#2e303e',
                                    }} />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={!answered || loading}
                            className="replit-btn-primary px-6 py-2.5 text-xs uppercase tracking-wider replit-font-mono cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-1.5">
                                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Analyzing...
                                </span>
                            ) : (
                                <span>{isLast ? 'Analyze Results →' : 'Next Question →'}</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}