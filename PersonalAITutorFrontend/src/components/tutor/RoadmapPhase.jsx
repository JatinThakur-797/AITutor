import { useState, useEffect } from 'react';

const LockIcon = () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="1" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
);

const CheckIcon = ({ size = 14 }) => (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function RoadmapPhase({
    roadmap, formData, feasibility, loadedDays,
    onLoadMore, loading, onMarkComplete, goalId, onStartLesson, onBackToDashboard
}) {
    const [selectedDay, setSelectedDay] = useState(roadmap[0]?.day || 1);
    const [completing, setCompleting] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const totalDays = formData.duration * 30;
    const completedCount = roadmap.filter(d => d.completed).length;
    const progressPct = Math.round((completedCount / totalDays) * 100);

    const currentDay = roadmap.find(d => d.day === selectedDay);

    const isDayLocked = (dayNumber) => {
        if (dayNumber === roadmap[0]?.day) return false; 
        const prevDay = roadmap.find(d => d.day === dayNumber - 1);
        return !prevDay || !prevDay.completed;
    };

    const handleMarkComplete = async (dayNumber) => {
        setCompleting(dayNumber);
        try {
            await onMarkComplete(goalId, dayNumber);
        } finally {
            setCompleting(null);
        }
    };

    const notYetLoaded = loadedDays < totalDays;
    const allLoadedDaysComplete = roadmap.every(d => d.completed);

    return (
        <div className="min-h-screen flex bg-[#0e1117] text-zinc-300">
            {/* Sidebar */}
            <aside className="w-72 min-h-screen flex flex-col border-r border-[#2e303e] bg-[#1c1e26] shrink-0 sticky top-0 h-screen overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-[#2e303e]">
                    <button 
                        onClick={onBackToDashboard}
                        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors text-[10px] uppercase replit-font-mono mb-4 cursor-pointer"
                    >
                        ← Back to workspaces
                    </button>
                    
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
                        <span style={{ fontFamily: "'Geist Mono', monospace" }}
                            className="text-[9px] text-[#00f0ff] uppercase tracking-wider">ROADMAP STATUS</span>
                    </div>
                    <h2 className="text-white font-bold text-sm leading-tight mt-1.5 truncate">
                        {formData.goal}
                    </h2>
                    <p className="text-zinc-500 text-[10px] mt-0.5 capitalize replit-font-mono">
                        {feasibility?.expectedOutcome} · {totalDays} days
                    </p>

                    {/* Progress bar */}
                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] text-zinc-500 replit-font-mono">WORKSPACE PROGRESS</span>
                            <span style={{ fontFamily: "'Geist Mono', monospace" }}
                                className="text-[10px] text-[#00f0ff]">{completedCount}/{totalDays}</span>
                        </div>
                        <div className="w-full h-1 bg-[#0e1117] rounded overflow-hidden">
                            <div className="h-full rounded transition-all duration-700"
                                style={{ width: `${progressPct}%`, background: '#00f0ff' }} />
                        </div>
                    </div>
                </div>

                {/* Day list */}
                <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
                    {roadmap.map((day) => {
                        const locked = isDayLocked(day.day);
                        const isSelected = selectedDay === day.day;

                        return (
                            <button
                                key={day.day}
                                onClick={() => !locked && setSelectedDay(day.day)}
                                disabled={locked}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-150 text-left group cursor-pointer"
                                style={{
                                    background: isSelected ? 'rgba(0,240,255,0.06)' : 'transparent',
                                    border: `1px solid ${isSelected ? '#00f0ff' : 'transparent'}`,
                                    opacity: locked ? 0.4 : 1,
                                    cursor: locked ? 'not-allowed' : 'pointer'
                                }}>
                                {/* Day indicator */}
                                <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 transition-all"
                                    style={{
                                        background: day.completed ? 'rgba(16,185,129,0.06)' : locked ? '#0e1117' : isSelected ? 'rgba(0,240,255,0.1)' : '#0e1117',
                                        border: `1px solid ${day.completed ? 'rgba(16,185,129,0.3)' : locked ? '#2e303e' : isSelected ? '#00f0ff' : '#2e303e'}`,
                                    }}>
                                    {day.completed ? (
                                        <span className="text-[#10b981]"><CheckIcon size={12} /></span>
                                    ) : locked ? (
                                        <span className="text-zinc-600"><LockIcon /></span>
                                    ) : (
                                        <span style={{
                                            fontFamily: "'Geist Mono', monospace",
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            color: isSelected ? '#00f0ff' : '#c9d1d9'
                                        }}>{String(day.day).padStart(2, '0')}</span>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate"
                                        style={{ color: day.completed ? '#10b981' : locked ? '#4b5563' : isSelected ? '#ffffff' : '#c9d1d9' }}>
                                        {day.main_topic || day.mainTopic}
                                    </p>
                                    <p className="text-[8.5px] mt-0.5 uppercase tracking-wider replit-font-mono"
                                        style={{ color: day.completed ? '#10b981' : locked ? '#4b5563' : '#00f0ff' }}>
                                        {day.completed ? 'Completed' : locked ? 'Locked' : 'Available'}
                                    </p>
                                </div>
                            </button>
                        );
                    })}

                    {/* Load more trigger */}
                    {notYetLoaded && (
                        <button
                            onClick={onLoadMore}
                            disabled={loading || !allLoadedDaysComplete}
                            className="w-full flex items-center gap-3 px-3 py-3 rounded border border-dashed transition-all mt-1 cursor-pointer"
                            style={{
                                borderColor: allLoadedDaysComplete ? '#00f0ff' : '#2e303e',
                                opacity: loading ? 0.6 : !allLoadedDaysComplete ? 0.4 : 1,
                                cursor: !allLoadedDaysComplete ? 'not-allowed' : 'pointer',
                                background: '#1c1e26/30'
                            }}>
                            {loading ? (
                                <svg className="animate-spin w-4 h-4 text-[#00f0ff] mx-auto" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <>
                                    <div className="w-8 h-8 rounded bg-[#0e1117] border border-[#2e303e] flex items-center justify-center">
                                        <span className="text-[#00f0ff] text-sm">+</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-semibold text-[#00f0ff]">Load Next 7 Days</p>
                                        <p className="text-[9px] text-zinc-500 replit-font-mono">
                                            {allLoadedDaysComplete ? 'Ready to load' : 'Complete active days first'}
                                        </p>
                                    </div>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">
                {currentDay ? (
                    <div className="max-w-3xl mx-auto p-8">
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="px-2 py-0.5 rounded border border-[#2e303e] bg-[#1c1e26]"
                                    style={{ fontFamily: "'Geist Mono', monospace" }}>
                                    <span className="text-[10px] text-[#00f0ff]">DAY {currentDay.day}</span>
                                </div>
                                {currentDay.completed && (
                                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/5">
                                        <CheckIcon size={10} />
                                        <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider replit-font-mono">Completed</span>
                                    </div>
                                )}
                            </div>
                            <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                                {currentDay.main_topic || currentDay.mainTopic}
                            </h1>
                            <p className="text-zinc-500 text-sm leading-relaxed replit-font-mono">
                                {currentDay.daily_goal || currentDay.dailyGoal}
                            </p>
                        </div>

                        {/* Hours allocation */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="rounded p-4 border border-[#2e303e] bg-[#1c1e26]">
                                <p style={{ fontFamily: "'Geist Mono', monospace" }}
                                    className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1.5">Theory Study</p>
                                <p className="text-2xl font-bold text-white">
                                    {currentDay.hours_allocation?.theory || currentDay.theoryHours}
                                </p>
                            </div>
                            <div className="rounded p-4 border border-[#2e303e] bg-[#1c1e26]">
                                <p style={{ fontFamily: "'Geist Mono', monospace" }}
                                    className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1.5">Practice / IDE</p>
                                <p className="text-2xl font-bold text-white">
                                    {currentDay.hours_allocation?.practice || currentDay.practiceHours}
                                </p>
                            </div>
                        </div>

                        {/* Syllabus */}
                        <div className="rounded border border-[#2e303e] bg-[#1c1e26] overflow-hidden mb-6">
                            <div className="px-6 py-3 border-b border-[#2e303e]">
                                <h3 style={{ fontFamily: "'Geist Mono', monospace" }}
                                    className="text-[9px] text-zinc-500 uppercase tracking-wider">Today's Syllabus topics</h3>
                            </div>
                            <div className="p-6 space-y-3">
                                {(currentDay.sub_topics || currentDay.subTopics || []).map((topic, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="w-5 h-5 rounded bg-[#0e1117] border border-[#2e303e] flex items-center justify-center shrink-0 mt-0.5">
                                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '9px' }}
                                                className="text-zinc-500">{String(i + 1).padStart(2, '0')}</span>
                                        </div>
                                        <p className="text-sm text-zinc-300 leading-relaxed">{topic}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        {!currentDay.completed && !isDayLocked(currentDay.day) && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => onStartLesson(currentDay.day)}
                                    className="flex-1 replit-btn-primary py-3 text-xs uppercase tracking-wider replit-font-mono cursor-pointer"
                                >
                                    Start Interactive Lesson
                                </button>
                                <button
                                    onClick={() => handleMarkComplete(currentDay.day)}
                                    disabled={completing === currentDay.day}
                                    className="replit-btn-secondary px-6 py-3 text-xs uppercase tracking-wider replit-font-mono cursor-pointer disabled:opacity-40"
                                >
                                    {completing === currentDay.day ? (
                                        <span className="flex items-center gap-1.5">
                                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Saving...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5">
                                            <CheckIcon size={14} /> Skip Quiz & Complete
                                        </span>
                                    )}
                                </button>
                            </div>
                        )}

                        {currentDay.completed && (
                            <div className="rounded p-4 flex items-center gap-3 border border-emerald-500/30 bg-emerald-500/5">
                                <div className="w-8 h-8 rounded border border-emerald-500/30 bg-[#0e1117] flex items-center justify-center text-emerald-400">
                                    <CheckIcon size={14} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wide replit-font-mono">Day {currentDay.day} Complete</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        {roadmap.find(d => d.day === currentDay.day + 1)
                                            ? `Day ${currentDay.day + 1} is now unlocked on the sidebar.`
                                            : allLoadedDaysComplete && notYetLoaded
                                                ? 'All active days complete — Load next 7 days in sidebar.'
                                                : 'Great job, study pathway complete!'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-600 replit-font-mono text-sm">
                        Select an available day on the sidebar list.
                    </div>
                )}
            </main>
        </div>
    );
}