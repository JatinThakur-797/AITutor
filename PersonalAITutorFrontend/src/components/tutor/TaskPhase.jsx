import { useState } from "react";
import CodeEditor from "./CodeEditor";

export default function TaskPhase({
    taskType,
    taskData,
    onSuccess,
    onBack,
    goalId,
    dayNumber,
    goalTitle = "",
}) {
    const [selectedOpt, setSelectedOpt] = useState("");
    const [error, setError] = useState(false);
    const [assessment, setAssessment] = useState("Got it");

    const storageKey = `task:${goalId || "default"}:${dayNumber || "0"}`;

    if (!taskData) {
        return (
            <div className="min-h-screen bg-[#FAFAF9] text-[#1C1917] flex flex-col items-center justify-center p-6 font-sans">
                <div className="max-w-md w-full bg-white border border-[#E7E5E4] rounded p-6 text-center">
                    <h2 className="text-base font-semibold mb-2 text-[#1C1917]">Task details unavailable</h2>
                    <p className="text-xs text-[#78716C] mb-6">
                        No exercise content was provided for this lesson day.
                    </p>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 text-xs font-medium rounded border border-[#E7E5E4] bg-white text-[#1C1917] hover:bg-[#F5F5F4] transition-colors cursor-pointer"
                    >
                        Back to lesson
                    </button>
                </div>
            </div>
        );
    }

    const handleSubmit = () => {
        if (taskType === "QUIZ") {
            if (selectedOpt === taskData.correct) {
                if (typeof window !== "undefined") {
                    localStorage.removeItem(storageKey);
                }
                onSuccess({ assessment });
            } else {
                setError(true);
            }
        } else {
            if (typeof window !== "undefined") {
                localStorage.removeItem(storageKey);
            }
            onSuccess({ assessment });
        }
    };

    const isQuiz = taskType === "QUIZ";

    return (
        <div className="min-h-screen bg-[#FAFAF9] text-[#1C1917] flex flex-col p-6 font-sans">
            {/* Top Navigation */}
            <div className="max-w-6xl w-full mx-auto mb-6 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="text-xs text-[#78716C] hover:text-[#1C1917] font-medium transition-colors cursor-pointer"
                >
                    &larr; Back to lesson
                </button>
                <span className="text-xs text-[#78716C] font-mono">
                    Day {dayNumber || 1} &middot; Task Practice
                </span>
            </div>

            <div className="max-w-6xl w-full mx-auto flex-1">
                {isQuiz ? (
                    /* Quiz Task Layout */
                    <div className="max-w-2xl mx-auto bg-white border border-[#E7E5E4] rounded p-6">
                        <div className="text-xs text-[#78716C] font-mono mb-2 uppercase">Knowledge check</div>
                        <h2 className="text-lg font-semibold mb-6 text-[#1C1917]">
                            {taskData.question}
                        </h2>

                        <div className="space-y-2 mb-6">
                            {taskData.options &&
                                Object.entries(taskData.options).map(([key, val]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setSelectedOpt(key);
                                            setError(false);
                                        }}
                                        className={`w-full text-left p-3.5 rounded border transition-all flex items-center gap-3 cursor-pointer ${
                                            selectedOpt === key
                                                ? "border-[#0F766E] bg-[#CCFBF1]/30"
                                                : "border-[#E7E5E4] bg-white hover:bg-[#F5F5F4]"
                                        }`}
                                    >
                                        <span
                                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-semibold shrink-0 ${
                                                selectedOpt === key
                                                    ? "bg-[#0F766E] text-white"
                                                    : "bg-[#F5F5F4] text-[#1C1917]"
                                            }`}
                                        >
                                            {key}
                                        </span>
                                        <span className="text-sm text-[#1C1917]">{val}</span>
                                    </button>
                                ))}
                        </div>

                        {error && (
                            <p className="text-xs text-[#B91C1C] font-medium mb-4">
                                Incorrect answer. Review the lesson details and try again.
                            </p>
                        )}

                        {/* Self-assessment radios */}
                        <div className="pt-4 border-t border-[#E7E5E4] mb-6">
                            <label className="block text-xs font-medium text-[#78716C] mb-2 font-mono">
                                How confident are you with this topic?
                            </label>
                            <div className="flex gap-4 text-xs">
                                {["Got it", "Mostly", "Struggled"].map((opt) => (
                                    <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="assessment"
                                            value={opt}
                                            checked={assessment === opt}
                                            onChange={(e) => setAssessment(e.target.value)}
                                            className="accent-[#0F766E]"
                                        />
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>
                            {assessment === "Struggled" && (
                                <p className="text-xs text-[#B45309] mt-2 font-mono">We'll add a review day.</p>
                            )}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!selectedOpt}
                            className="w-full py-2.5 text-xs font-semibold rounded bg-[#0F766E] text-white hover:opacity-90 disabled:opacity-40 cursor-pointer transition-opacity"
                        >
                            Submit & complete day
                        </button>
                    </div>
                ) : (
                    /* Coding / Activity Split Layout: 40% Left, 60% Right */
                    <div className="flex flex-col min-[900px]:flex-row gap-6 items-stretch">
                        {/* Instructions panel left (40%) */}
                        <div className="min-[900px]:w-[40%] bg-white border border-[#E7E5E4] rounded p-6 flex flex-col justify-between">
                            <div>
                                <div className="text-xs text-[#78716C] font-mono mb-1 uppercase">Practice Task</div>
                                <h2 className="text-lg font-semibold text-[#1C1917] mb-3">
                                    {taskData.title || "Implementation Exercise"}
                                </h2>
                                <p className="text-sm text-[#78716C] leading-relaxed mb-4">
                                    {taskData.problem || taskData.instructions || "Write your solution in the editor."}
                                </p>

                                {taskData.expected_output && (
                                    <div className="mb-4">
                                        <div className="text-[11px] font-mono text-[#78716C] uppercase mb-1">
                                            Expected Output
                                        </div>
                                        <pre className="p-3 bg-[#F5F5F4] border border-[#E7E5E4] rounded text-xs font-mono text-[#1C1917] whitespace-pre-wrap">
                                            {taskData.expected_output}
                                        </pre>
                                    </div>
                                )}
                            </div>

                            {/* Self assessment & submit */}
                            <div className="pt-4 border-t border-[#E7E5E4] mt-6">
                                <label className="block text-xs font-medium text-[#78716C] mb-2 font-mono">
                                    Self-assessment
                                </label>
                                <div className="flex gap-4 text-xs mb-3">
                                    {["Got it", "Mostly", "Struggled"].map((opt) => (
                                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="assessment"
                                                value={opt}
                                                checked={assessment === opt}
                                                onChange={(e) => setAssessment(e.target.value)}
                                                className="accent-[#0F766E]"
                                            />
                                            <span>{opt}</span>
                                        </label>
                                    ))}
                                </div>
                                {assessment === "Struggled" && (
                                    <p className="text-xs text-[#B45309] mb-3 font-mono">We'll add a review day.</p>
                                )}

                                <button
                                    onClick={handleSubmit}
                                    className="w-full py-2.5 text-xs font-semibold rounded bg-[#0F766E] text-white hover:opacity-90 transition-opacity cursor-pointer"
                                >
                                    Submit & complete day
                                </button>
                            </div>
                        </div>

                        {/* Editor right (60%) */}
                        <div className="min-[900px]:w-[60%] flex flex-col">
                            <CodeEditor
                                initialCode={taskData.starter_code || ""}
                                goalId={goalId}
                                dayNumber={dayNumber}
                                goal={goalTitle}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
