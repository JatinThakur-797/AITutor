export default function FeasibilityPhase({ feasibility, report, totalQuestions, onGenerate, loading }) {
    const feasible = feasibility?.isFeasible;
    const scorePercent = Math.round((report.score / totalQuestions) * 100);

    const outcomeConfig = {
        'foundation': { label: 'Foundation Level', color: '#f59e0b', desc: 'Strong basics, ready to build' },
        'intermediate': { label: 'Intermediate Level', color: '#0f62fe', desc: 'Real-world ready skills' },
        'job-ready': { label: 'Job Ready', color: '#10b981', desc: 'Production-grade proficiency' },
    };
    const outcome = outcomeConfig[feasibility?.expectedOutcome] || outcomeConfig['foundation'];

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0e1117] p-6 text-zinc-300">
            <div className="relative w-full max-w-xl">
                {/* Score pill */}
                <div className="flex justify-center mb-6">
                    <div className="flex items-center gap-3 px-4 py-1.5 rounded border border-[#2e303e] bg-[#1c1e26]">
                        <div className="w-2 h-2 rounded-full" style={{ background: scorePercent >= 70 ? '#10b981' : scorePercent >= 40 ? '#f59e0b' : '#ef4444' }} />
                        <span style={{ fontFamily: "'Geist Mono', monospace" }} className="text-xs text-zinc-500">
                            Score: <span className="text-white font-medium">{report.score}/{totalQuestions}</span>
                        </span>
                        <span className="w-px h-3 bg-[#2e303e]" />
                        <span className="text-xs text-zinc-500">
                            Level: <span className="font-medium text-[#00f0ff]">{report.assignedLevel}</span>
                        </span>
                    </div>
                </div>

                {/* Main verdict card */}
                <div className="rounded border bg-[#1c1e26]"
                    style={{ borderColor: '#2e303e' }}>

                    <div className="p-8">
                        {/* Verdict icon */}
                        <div className="w-12 h-12 rounded border border-[#2e303e] bg-[#0e1117] flex items-center justify-center mb-6">
                            {feasible ? (
                                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#10b981]" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" />
                                    <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#f59e0b]" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            )}
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
                            {feasible ? 'Goal is Achievable' : 'Timeline Adjustment Required'}
                        </h1>
                        <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                            {feasibility?.reason}
                        </p>

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="rounded p-4 border border-[#2e303e] bg-[#0e1117]">
                                <p style={{ fontFamily: "'Geist Mono', monospace" }} className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2">Est. Days Required</p>
                                <p className="text-2xl font-bold text-white">{feasibility?.estimatedDaysRequired}</p>
                                <p className="text-[10px] text-zinc-500 mt-1 replit-font-mono">days of study</p>
                            </div>
                            <div className="rounded p-4 border border-[#2e303e] bg-[#0e1117]">
                                <p style={{ fontFamily: "'Geist Mono', monospace" }} className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2">Expected Outcome</p>
                                <p className="text-base font-bold mt-1.5" style={{ color: outcome.color }}>
                                    {outcome.label}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-1 replit-font-mono">{outcome.desc}</p>
                            </div>
                        </div>

                        <button
                            onClick={onGenerate}
                            disabled={loading}
                            className="w-full replit-btn-primary py-3 text-xs uppercase tracking-wider replit-font-mono cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4 text-[#00f0ff]" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Building your workspace...
                                </span>
                            ) : (
                                <span>Generate First 7 Days →</span>
                            )}
                        </button>
                    </div>
                </div>

                <p className="mt-4 text-center text-[10px] text-zinc-600 replit-font-mono">
                    Workspace is generated day-by-day · complete tasks to unlock future days
                </p>
            </div>
        </div>
    );
}