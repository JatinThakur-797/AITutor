import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCode2,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { getErrorMessage } from "../api/client";
import { learningApi } from "../api/learning";
import MentorChat from "../components/MentorChat";
import TaskWorkspace from "../components/TaskWorkspace";
import { Alert, Badge, Button, Card, LoadingScreen } from "../components/UI";

export default function LessonPage() {
  const { goalId, dayNumber } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);
  const [dayCompleted, setDayCompleted] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [content, goals, roadmap] = await Promise.all([
        learningApi.getLesson(goalId, dayNumber),
        learningApi.getGoals(),
        learningApi.getRoadmapDays(goalId),
      ]);
      setLesson(content);
      setGoal(
        (goals || []).find((item) => String(item.goalId) === String(goalId)) ||
          null,
      );
      setDayCompleted(
        Boolean(
          (roadmap?.days || []).find(
            (day) => Number(day.day) === Number(dayNumber),
          )?.completed,
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

  if (loading) return <LoadingScreen label="Preparing your lesson" />;
  if (error && !lesson)
    return (
      <div className="lesson-error">
        <Alert type="error">{error}</Alert>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
        <Button variant="ghost" onClick={() => navigate(`/app/roadmap/${goalId}`)}>
          Back to roadmap
        </Button>
      </div>
    );

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
                pre: ({ children }) => (
                  <pre className="markdown-pre">{children}</pre>
                ),
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
          <div className="lesson-subtopics">
            <div className="eyebrow">COVERED IN THIS LESSON</div>
            <div>
              {(lesson?.subTopics || []).map((topic) => (
                <span key={topic}>
                  <CheckCircle2 size={13} /> {topic}
                </span>
              ))}
            </div>
          </div>
          <div className="task-section" id="practice">
            <div className="task-section-heading">
              <div>
                <div className="eyebrow">APPLY WHAT YOU LEARNED</div>
                <h2>Practice workspace</h2>
                <p>
                  Finish with a short exercise. Your coding draft is saved
                  locally in this browser.
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
              onComplete={finishDay}
              completed={completed}
            />
            <div className="complete-day-row">
              <div>
                <strong>
                  {completed ? "Day marked complete" : "Finished this lesson?"}
                </strong>
                <span>
                  {completed
                    ? "Your progress has been updated."
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
            <Link to={`/roadmap/${goalId}`} className="back-link">
              <ArrowLeft size={15} /> All lessons
            </Link>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(`/lesson/${goalId}/${Number(dayNumber) + 1}`)
              }
            >
              Next day <ArrowRight size={15} />
            </Button>
          </div>
        </main>
        <aside className="lesson-aside">
          {chatVisible ? (
            <MentorChat lessonTitle={title} lessonContent={content} />
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
