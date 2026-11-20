import Editor from "@monaco-editor/react";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Code2,
  FileText,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { Badge, Button } from "./UI";

function inferLanguage(taskData, goalTitle = "", lessonTitle = "") {
  const combined = `${taskData?.language || ""} ${
    taskData?.programming_language || ""
  } ${goalTitle} ${lessonTitle}`.toLowerCase();
  const starter = String(taskData?.starter_code || taskData?.starterCode || "");

  if (
    combined.includes("python") ||
    /\b(def |print\(|elif |import numpy|import pandas)\b/.test(starter)
  ) {
    return "python";
  }
  if (combined.includes("typescript") || combined.includes("angular")) {
    return "typescript";
  }
  if (
    combined.includes("javascript") ||
    combined.includes("react") ||
    combined.includes("node") ||
    /\b(console\.log|const |let |function )\b/.test(starter)
  ) {
    return "javascript";
  }
  if (combined.includes("c++") || combined.includes("cpp")) {
    return "cpp";
  }
  if (/\bc\b/.test(combined) && !combined.includes("c#")) {
    return "c";
  }
  if (combined.includes("sql") || combined.includes("database")) {
    return "sql";
  }
  if (combined.includes("html") || combined.includes("css")) {
    return "html";
  }
  if (combined.includes("go ") || combined.includes("golang")) {
    return "go";
  }
  return "java";
}

function defaultStarterCode(language) {
  switch (language) {
    case "python":
      return "# Write your Python solution below\ndef solve():\n    pass\n\nif __name__ == '__main__':\n    solve()\n";
    case "javascript":
    case "typescript":
      return "// Write your solution below\nfunction solve() {\n  \n}\n\nsolve();\n";
    case "cpp":
      return "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ solution here\n    return 0;\n}\n";
    case "c":
      return "#include <stdio.h>\n\nint main() {\n    // Write your C solution here\n    return 0;\n}\n";
    case "sql":
      return "-- Write your SQL query below\nSELECT * FROM table_name;\n";
    case "go":
      return 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello")\n}\n';
    default:
      return "public class Solution {\n    public static void main(String[] args) {\n        // Write your Java solution here\n    }\n}\n";
  }
}

const FILE_EXTENSIONS = {
  python: "py",
  java: "java",
  javascript: "js",
  typescript: "ts",
  cpp: "cpp",
  c: "c",
  sql: "sql",
  html: "html",
  go: "go",
};

export default function TaskWorkspace({
  taskType,
  taskData = {},
  goalId,
  dayNumber,
  goalTitle = "",
  lessonTitle = "",
  onComplete,
  completed = false,
  onReviewCode,
}) {
  const { theme } = useTheme();
  const type = String(taskType || "ACTIVITY").toUpperCase();
  const storageKey = `pathai-draft-${goalId}-${dayNumber}`;
  const language = useMemo(
    () => inferLanguage(taskData, goalTitle, lessonTitle),
    [taskData, goalTitle, lessonTitle],
  );
  const initialCode = useMemo(
    () =>
      taskData.starter_code ||
      taskData.starterCode ||
      taskData.code ||
      defaultStarterCode(language),
    [taskData, language],
  );

  const [code, setCode] = useState(
    () => localStorage.getItem(storageKey) || initialCode,
  );
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [notes, setNotes] = useState(
    () => localStorage.getItem(`${storageKey}-notes`) || "",
  );

  useEffect(() => {
    setCode(localStorage.getItem(storageKey) || initialCode);
    setNotes(localStorage.getItem(`${storageKey}-notes`) || "");
    setSelected("");
    setRevealed(false);
  }, [storageKey, initialCode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(storageKey, code);
      localStorage.setItem(`${storageKey}-notes`, notes);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [code, notes, storageKey]);

  const saveDraft = () => {
    localStorage.setItem(storageKey, code);
    localStorage.setItem(`${storageKey}-notes`, notes);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const resetCode = () => {
    setCode(initialCode);
    localStorage.removeItem(storageKey);
  };

  if (type === "QUIZ") {
    const options = taskData.options || {};
    const correct = String(
      taskData.correct || taskData.correct_answer || "",
    ).trim();

    return (
      <div className="task-workspace">
        <div className="task-title-row">
          <div className="task-type-icon task-purple">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="eyebrow">KNOWLEDGE CHECK</div>
            <h3>Test your understanding</h3>
          </div>
          <Badge tone="info">Quick quiz</Badge>
        </div>

        <p className="task-instructions">
          {taskData.instructions ||
            taskData.question ||
            "Choose the best answer."}
        </p>
        {taskData.question && taskData.instructions ? (
          <h4 className="task-question">{taskData.question}</h4>
        ) : null}

        <div className="task-options">
          {Object.entries(options).map(([key, value]) => (
            <button
              key={key}
              className={`task-option ${selected === key ? "selected" : ""} ${
                revealed && key === correct ? "correct" : ""
              }`}
              disabled={revealed}
              onClick={() => setSelected(key)}
            >
              <span>{key}</span>
              {value}
            </button>
          ))}
        </div>

        {revealed ? (
          <div
            className={`task-explanation ${
              selected === correct ? "success" : "notice"
            }`}
          >
            <strong>
              {selected === correct
                ? "Nice work — that is correct."
                : `The correct answer is ${correct || "not provided"}.`}
            </strong>
            <p>
              {taskData.explanation ||
                "Review the lesson section above and try a similar example."}
            </p>
          </div>
        ) : (
          <Button disabled={!selected} onClick={() => setRevealed(true)}>
            Check answer <CheckCircle2 size={16} />
          </Button>
        )}

        {revealed && onComplete ? (
          <Button variant="secondary" onClick={onComplete} disabled={completed}>
            {completed ? "Day completed" : "Mark day complete"}
          </Button>
        ) : null}
      </div>
    );
  }

  if (type === "CODING") {
    const fileExt = FILE_EXTENSIONS[language] || "txt";

    return (
      <div className="task-workspace coding-workspace">
        <div className="task-title-row">
          <div className="task-type-icon task-blue">
            <Code2 size={18} />
          </div>
          <div>
            <div className="eyebrow">HANDS-ON PRACTICE</div>
            <h3>Code it yourself</h3>
          </div>
          <Badge tone="info">{language}</Badge>
        </div>

        <p className="task-instructions">
          {taskData.instructions ||
            taskData.description ||
            "Complete the coding exercise using the editor below."}
        </p>

        {taskData.expected_output ? (
          <div className="expected-output">
            <span>EXPECTED OUTPUT</span>
            <code>{taskData.expected_output}</code>
          </div>
        ) : null}

        <div className="editor-toolbar">
          <span>
            <i className="editor-dot" /> Solution.{fileExt}
          </span>
          <div>
            <button type="button" onClick={resetCode}>
              <RotateCcw size={14} /> Reset
            </button>
            <button type="button" onClick={copyCode}>
              <Clipboard size={14} /> {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={saveDraft}>
              <Save size={14} /> {saved ? "Saved" : "Save draft"}
            </button>
          </div>
        </div>

        <div className="monaco-wrap">
          <Editor
            height="340px"
            language={language}
            theme={theme === "light" ? "light" : "vs-dark"}
            value={code}
            onChange={(value) => setCode(value ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              padding: { top: 14 },
              wordWrap: "on",
              smoothScrolling: true,
            }}
          />
        </div>

        <div className="editor-actions">
          <div className="editor-info">
            <span className="editor-status-dot" /> Auto-saved locally in this
            browser
          </div>
          <div className="editor-action-buttons">
            {onReviewCode ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onReviewCode(code, language)}
              >
                <Bot size={15} /> Ask Mentor to Review
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={saveDraft}
            >
              <Save size={15} /> {saved ? "Saved!" : "Save snapshot"}
            </Button>
          </div>
        </div>

        {onComplete ? (
          <Button onClick={onComplete} disabled={completed}>
            {completed ? "Day completed" : "Mark practice complete"}{" "}
            <CheckCircle2 size={16} />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="task-workspace">
      <div className="task-title-row">
        <div className="task-type-icon task-green">
          <FileText size={18} />
        </div>
        <div>
          <div className="eyebrow">PRACTICE & REFLECTION</div>
          <h3>Put the idea into words</h3>
        </div>
        <Badge tone="success">Activity</Badge>
      </div>

      <p className="task-instructions">
        {taskData.instructions ||
          taskData.description ||
          "Write a short explanation, sketch a solution, or note how you would apply this concept in a real project."}
      </p>

      <textarea
        className="input activity-notes"
        rows="7"
        placeholder="Write your approach, example, or notes here…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="editor-actions">
        <span className="editor-info">
          <span className="editor-status-dot" /> Auto-saved locally in this
          browser
        </span>
        <Button type="button" variant="secondary" size="sm" onClick={saveDraft}>
          <Save size={15} /> {saved ? "Saved!" : "Save notes"}
        </Button>
      </div>

      {onComplete ? (
        <Button onClick={onComplete} disabled={completed}>
          {completed ? "Day completed" : "Mark activity complete"}{" "}
          <CheckCircle2 size={16} />
        </Button>
      ) : null}
    </div>
  );
}
