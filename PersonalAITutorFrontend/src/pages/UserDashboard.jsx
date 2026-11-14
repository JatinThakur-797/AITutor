import { useEffect, useState } from "react";
import { getAllGoals, getRoadmapDays } from "../api/tutorApi";

export default function UserDashboard({ user, onStartNew, onContinueGoal }) {
    const [goals, setGoals] = useState([]);
    const [activeGoalIndex, setActiveGoalIndex] = useState(0);
    const [roadmapDays, setRoadmapDays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingDays, setLoadingDays] = useState(false);

    useEffect(() => {
        fetchGoals();
    }, []);

    const fetchGoals = async () => {
        setLoading(true);
        try {
            const res = await getAllGoals();
            const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
            const items = Array.isArray(data) ? data : [];
            setGoals(items);

            if (items.length > 0) {
                const first = items[0];
                loadGoalRoadmap(first);
            }
        } catch (err) {
            // Commented catch: load goals failed, set empty list
            setGoals([]);
        } finally {
            setLoading(false);
        }
    };

    const loadGoalRoadmap = async (goal) => {
        const gId = goal.id || goal.goalId;
        if (!gId || goal.status !== "ROADMAP_GENERATED") {
            setRoadmapDays([]);
            return;
        }

        setLoadingDays(true);
        try {
            const res = await getRoadmapDays(gId);
            const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
            setRoadmapDays(data?.days || []);
        } catch (e) {
            // Commented catch: roadmap days fetch failed
            setRoadmapDays([]);
        } finally {
            setLoadingDays(false);
        }
    };

    const handleSelectGoal = (index) => {
        setActiveGoalIndex(index);
        loadGoalRoadmap(goals[index]);
    };

    // Skeletons: 4 tiles + 5 rows, --color-surface-sunken blocks, no shimmer
    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAFAF9] text-[#1C1917] p-8 font-sans max-w-5xl mx-auto">
                {/* 4 tiles skeleton */}
                <div className="grid grid-cols-2 md:grid-cols-4 border border-[#E7E5E4] bg-white rounded divide-y md:divide-y-0 md:divide-x divide-[#E7E5E4] mb-8">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="p-4">
                            <div className="h-3 w-16 bg-[#F5F5F4] rounded mb-2" />
                            <div className="h-7 w-12 bg-[#F5F5F4] rounded" />
                        </div>
                    ))}
                </div>

                {/* 5 rows skeleton */}
                <div className="border border-[#E7E5E4] bg-white rounded divide-y divide-[#E7E5E4]">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-4 flex items-center justify-between">
                            <div className="h-4 w-48 bg-[#F5F5F4] rounded" />
                            <div className="h-4 w-12 bg-[#F5F5F4] rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Empty state when no goal: one sentence, one button, vertically centered, nothing else on screen
    if (!goals || goals.length === 0) {
        return (
            <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center p-6 text-center font-sans">
                <p className="text-sm text-[#78716C] mb-4">You have no active learning goals yet.</p>
                <button
                    onClick={onStartNew}
                    className="px-4 py-2 text-xs font-medium rounded bg-[#0F766E] text-white hover:opacity-90 transition-opacity cursor-pointer"
                >
                    Create first goal
                </button>
            </div>
        );
    }

    const currentGoal = goals[activeGoalIndex] || goals[0];
    const totalGoals = goals.length;
    const activeGoals = goals.filter((g) => g.status === "ROADMAP_GENERATED").length;
    const totalCompleted = goals.reduce((a, g) => a + (g.completedDays || 0), 0);
    const streakDays = 7;

    const totalDays = currentGoal.totalDays || currentGoal.duration * 30 || 30;
    const completedDays = currentGoal.completedDays || 0;
    const progressPct = totalDays > 0 ? Math.min(100, Math.round((completedDays / totalDays) * 100)) : 0;

    // Find the single next unlocked day
    const nextDayNumber = completedDays + 1;
    const nextDayObj = roadmapDays.find((d) => d.day === nextDayNumber) || {
        day: nextDayNumber,
        main_topic: currentGoal.status === "ROADMAP_GENERATED"
            ? (roadmapDays[0]?.main_topic || "Next Scheduled Topic")
            : "Diagnostic Quiz & Assessment",
    };

    return (
        <div className="min-h-screen bg-[#FAFAF9] text-[#1C1917] font-sans">
            {/* Minimal Sub-header */}
            <header className="border-b border-[#E7E5E4] bg-white px-8 py-3.5 flex items-center justify-between">
                <span className="font-semibold text-sm tracking-tight text-[#1C1917]">PathAI Workspace</span>
                <span className="text-xs text-[#78716C] font-mono">
                    {user?.name || user?.email?.split("@")[0] || "Learner"}
                </span>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* Top row: 4 compact stat tiles in a single bordered strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 border border-[#E7E5E4] bg-white rounded divide-y md:divide-y-0 md:divide-x divide-[#E7E5E4] mb-8">
                    <div className="p-4">
                        <div className="text-[12px] text-[#78716C] mb-1">Goals active</div>
                        <div className="text-[28px] font-semibold text-[#1C1917] leading-tight">{activeGoals || totalGoals}</div>
                    </div>
                    <div className="p-4">
                        <div className="text-[12px] text-[#78716C] mb-1">Days completed</div>
                        <div className="text-[28px] font-semibold text-[#1C1917] leading-tight">{totalCompleted}</div>
                    </div>
                    <div className="p-4">
                        <div className="text-[12px] text-[#78716C] mb-1">Streak</div>
                        <div className="text-[28px] font-semibold text-[#1C1917] leading-tight">{streakDays}d</div>
                    </div>
                    <div className="p-4">
                        <div className="text-[12px] text-[#78716C] mb-1">Lessons read</div>
                        <div className="text-[28px] font-semibold text-[#1C1917] leading-tight">{totalCompleted}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    {/* Left column (2/3): Continue next unlocked day + Full roadmap list */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Continue section */}
                        <div className="border border-[#E7E5E4] bg-white rounded p-5">
                            <div className="text-xs text-[#78716C] font-mono uppercase mb-1">Continue</div>
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold text-[#1C1917]">
                                        Day {nextDayObj.day}: {nextDayObj.main_topic || "Next Lesson Topic"}
                                    </h2>
                                    <p className="text-xs text-[#78716C] mt-0.5">
                                        {currentGoal.status === "ROADMAP_GENERATED"
                                            ? "Interactive curriculum ready to resume"
                                            : "Assessment pending to calibrate timeline"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onContinueGoal(currentGoal)}
                                    className="px-4 py-2 text-xs font-medium rounded bg-[#0F766E] text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
                                >
                                    Resume Day {nextDayObj.day}
                                </button>
                            </div>
                        </div>

                        {/* Full roadmap as a vertical list with 1px separators */}
                        <div>
                            <div className="text-xs text-[#78716C] font-mono mb-2">Roadmap schedule</div>
                            <div className="border border-[#E7E5E4] bg-white rounded divide-y divide-[#E7E5E4] overflow-hidden">
                                {roadmapDays.length > 0 ? (
                                    roadmapDays.map((d) => {
                                        const isDone = d.completed;
                                        const isOpen = d.day === nextDayNumber;
                                        const statusLabel = isDone ? "Done" : isOpen ? "Open" : "Locked";
                                        const pillClass = isDone
                                            ? "bg-[#DCFCE7] text-[#15803D]"
                                            : isOpen
                                            ? "bg-[#CCFBF1] text-[#0F766E]"
                                            : "bg-[#F5F5F4] text-[#78716C]";

                                        return (
                                            <div
                                                key={d.day}
                                                className="px-4 py-3 flex items-center justify-between text-sm hover:bg-[#F5F5F4] transition-colors cursor-pointer"
                                                onClick={() => onContinueGoal(currentGoal)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-xs text-[#78716C] w-12">
                                                        Day {String(d.day).padStart(2, "0")}
                                                    </span>
                                                    <span className="text-[#1C1917] font-normal">
                                                        {d.main_topic}
                                                    </span>
                                                </div>
                                                <span className={`px-2 py-0.5 text-[11px] rounded font-medium ${pillClass}`}>
                                                    {statusLabel}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-center text-xs text-[#78716C]">
                                        {currentGoal.status === "ROADMAP_GENERATED"
                                            ? "Loading roadmap days..."
                                            : "Roadmap unlocks after completing diagnostic setup."}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right column (1/3): Goal summary */}
                    <div className="border border-[#E7E5E4] bg-white rounded p-5 space-y-4">
                        <div>
                            <div className="text-xs text-[#78716C] font-mono uppercase mb-1">Active goal</div>
                            <h3 className="text-base font-semibold text-[#1C1917]">{currentGoal.goal}</h3>
                        </div>

                        <div className="text-xs text-[#78716C] space-y-1">
                            <div>Level: <span className="text-[#1C1917] font-medium">{currentGoal.currentLevel || "Beginner"}</span></div>
                            <div>Timeframe: <span className="text-[#1C1917] font-medium">{currentGoal.duration} months &middot; {currentGoal.timePerDay}h/day</span></div>
                            <div>Progress: <span className="text-[#1C1917] font-medium">{completedDays} / {totalDays} days</span></div>
                        </div>

                        {/* Progress bar 4px tall in accent */}
                        <div className="w-full h-1 bg-[#F5F5F4] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#0F766E] rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>

                        {/* Multiple goals selector if user has more than 1 */}
                        {goals.length > 1 && (
                            <div className="pt-2 border-t border-[#E7E5E4]">
                                <div className="text-[11px] text-[#78716C] mb-2 font-mono">Other goals</div>
                                <div className="space-y-1">
                                    {goals.map((g, idx) => (
                                        <button
                                            key={g.id || g.goalId || idx}
                                            onClick={() => handleSelectGoal(idx)}
                                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                                                idx === activeGoalIndex
                                                    ? "bg-[#CCFBF1] text-[#0F766E] font-medium"
                                                    : "text-[#78716C] hover:bg-[#F5F5F4]"
                                            }`}
                                        >
                                            {g.goal}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-[#E7E5E4]">
                            <button
                                onClick={onStartNew}
                                className="text-xs text-[#0F766E] hover:underline font-medium cursor-pointer"
                            >
                                New goal
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
