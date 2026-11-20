import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  ExternalLink,
  FileCode2,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import mermaid from "mermaid";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { getErrorMessage } from "../api/client";
import { learningApi } from "../api/learning";
import MentorChat from "../components/MentorChat";
import TaskWorkspace from "../components/TaskWorkspace";
import { Alert, Badge, Button, Card, LoadingScreen } from "../components/UI";
import { useTheme } from "../context/ThemeContext";

function sanitizeMermaidChart(raw) {
  return raw
    .trim()
    .replace(/\[([^\]]+)\]/g, (_, label) => {
      const stripped = label
        .trim()
        .replace(/^"+|"+$/g, "")
        .replace(/"/g, "'");
      return `["${stripped}"]`;
    })
    .replace(/(?<!\{)\{([^{}]+)\}(?!\})/g, (_, label) => {
      const stripped = label
        .trim()
        .replace(/^"+|"+$/g, "")
        .replace(/"/g, "'");
      return `{"${stripped}"}`;
    });
}

function MermaidBlock({ chart }) {
  const { theme } = useTheme();
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);

    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      securityLevel: "loose",
      theme: theme === "light" ? "default" : "dark",
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
    });

    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
    const sanitized = sanitizeMermaidChart(chart);

    (async () => {
      try {
        await mermaid.parse(sanitized);
        const { svg: rendered } = await mermaid.render(id, sanitized);
        if (!active) return;
        if (rendered.includes("Syntax error in text")) {
          setFailed(true);
        } else {
          setSvg(rendered);
        }
      } catch {
        if (active) {
          setSvg("");
          setFailed(true);
        }
      } finally {
        document.getElementById(`d${id}`)?.remove();
      }
    })();

    return () => {
      active = false;
    };
  }, [chart, theme]);

  if (failed) {
    return (
      <pre className="markdown-pre">
        <code>{chart}</code>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="mermaid-diagram-wrap">
        <span className="muted small">Rendering diagram…</span>
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram-wrap"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function extractText(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node?.props?.children) return extractText(node.props.children);
  return "";
}

function MarkdownPre({ children }) {
  const [copied, setCopied] = useState(false);
  const codeText = extractText(children);
  const className = children?.props?.className || "";
  const trimmed = codeText.trim();

  const isMermaid =
    className.includes("language-mermaid") ||
    /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram)\b/.test(
      trimmed,
    );

  if (isMermaid) {
    return <MermaidBlock chart={trimmed} />;
  }

  const handleCopy = async () => {
    if (!codeText) return;
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="markdown-pre-wrap">
      <button
        type="button"
        className="code-copy-btn"
        onClick={handleCopy}
        title="Copy code snippet"
      >
        {copied ? <Check size={13} /> : <Clipboard size={13} />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <pre className="markdown-pre">{children}</pre>
    </div>
  );
}

function buildFiveLessonResources(lesson, taskData, goalTitle, lessonTitle) {
  const backendResources = lesson?.resources || taskData?.resources || [];

  const validBackend = Array.isArray(backendResources)
    ? backendResources
        .filter((item) => item?.url && String(item.url).startsWith("https://"))
        .map((item, idx) => {
          const url = String(item.url);
          const isVideo =
            String(item.type || "").toUpperCase() === "VIDEO" ||
            url.includes("youtube.com") ||
            url.includes("youtu.be");
          return {
            id: `backend-${idx}`,
            isVideo,
            title: item.title || `${lessonTitle} Resource`,
            href: url,
          };
        })
    : [];

  const videos = validBackend.filter((r) => r.isVideo).slice(0, 3);
  const docs = validBackend.filter((r) => !r.isVideo).slice(0, 2);

  const safeGoal = (goalTitle || "").trim();
  const safeLesson = (lessonTitle || "Lesson").trim();
  const subTopic = ((lesson?.subTopics || [])[0] || safeLesson).trim();
  const topicPrefix = safeGoal ? `${safeGoal} ${safeLesson}` : safeLesson;
  const subTopicPrefix = safeGoal ? `${safeGoal} ${subTopic}` : subTopic;

  const fallbackVideos = [
    {
      title: `Watch: ${safeLesson} — Complete Tutorial`,
      href: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${topicPrefix} tutorial`,
      )}`,
    },
    {
      title: `Watch: ${subTopic} — Step-by-Step Guide`,
      href: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${subTopicPrefix} explained`,
      )}`,
    },
    {
      title: `Watch: ${safeLesson} — Practical Examples`,
      href: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${topicPrefix} practical examples`,
      )}`,
    },
  ];

  let vIdx = 0;
  while (videos.length < 3 && vIdx < fallbackVideos.length) {
    videos.push({
      id: `fallback-v-${vIdx}`,
      isVideo: true,
      ...fallbackVideos[vIdx],
    });
    vIdx++;
  }

  const fallbackDocs = [
    {
      title: `Read: ${safeLesson} — Reference Guide`,
      href: `https://www.google.com/search?q=${encodeURIComponent(
        `${topicPrefix} guide documentation`,
      )}`,
    },
    {
      title: `Read: ${subTopic} — Concepts & Best Practices`,
      href: `https://www.google.com/search?q=${encodeURIComponent(
        `${subTopicPrefix} best practices`,
      )}`,
    },
  ];

  let dIdx = 0;
  while (docs.length < 2 && dIdx < fallbackDocs.length) {
    docs.push({
      id: `fallback-d-${dIdx}`,
      isVideo: false,
      ...fallbackDocs[dIdx],
    });
    dIdx++;
  }

  return [...videos, ...docs];
}

export default function LessonPage() {
  const { goalId, dayNumber } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [goal, setGoal] = useState(null);
  const [totalDays, setTotalDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);
  const [dayCompleted, setDayCompleted] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [mentorDraft, setMentorDraft] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [content, goals, roadmap] = await Promise.all([
        learningApi.getLesson(goalId, dayNumber),
        learningApi.getGoals(),
        learningApi.getRoadmapDays(goalId),
      ]);
      const daysList = roadmap?.days || [];
      setLesson(content);
      setTotalDays(daysList.length);
      setGoal(
        (goals || []).find((item) => String(item.goalId) === String(goalId)) ||
          null,
      );
      setDayCompleted(
        Boolean(
          daysList.find((day) => Number(day.day) === Number(dayNumber))
            ?.completed,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Could not load this lesson."));
    } finally {
      setLoading(false);
    }
  }, [goalId, dayNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const completed =
    dayCompleted || Boolean(lesson?.completed || lesson?.isCompleted);
  const content = lesson?.content || lesson?.lesson || "";
  const title = lesson?.title || `Day ${dayNumber} lesson`;
  const readMinutes = Math.max(
    5,
    Math.ceil(content.trim().split(/\s+/).length / 190),
  );
  const taskData = lesson?.taskData || lesson?.task?.content || {};
  const taskType = lesson?.taskType || lesson?.task?.type || "ACTIVITY";
  const hasNextDay = totalDays > 0 && Number(dayNumber) < totalDays;
  const resources = buildFiveLessonResources(
    lesson,
    taskData,
    goal?.goal,
    title,
  );

  const finishDay = async () => {
    setMarking(true);
    setError("");
    try {
      await learningApi.completeDay(goalId, dayNumber);
      setDayCompleted(true);
    } catch (err) {
      setError(getErrorMessage(err, "Could not mark this day complete."));
    } finally {
      setMarking(false);
    }
  };

  const handleAskMentorAboutCode = (codeSnippet, language) => {
    setChatVisible(true);
    setMentorDraft({
      id: Date.now(),
      text: `Can you review my ${language} solution for today's practice task and suggest improvements?\n\n\`\`\`${language}\n${codeSnippet}\n\`\`\``,
    });
  };

  if (loading) return <LoadingScreen label="Preparing your lesson" />;
  if (error && !lesson) {
    return (
      <div className="lesson-error">
        <Alert type="error">{error}</Alert>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate(`/app/roadmap/${goalId}`)}
        >
          Back to roadmap
        </Button>
      </div>
    );
  }

  return (
    <div className="lesson-page">
      <div className="lesson-toolbar">
        <Link to={`/app/roadmap/${goalId}`} className="back-link">
          <ArrowLeft size={15} /> Back to roadmap
        </Link>
        <div className="lesson-toolbar-right">
          <span>
            <Clock3 size={14} /> {readMinutes} min read
          </span>
          <span className="toolbar-separator" />
          <button
            className={`lesson-chat-toggle ${chatVisible ? "enabled" : ""}`}
            onClick={() => setChatVisible((v) => !v)}
          >
            {chatVisible ? (
              <PanelRightClose size={15} />
            ) : (
              <PanelRightOpen size={15} />
            )}{" "}
            Mentor
          </button>
        </div>
      </div>

      {error ? <Alert type="error">{error}</Alert> : null}

      <div className={`lesson-layout ${chatVisible ? "" : "lesson-no-chat"}`}>
        <main className="lesson-main">
          <div className="lesson-article-head">
            <div className="eyebrow">
              {goal?.goal || "YOUR LEARNING PATH"} · DAY {dayNumber}
            </div>
            <h1>{title}</h1>
            <p className="lesson-lede">
              {(lesson?.subTopics || []).join(" · ") ||
                "A focused technical lesson with practical examples."}
            </p>
            <div className="lesson-author-row">
              <div className="lesson-author-avatar">
                <Sparkles size={15} />
              </div>
              <div>
                <strong>PathAI Learning Notes</strong>
                <span>Personalized for your learning goal</span>
              </div>
              {lesson?.isFallback || lesson?.degraded ? (
                <Badge tone="warning">Fallback content</Badge>
              ) : (
                <Badge tone="success">Generated for you</Badge>
              )}
            </div>

            {resources.length > 0 ? (
              <div className="lesson-top-resources">
                <span className="resources-label">
                  Top 3 Videos &amp; 2 Docs:
                </span>
                <div className="resources-link-list">
                  {resources.map((res) => (
                    <a
                      key={res.id}
                      href={res.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`simple-resource-link ${
                        res.isVideo ? "is-video" : "is-doc"
                      }`}
                    >
                      {res.isVideo ? (
                        <PlayCircle size={14} />
                      ) : (
                        <BookOpen size={14} />
                      )}
                      <span>{res.title}</span>
                      <ExternalLink size={12} />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {lesson?.isFallback || lesson?.degraded ? (
            <div className="fallback-note">
              <Sparkles size={16} />
              <span>
                This lesson is currently using fallback content. You can still
                study it, but the AI-generated version may be available after
                retrying.
              </span>
            </div>
          ) : null}

          <article className="markdown-article">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1>{children}</h1>,
                h2: ({ children }) => <h2>{children}</h2>,
                h3: ({ children }) => <h3>{children}</h3>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
                pre: ({ children }) => <MarkdownPre>{children}</MarkdownPre>,
                code: ({ className, children, ...props }) => (
                  <code className={className || "inline-code"} {...props}>
                    {children}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote>{children}</blockquote>
                ),
                table: ({ children }) => (
                  <div className="markdown-table-wrap">
                    <table>{children}</table>
                  </div>
                ),
              }}
            >
              {content ||
                "# Lesson unavailable\n\nNo lesson content was returned for this day. Try refreshing the page."}
            </ReactMarkdown>
          </article>

          {(lesson?.subTopics || []).length > 0 ? (
            <div className="lesson-subtopics">
              <div className="eyebrow">COVERED IN THIS LESSON</div>
              <div>
                {lesson.subTopics.map((topic) => (
                  <span key={topic}>
                    <CheckCircle2 size={13} /> {topic}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="task-section" id="practice">
            <div className="task-section-heading">
              <div>
                <div className="eyebrow">APPLY WHAT YOU LEARNED</div>
                <h2>Practice workspace</h2>
                <p>
                  Reinforce today's lesson with an interactive exercise. Your
                  work saves automatically in this browser.
                </p>
              </div>
              <div className="task-heading-icon">
                <FileCode2 size={20} />
              </div>
            </div>

            <TaskWorkspace
              taskType={taskType}
              taskData={taskData}
              goalId={goalId}
              dayNumber={dayNumber}
              goalTitle={goal?.goal}
              lessonTitle={title}
              onComplete={finishDay}
              completed={completed}
              onReviewCode={handleAskMentorAboutCode}
            />

            <div className="complete-day-row">
              <div>
                <strong>
                  {completed ? "Day marked complete" : "Finished this lesson?"}
                </strong>
                <span>
                  {completed
                    ? "Your roadmap progress has been updated."
                    : "Mark this day complete when you are comfortable with the material."}
                </span>
              </div>
              <Button
                onClick={finishDay}
                loading={marking}
                disabled={completed}
              >
                {completed ? (
                  <>
                    <CheckCircle2 size={16} /> Completed
                  </>
                ) : (
                  <>
                    Complete day <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="lesson-bottom-nav">
            <Link to={`/app/roadmap/${goalId}`} className="back-link">
              <ArrowLeft size={15} /> All lessons
            </Link>
            {hasNextDay ? (
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(`/app/lesson/${goalId}/${Number(dayNumber) + 1}`)
                }
              >
                Next day (Day {Number(dayNumber) + 1}) <ArrowRight size={15} />
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => navigate(`/app/roadmap/${goalId}`)}
              >
                Back to roadmap <ArrowRight size={15} />
              </Button>
            )}
          </div>
        </main>

        <aside className="lesson-aside">
          {chatVisible ? (
            <MentorChat
              lessonTitle={title}
              lessonContent={content}
              externalPrompt={mentorDraft}
            />
          ) : (
            <Card className="mentor-closed-card">
              <div className="mentor-closed-icon">
                <MessageCircle size={22} />
              </div>
              <h3>Need a hand?</h3>
              <p>Open the AI mentor to ask questions about this lesson.</p>
              <Button size="sm" onClick={() => setChatVisible(true)}>
                Open mentor
              </Button>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
