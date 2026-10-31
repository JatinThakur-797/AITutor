import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function TaskPhase({ taskType, taskData, onSuccess, onBack }) {
    const [selectedOpt, setSelectedOpt] = useState('');
    const [error, setError] = useState(false);

    const checkAnswer = () => {
        if (taskType === 'QUIZ') {
            if (selectedOpt === taskData.correct) onSuccess();
            else setError(true);
        } else {
            onSuccess();
        }
    };

    return (
        <div className="min-h-screen bg-[#0e1117] text-white flex flex-col items-center justify-center p-6">
            <div className="max-w-2xl w-full bg-[#1c1e26] border border-[#2e303e] rounded p-8">
                <button onClick={onBack} className="text-zinc-500 hover:text-zinc-200 mb-6 flex items-center gap-2 transition-colors text-xs uppercase replit-font-mono cursor-pointer">
                    <ArrowLeft size={14} /> Back to Lesson
                </button>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-[#00f0ff]/20 bg-[#00f0ff]/5 mb-6">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
                    <span className="text-[10px] text-[#00f0ff] font-semibold tracking-wider uppercase replit-font-mono">KNOWLEDGE CHECK</span>
                </div>

                {taskType === 'QUIZ' && (
                    <div>
                        <h2 className="text-lg font-bold mb-6 text-zinc-100">{taskData?.question}</h2>
                        <div className="space-y-2.5">
                            {taskData?.options && Object.entries(taskData.options).map(([key, val]) => (
                                <button key={key} onClick={() => { setSelectedOpt(key); setError(false); }}
                                    className={`w-full text-left p-4 rounded border transition-all flex items-center gap-4 cursor-pointer ${
                                        selectedOpt === key 
                                            ? 'border-[#00f0ff] bg-[#00f0ff]/5' 
                                            : 'border-[#2e303e] bg-[#0e1117] hover:border-zinc-600'
                                    }`}>
                                    <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                                        style={{
                                            fontFamily: "'Geist Mono', monospace",
                                            background: selectedOpt === key ? '#00f0ff' : '#2e303e',
                                            color: selectedOpt === key ? '#0e1117' : '#c9d1d9',
                                        }}>
                                        {key}
                                    </span>
                                    <span className="text-sm font-medium text-zinc-300">{val}</span>
                                </button>
                            ))}
                        </div>
                        {error && <p className="text-rose-400 mt-4 text-xs font-semibold replit-font-mono">Incorrect answer. Review the lesson details and try again!</p>}
                    </div>
                )}

                {taskType !== 'QUIZ' && (
                    <div>
                        <h2 className="text-lg font-bold mb-3 text-zinc-100">Practice Task</h2>
                        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{taskData?.problem || taskData?.instructions}</p>
                        {taskData?.starter_code && (
                            <div className="bg-[#0e1117] p-5 rounded border border-[#2e303e] font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed mb-4">
                                {taskData.starter_code}
                            </div>
                        )}
                        <p className="text-xs text-zinc-500 replit-font-mono">Implement the solution in your local IDE, then submit below to complete this day.</p>
                    </div>
                )}

                <button
                    onClick={checkAnswer}
                    disabled={taskType === 'QUIZ' && !selectedOpt}
                    className="w-full mt-8 replit-btn-primary py-3 text-xs uppercase tracking-wider replit-font-mono flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                    <CheckCircle2 size={16} /> Submit & Complete Day
                </button>
            </div>
        </div>
    );
}