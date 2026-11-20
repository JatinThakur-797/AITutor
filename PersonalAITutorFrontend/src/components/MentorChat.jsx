import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  LoaderCircle,
  Send,
  Sparkles,
  StopCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getErrorMessage } from "../api/client";
import { learningApi } from "../api/learning";
import { Button } from "./UI";

const QUICK_PROMPTS = [
  "Explain this simply",
  "Give a real-world example",
  "Compare key concepts in a table",
];

const EMPTY_STRUCTURED = {
  reply: "",
  codeLanguage: "",
  code: "",
  table: { headers: [], rows: [] },
};

const INITIAL_MESSAGE = {
  role: "assistant",
  structured: {
    ...EMPTY_STRUCTURED,
    reply:
      "Hi! I have this lesson as context. Ask me to explain a concept, share a code example, or compare topics.",
  },
};

const COMMON_WORDS = [
  "this", "that", "with", "from", "have", "will", "your", "what", "when", "where",
  "which", "their", "there", "these", "those", "into", "onto", "upon", "over", "under",
  "after", "before", "between", "through", "during", "without", "within", "about",
  "here", "is", "are", "was", "were", "be", "been", "being", "has", "had", "do", "does",
  "did", "can", "could", "should", "would", "may", "might", "must", "shall",
  "a", "an", "the", "and", "or", "but", "if", "so", "as", "at", "by", "for", "in", "of",
  "on", "to", "up", "it", "its", "no", "not", "all", "any", "both", "each", "few",
  "more", "most", "other", "some", "such", "only", "own", "same", "than", "too", "very",
  "just", "also", "then", "than", "because", "while", "whereas", "although", "however",
  "concise", "comparison", "of", "key", "java", "core", "concepts", "the", "table",
  "below", "shows", "how", "primitive", "data", "types", "reference", "type",
  "inference", "with", "var", "and", "operators", "differ", "in", "definition",
  "size", "range", "nullability", "scope", "examples", "use", "matrix", "to",
  "remember", "main", "distinctions", "common", "pitfalls", "basic", "built",
  "hold", "values", "directly", "objects", "stored", "on", "heap", "referenced",
  "variable", "compiler", "infers", "local", "initializer", "symbols", "perform",
  "operations", "variables", "fixed", "sizes", "for", "numeric", "depends", "object",
  "inferred", "same", "arithmetic", "relational", "logical", "assignment", "unary",
  "cannot", "null", "always", "value", "meaning", "non", "nullable", "produce",
  "appropriate", "field", "parameter", "class", "level", "allowed", "inside",
  "methods", "blocks", "used", "wherever", "expressions", "string", "hello",
];

function splitRunOnWords(token) {
  // Keep code/operators/punctuation tokens untouched if they contain code syntax
  if (!/^[A-Za-z\-‑]{12,}$/.test(token)) return token;

  const clean = token.replace(/[‑–—]/g, "-");
  const lower = clean.toLowerCase();

  // Dynamic programming word segmentation using dictionary + greedy fallback
  const n = lower.length;
  const dp = Array(n + 1).fill(Infinity);
  const splitAt = Array(n + 1).fill(-1);
  dp[0] = 0;

  const wordSet = new Set(COMMON_WORDS);

  for (let i = 0; i < n; i++) {
    if (dp[i] === Infinity) continue;
    for (let j = i + 1; j <= Math.min(n, i + 18); j++) {
      const sub = lower.slice(i, j);
      if (wordSet.has(sub)) {
        const cost = dp[i] + 1;
        if (cost < dp[j]) {
          dp[j] = cost;
          splitAt[j] = i;
        }
      }
    }
  }

  if (dp[n] !== Infinity) {
    const parts = [];
    let cur = n;
    while (cur > 0) {
      const prev = splitAt[cur];
      parts.push(clean.slice(prev, cur));
      cur = prev;
    }
    return parts.reverse().join(" ");
  }

  // Fallback: break camelCase or long lowercase runs every ~7 chars
  return clean
    .replace(/([a-z]{2,})([A-Z])/g, "$1 $2")
    .replace(/([a-z]{8})(?=[a-z]{4,})/g, "$1 ");
}

function restoreSpaces(text) {
  if (!text) return "";
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : splitRunOnWords(part)))
    .join("");
}

