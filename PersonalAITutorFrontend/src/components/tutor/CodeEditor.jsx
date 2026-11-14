import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { runJs } from "../../lib/runJs";

export function detectLanguage(goal = "") {
    const lower = (goal || "").toLowerCase();
    if (lower.includes("javascript") || lower.includes("js") || lower.includes("react") || lower.includes("node") || lower.includes("mern")) {
        return "javascript";
    }
    if (lower.includes("python") || lower.includes("django") || lower.includes("flask") || lower.includes("data science")) {
        return "python";
    }
    if (lower.includes("java") || lower.includes("spring")) {
        return "java";
    }
    if (lower.includes("sql") || lower.includes("database") || lower.includes("postgres") || lower.includes("mysql")) {
        return "sql";
    }
    return "plaintext";
}

export default function CodeEditor({
    initialCode = "",
    goalId,
    dayNumber,
    goal = "",
    onChange,
}) {
    const language = detectLanguage(goal);
    const storageKey = `task:${goalId || "default"}:${dayNumber || "0"}`;

    const [code, setCode] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(storageKey);
            if (saved !== null) return saved;
        }
        return initialCode;
    });

    const [output, setOutput] = useState("");
    const [running, setRunning] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && code !== undefined) {
            localStorage.setItem(storageKey, code);
        }
        if (onChange) {
            onChange(code);
        }
    }, [code, storageKey, onChange]);

    const handleEditorChange = (value) => {
        setCode(value || "");
    };

    const handleRun = async () => {
        if (running) return;
        setRunning(true);
        setOutput("Executing...");

        try {
            const result = await runJs(code);
            if (result.timedOut) {
                setOutput("Timed out");
            } else if (result.error) {
                setOutput(`Error: ${result.error}`);
            } else {
                setOutput(result.logs.length > 0 ? result.logs.join("\n") : "(Execution finished with no output)");
            }
        } catch (err) {
            // Commented catch:
            // Execution wrapper encountered unexpected error
            setOutput(`Execution error: ${err.message || String(err)}`);
        } finally {
            setRunning(false);
        }
    };

    const handleCopy = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    const isJs = language === "javascript";

    return (
        <div className="flex flex-col h-full w-full border border-[#E7E5E4] bg-white rounded overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#E7E5E4] bg-[#FAFAF9]">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#78716C] uppercase font-semibold">
                        {language}
                    </span>
                </div>
                <div>
                    {isJs ? (
                        <button
                            onClick={handleRun}
                            disabled={running}
                            className="px-3 py-1 text-xs font-medium rounded bg-[#0F766E] text-white hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                        >
                            {running ? "Running..." : "Run"}
                        </button>
                    ) : (
                        <button
                            onClick={handleCopy}
                            className="px-3 py-1 text-xs font-medium rounded border border-[#E7E5E4] bg-white text-[#1C1917] hover:bg-[#F5F5F4] transition-colors cursor-pointer"
                        >
                            {copied ? "Copied" : "Copy code"}
                        </button>
                    )}
                </div>
            </div>

            {/* Monaco Editor Container */}
            <div className="min-h-[400px] flex-1">
                <Editor
                    height="400px"
                    language={language}
                    theme="vs"
                    value={code}
                    onChange={handleEditorChange}
                    options={{
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        minimap: { enabled: false },
                        lineNumbers: "on",
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        overviewRulerBorder: false,
                        tabSize: 2,
                    }}
                />
            </div>

            {/* Context footnote */}
            <div className="px-3 py-1.5 border-t border-[#E7E5E4] bg-[#FAFAF9] text-[11px] text-[#78716C]">
                {isJs ? "Runs in your browser" : "Copy and run locally"}
            </div>

            {/* 120px Output pane for JS */}
            {isJs && (
                <div className="border-t border-[#E7E5E4] bg-white">
                    <div className="px-3 py-1 border-b border-[#E7E5E4] text-[10px] font-mono text-[#78716C] uppercase">
                        Console Output
                    </div>
                    <pre className="h-[120px] overflow-y-auto p-3 font-mono text-xs text-[#1C1917] bg-[#FAFAF9] whitespace-pre-wrap select-text">
                        {output || "(Click 'Run' to evaluate code in sandbox)"}
                    </pre>
                </div>
            )}
        </div>
    );
}
