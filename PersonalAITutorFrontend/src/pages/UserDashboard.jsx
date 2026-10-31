import { useEffect, useState } from 'react';
import { getAllGoals } from '../api/tutorApi';

const mono = { fontFamily: "'Geist Mono', 'JetBrains Mono', monospace" };

const StatusBadge = ({ status }) => {
    const cfg = {
        QUIZ_PENDING: { label: 'Quiz pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
        FEASIBILITY_DONE: { label: 'Ready to generate', color: '#00f0ff', bg: 'rgba(0,240,255,0.06)', border: 'rgba(0,240,255,0.2)' },
        ROADMAP_GENERATED: { label: 'In progress', color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
    };
    const s = cfg[status] || cfg.QUIZ_PENDING;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-semibold"
            style={{ color: s.color, background: s.bg, borderColor: s.border, ...mono }}>
            <span className="w-1 h-1 rounded-full" style={{ background: s.color }} />
            {s.label}
        </span>
    );
};

const OutcomeBadge = ({ outcome }) => {
    const cfg = {
        'foundation': { label: 'Foundation', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
        'intermediate': { label: 'Intermediate', color: '#0f62fe', border: 'rgba(15,98,254,0.3)' },
        'job-ready': { label: 'Job Ready', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
    };
    const o = cfg[outcome] || cfg['foundation'];
    return (
        <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded border" 
            style={{ color: o.color, borderColor: o.border, background: 'rgba(255,255,255,0.01)', ...mono }}>
            {o.label}
        </span>
    );
};

const Ring = ({ pct, size = 56, stroke = 3, color = '#00f0ff' }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="square"
                style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        </svg>
    );
};

const GoalCard = ({ goal, onContinue, delay = 0 }) => {
    const total = goal.totalDays || (goal.duration * 30);
    const done = goal.completedDays || 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isActive = goal.status === 'ROADMAP_GENERATED';

    const ringColor = pct >= 80 ? '#10b981' : pct >= 40 ? '#0f62fe' : '#00f0ff';

    return (
        <div
            className="group relative rounded border overflow-hidden cursor-pointer transition-all duration-200"
            style={{
                background: '#1c1e26',
                borderColor: isActive ? '#00f0ff' : '#2e303e',
                animationDelay: `${delay}ms`,
            }}
            onClick={() => onContinue(goal)}>

            <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0 mr-4">
                        <h3 className="text-white font-bold text-base leading-tight mb-2 group-hover:text-[#00f0ff] transition-colors">
                            {goal.goal}
                        </h3>
                        <StatusBadge status={goal.status} />
                    </div>

                    <div className="relative shrink-0">
                        <Ring pct={pct} color={ringColor} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white font-bold" style={{ fontSize: 10, ...mono }}>{pct}%</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-5">
                    {[
                        { label: 'Completed', val: done },
                        { label: 'Remaining', val: Math.max(0, total - done) },
                        { label: 'Total', val: total },
                    ].map(s => (
                        <div key={s.label} className="rounded p-2.5 text-center bg-[#0e1117] border border-[#2e303e]">
                            <p className="text-white font-bold text-base leading-none">{s.val}</p>
                            <p className="text-[9px] text-zinc-500 mt-1" style={mono}>{s.label}</p>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500" style={mono}>
                        <span>{goal.duration}mo · {goal.timePerDay}h/day</span>
                        {goal.expectedOutcome && (
                            <>
                                <span className="w-px h-2.5 bg-[#2e303e]" />
                                <OutcomeBadge outcome={goal.expectedOutcome} />
                            </>
                        )}
                    </div>
                    <span className="text-[10px] text-zinc-600" style={mono}>
                        {new Date(goal.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                </div>

                <div className="w-full h-1 bg-[#0e1117] rounded-full overflow-hidden mb-5">
                    <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: ringColor }} />
                </div>

                <button className="w-full py-2.5 rounded text-xs font-semibold uppercase tracking-wider replit-font-mono transition-all duration-150 cursor-pointer"
                    style={{
                        background: isActive ? '#0f62fe' : '#0e1117',
                        border: '1px solid #2e303e',
                        color: isActive ? '#ffffff' : '#c9d1d9',
                    }}>
                    {goal.status === 'ROADMAP_GENERATED'
                        ? done === 0 ? 'Start Learning →' : 'Continue Learning →'
                        : goal.status === 'FEASIBILITY_DONE' ? 'Generate Roadmap →'
                            : 'Complete Setup →'}
                </button>
            </div>
        </div>
    );
};

const EmptyState = ({ onNew }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded border border-[#2e303e] bg-[#1c1e26]">
        <div className="w-16 h-16 rounded border border-[#2e303e] bg-[#0e1117] flex items-center justify-center mb-6 mx-auto">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#00f0ff]" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
            </svg>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">
            No roadmaps yet
        </h3>
        <p className="text-zinc-500 text-xs mb-6 max-w-xs replit-font-mono">
            Create your first AI-powered learning roadmap and start your journey today.
        </p>
        <button onClick={onNew}
            className="replit-btn-primary px-6 py-2.5 text-xs uppercase tracking-wider replit-font-mono cursor-pointer">
            Create First Roadmap →
        </button>
    </div>
);

const StatCard = ({ label, value, sub, color = '#00f0ff' }) => (
    <div className="rounded p-5 border border-[#2e303e] bg-[#1c1e26]">
        <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2" style={mono}>{label}</p>
        <p className="text-2xl font-bold text-white" style={{ color }}>{value}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-1" style={mono}>{sub}</p>}
    </div>
);

export default function UserDashboard({ user, onStartNew, onContinueGoal }) {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const h = new Date().getHours();
        setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
        fetchGoals();
    }, []);

    const fetchGoals = async () => {
        try {
            const res = await getAllGoals();
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            setGoals(data || []);
        } catch (err) {
            console.error('Failed to load goals:', err);
            setGoals([]);
        } finally {
            setLoading(false);
        }
    };

    const totalGoals = goals.length;
    const activeGoals = goals.filter(g => g.status === 'ROADMAP_GENERATED').length;
    const totalDaysLeft = goals.reduce((a, g) => a + Math.max(0, (g.totalDays || g.duration * 30) - (g.completedDays || 0)), 0);
    const totalCompleted = goals.reduce((a, g) => a + (g.completedDays || 0), 0);
    const streakDays = 7; 

    const userName = user?.name || user?.email?.split('@')[0] || 'there';

    return (
        <div className="min-h-screen bg-[#0e1117] text-zinc-300">
            {/* Topnav */}
            <nav className="border-b border-[#2e303e] bg-[#1c1e26] px-8 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-6.5 h-6.5 rounded flex items-center justify-center bg-[#0f62fe]">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <span className="text-white font-bold text-sm tracking-tight">PathAI</span>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={onStartNew}
                        className="replit-btn-primary px-4 py-2 text-xs flex items-center gap-2 uppercase tracking-wider replit-font-mono cursor-pointer">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New Roadmap
                    </button>

                    <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white bg-[#2e303e] border border-[#2e303e]">
                        {userName.charAt(0).toUpperCase()}
                    </div>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-8 py-10">
                {/* Greeting */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded bg-[#00f0ff] animate-pulse" />
                        <span className="text-[10px] text-[#00f0ff] uppercase tracking-wider replit-font-mono">WORKSPACE DASHBOARD</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        {greeting}, <span className="text-[#00f0ff]">{userName}</span>
                    </h1>
                    <p className="text-zinc-500 text-xs mt-1.5 replit-font-mono">
                        {loading ? 'Loading active progress records...'
                            : totalGoals === 0 ? 'Start your first learning journey below.'
                                : `You have ${activeGoals} active path${activeGoals !== 1 ? 's' : ''} in progress.`}
                    </p>
                </div>

                {/* Stats */}
                {!loading && totalGoals > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                        <StatCard label="Total Paths" value={totalGoals} sub="created" color="#0f62fe" />
                        <StatCard label="Days Completed" value={totalCompleted} sub="across all paths" color="#10b981" />
                        <StatCard label="Days Remaining" value={totalDaysLeft} sub="to finish" color="#f59e0b" />
                        <StatCard label="Active Streak" value={`${streakDays}d`} sub="consecutive days" color="#00f0ff" />
                    </div>
                )}

                {/* Goals */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="rounded border border-[#2e303e] bg-[#1c1e26] p-6 animate-pulse">
                                <div className="h-4 bg-[#0e1117] rounded w-3/4 mb-3" />
                                <div className="h-3 bg-[#0e1117] rounded w-1/3 mb-6" />
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {[1, 2, 3].map(j => <div key={j} className="h-14 bg-[#0e1117] rounded" />)}
                                </div>
                                <div className="h-10 bg-[#0e1117] rounded" />
                            </div>
                        ))}
                    </div>
                ) : totalGoals === 0 ? (
                    <EmptyState onNew={onStartNew} />
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider replit-font-mono">
                                ACTIVE WORKSPACES ({totalGoals})
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {goals.map((goal, i) => (
                                <GoalCard
                                    key={goal.goalId || i}
                                    goal={goal}
                                    delay={i * 80}
                                    onContinue={onContinueGoal}
                                />
                            ))}

                            {/* New path tile */}
                            <button onClick={onStartNew}
                                className="rounded border border-dashed border-[#2e303e] bg-[#1c1e26]/30 flex flex-col items-center justify-center gap-3 py-16 transition-all duration-150 hover:border-[#00f0ff] hover:bg-[#1c1e26]/50 group cursor-pointer">
                                <div className="w-10 h-10 rounded border border-dashed border-[#2e303e] flex items-center justify-center transition-all group-hover:border-[#00f0ff]/50">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-zinc-500 group-hover:text-[#00f0ff] transition-colors" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                </div>
                                <span className="text-xs font-medium text-zinc-500 group-hover:text-[#00f0ff] transition-colors uppercase tracking-wider replit-font-mono">
                                    New learning path
                                </span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}