function extractPseudoTable(raw) {
  const tableIdx = raw.indexOf("table");
  if (tableIdx === -1) return { headers: [], rows: [] };

  const headersMatch = raw.match(/"?headers"?\s*:?\s*\[([\s\S]*?)\]/i);
  const rowsMatch = raw.match(/"?rows"?\s*:?\s*\[([\s\S]*)\]\s*\}?\s*$/i);

  const headers = headersMatch
    ? headersMatch[1]
        .split(",")
        .map((h) => restoreSpaces(h.replace(/^["'\s]+|["'\s]+$/g, "")))
        .filter(Boolean)
    : [];

  let rows = [];
  if (rowsMatch) {
    const inner = rowsMatch[1].trim();
    const rowBlocks = [...inner.matchAll(/\[([\s\S]*?)\]/g)].map((m) => m[1]);
    rows = rowBlocks.map((block) => {
      const cleaned = block.trim().replace(/^["']|["']$/g, "");
      const cols = headers.length > 0 ? cleaned.split(",") : [cleaned];
      return cols.map((c) => restoreSpaces(c.replace(/^["'\s]+|["'\s]+$/g, "")));
    });
  }

  return { headers, rows };
}

function parseMentorResponse(rawText) {
  const text = (rawText || "").trim();
  if (!text) return { ...EMPTY_STRUCTURED };

  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 1. Try standard JSON first
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = stripped.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      const headers = Array.isArray(parsed?.table?.headers)
        ? parsed.table.headers.map((h) => restoreSpaces(String(h)))
        : [];
      const rows = Array.isArray(parsed?.table?.rows)
        ? parsed.table.rows.map((r) =>
            Array.isArray(r) ? r.map((c) => restoreSpaces(String(c))) : [],
          )
        : [];

      return {
        reply: restoreSpaces(String(parsed?.reply || "")).trim(),
        codeLanguage: String(parsed?.codeLanguage || parsed?.["code Language"] || "").trim(),
        code: String(parsed?.code || ""),
        table: { headers, rows },
      };
    } catch {
      // Fall through to pseudo-JSON recovery below
    }
  }

  // 2. Recover from malformed pseudo-JSON like {"reply:...","code Language":"","code":"","table:{headers:[...
  const replyMatch = stripped.match(
    /"?reply"?\s*:?\s*"?([\s\S]*?)"?\s*,\s*"?code\s*Language"?/i,
  );
  const codeLangMatch = stripped.match(
    /"?code\s*Language"?\s*:?\s*"?([^",}]*)"?\s*,/i,
  );
  const codeMatch = stripped.match(
    /"?code"?\s*:?\s*"?([\s\S]*?)"?\s*,\s*"?table"?/i,
  );

  if (replyMatch || codeMatch || stripped.includes("table")) {
    const rawReply = replyMatch ? replyMatch[1] : "";
    const rawLang = codeLangMatch ? codeLangMatch[1] : "";
    const rawCode = codeMatch ? codeMatch[1] : "";
    const table = extractPseudoTable(stripped);

    return {
      reply: restoreSpaces(rawReply).trim(),
      codeLanguage: rawLang.trim(),
      code: rawCode.trim(),
      table,
    };
  }

  // 3. Plain text / markdown fallback
  return {
    ...EMPTY_STRUCTURED,
    reply: restoreSpaces(text),
  };
}

function MentorStructuredBubble({ structured }) {
  const [copied, setCopied] = useState(false);

  const reply = structured?.reply || "";
  const code = structured?.code || "";
  const codeLanguage = structured?.codeLanguage || "code";
  const hasCode = code.trim().length > 0;

  const headers = Array.isArray(structured?.table?.headers)
    ? structured.table.headers
    : [];
  const rows = Array.isArray(structured?.table?.rows) ? structured.table.rows : [];
  const hasTable = headers.length > 0 && rows.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="mentor-structured">
      {reply ? (
        <div className="mentor-reply-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{reply}</ReactMarkdown>
        </div>
      ) : null}

      {hasCode ? (
        <div className="mentor-code-block">
          <div className="mentor-code-head">
            <span>{codeLanguage}</span>
            <button type="button" onClick={handleCopy}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      ) : null}

      {hasTable ? (
        <div className="mentor-table-wrap">
          <table className="mentor-real-table">
            <thead>
              <tr>
                {headers.map((col, idx) => (
                  <th key={`${col}-${idx}`}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {headers.map((_, cIdx) => (
                    <td key={cIdx}>{row[cIdx] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function MentorChat({
  lessonTitle,
  lessonContent,
  externalPrompt,
}) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [minimized, setMinimized] = useState(false);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const lastExternalIdRef = useRef(null);

  useEffect(() => {
    setMessages([INITIAL_MESSAGE]);
    setError("");
  }, [lessonTitle]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessageText = useCallback(
    async (rawText) => {
      const text = rawText.trim();
      if (!text || loading) return;

      setMinimized(false);
      setInput("");
      setError("");
      setLoading(true);

      const payload = {
        message: text,
        lessonTitle,
        lessonContent: (lessonContent || "").slice(0, 12000),
      };

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        {
          role: "assistant",
          rawStream: "",
          structured: { ...EMPTY_STRUCTURED },
        },
      ]);

      try {
        const controller = new AbortController();
        abortRef.current = controller;
        let receivedAnyToken = false;

        await learningApi.streamMentor(payload, {
          signal: controller.signal,
          onToken: (token) => {
            if (token === undefined || token === null) return;
            receivedAnyToken = true;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy.length - 1;
              if (copy[last]?.role === "assistant") {
                const nextRaw = (copy[last].rawStream || "") + String(token);
                copy[last] = {
                  ...copy[last],
                  rawStream: nextRaw,
                  structured: parseMentorResponse(nextRaw),
                };
              }
              return copy;
            });
          },
        });

        if (!receivedAnyToken) {
          throw new Error("Empty stream response");
        }
      } catch (err) {
        if (err.name === "AbortError") {
          setMessages((prev) => {
            const copy = [...prev];
            const i = copy.length - 1;
            if (copy[i]?.role === "assistant") {
              const cur = copy[i].structured || { ...EMPTY_STRUCTURED };
              copy[i] = {
                ...copy[i],
                structured: {
                  ...cur,
                  reply: `${cur.reply}\n\n*Response stopped.*`.trim(),
                },
              };
            }
            return copy;
          });
        } else {
          try {
            const result = await learningApi.askMentor(payload);
            const answer =
              result?.response ||
              "The mentor returned an empty response. Please try again.";
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = {
                role: "assistant",
                structured: parseMentorResponse(answer),
              };
              return copy;
            });
          } catch (fallbackErr) {
            const message = getErrorMessage(
              fallbackErr,
              "The mentor could not respond.",
            );
            setError(message);
            setMessages((prev) => {
              const copy = [...prev];
              const i = copy.length - 1;
              if (copy[i]?.role === "assistant") {
                copy[i] = {
                  ...copy[i],
                  structured: {
                    ...EMPTY_STRUCTURED,
                    reply:
                      "I could not complete that response. Please try again.",
                  },
                };
              }
              return copy;
            });
          }
        }
      } finally {
        abortRef.current = null;
        setLoading(false);
      }
    },
    [lessonTitle, lessonContent, loading],
  );

  useEffect(() => {
    if (
      externalPrompt?.id &&
      externalPrompt.id !== lastExternalIdRef.current &&
      externalPrompt.text
    ) {
      lastExternalIdRef.current = externalPrompt.id;
      sendMessageText(externalPrompt.text);
    }
  }, [externalPrompt, sendMessageText]);

  const send = (event) => {
    event.preventDefault();
    sendMessageText(input);
  };

  return (
    <section className={`mentor-panel ${minimized ? "mentor-minimized" : ""}`}>
      <div className="mentor-header">
        <div className="mentor-avatar">
          <Bot size={18} />
        </div>
        <div className="mentor-header-copy">
          <strong>AI study mentor</strong>
          <span>
            <i /> Lesson-aware assistant
          </span>
        </div>
        <button
          className="icon-btn"
          onClick={() => setMinimized((v) => !v)}
          title={minimized ? "Expand chat" : "Minimize chat"}
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {!minimized ? (
        <>
          <div className="mentor-context">
            <Sparkles size={14} />
            <span>
              Context: <strong>{lessonTitle || "Current lesson"}</strong>
            </span>
          </div>

          <div className="mentor-messages">
            {messages.map((message, index) => (
              <div
                className={`mentor-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                <div className="message-label">
                  {message.role === "user" ? "YOU" : "PATHAI MENTOR"}
                </div>
                <div className="message-bubble">
                  {message.role === "assistant" ? (
                    <MentorStructuredBubble structured={message.structured} />
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="mentor-thinking">
                <LoaderCircle size={14} className="spin" /> Thinking…
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {messages.length <= 2 && !loading ? (
            <div className="mentor-quick-prompts">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessageText(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          {error ? <div className="mentor-error">{error}</div> : null}

          <form className="mentor-form" onSubmit={send}>
            <textarea
              rows="2"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this lesson…"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(e);
                }
              }}
            />
            <div className="mentor-form-bottom">
              <span>Enter to send · Shift + Enter for new line</span>
              {loading ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => abortRef.current?.abort()}
                >
                  <StopCircle size={14} /> Stop
                </Button>
              ) : (
                <Button type="submit" size="sm" disabled={!input.trim()}>
                  <Send size={14} /> Send
                </Button>
              )}
            </div>
          </form>
        </>
      ) : null}
    </section>
  );
}