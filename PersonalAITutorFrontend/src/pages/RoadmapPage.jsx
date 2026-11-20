import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Lock,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { learningApi } from "../api/learning";
import {
  Alert,
  Badge,
  Button,
  Card,
  LoadingScreen,
  PageHeading,
  ProgressBar,
  SectionTitle,
} from "../components/UI";

export default function RoadmapPage() {
  const { goalId } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const dayRefs = useRef({});

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const [goals, result] = await Promise.all([
          learningApi.getGoals(),
          learningApi.getRoadmapDays(goalId),
        ]);
        setGoal(
          (goals || []).find(
            (item) => String(item.goalId) === String(goalId),
          ) || null,
        );
        const loadedDays = result?.days || [];
        setDays(loadedDays);
        return loadedDays;
      } catch (err) {
        setError(getErrorMessage(err, "Unable to load this roadmap."));
        return [];
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [goalId],
  );

  useEffect(() => {
    load({ silent: false });
  }, [load]);

  const completed = useMemo(
    () => days.filter((day) => day.completed).length,
    [days],
  );
  const percent = days.length ? Math.round((completed / days.length) * 100) : 0;
  const nextDay = days.find((day) => !day.completed);

  const requiredCompleted = Math.ceil(days.length * 0.8);
  const remainingToUnlock = Math.max(0, requiredCompleted - completed);
  const canGenerateNext = days.length === 0 || remainingToUnlock === 0;

  const generateNext = async () => {
    if (!canGenerateNext) return;
    const firstNewDayNumber = days.length + 1;
    setGenerating(true);
    setError("");
    try {
      const response = await learningApi.generateRoadmap(
        firstNewDayNumber,
        7,
        goalId,
      );
      if (response?.degraded) {
        throw new Error(
          response.message ||
            "The AI returned fallback roadmap content. Try again.",
        );
      }
      // Silent reload keeps timeline mounted so scroll never jumps to top
      await load({ silent: true });

      // Smoothly scroll straight to the first newly unlocked day
      requestAnimationFrame(() => {
        const targetEl = dayRefs.current[firstNewDayNumber];
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to extend your roadmap."));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingScreen label="Loading your roadmap" />;

  return (
    <>
      <PageHeading
        eyebrow="YOUR PERSONAL CURRICULUM"
        title={goal?.goal || "Your learning roadmap"}
        description="A sequence of focused lessons, practical work, and milestones. Move at a pace you can sustain."
        action={
          <Button
            variant="secondary"
            onClick={() => load({ silent: true })}
            loading={refreshing}
          >
            <RefreshCw size={15} /> Refresh
          </Button>
        }
      />
      {error ? <Alert type="error">{error}</Alert> : null}
      <Card className="roadmap-summary">
        <div className="roadmap-summary-main">
          <div className="roadmap-summary-icon">
            <Target size={22} />
          </div>
          <div>
            <Badge tone="success">Active learning path</Badge>
            <h2>{goal?.goal || "Learning journey"}</h2>
            <p>
              {goal?.currentLevel || "Starting level"}{" "}
              <span className="dot-separator">·</span> {goal?.duration || "—"}{" "}
              month target <span className="dot-separator">·</span>{" "}
              {goal?.timePerDay || "—"} hours/day
              {goal?.estimatedDaysRequired ? (
                <>
                  {" "}
                  <span className="dot-separator">·</span>{" "}
                  {goal.estimatedDaysRequired}-day total plan
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="roadmap-summary-progress">
          <div>
            <strong>{percent}%</strong>
            <span>
              {completed} / {days.length} lessons done
            </span>
          </div>
          <ProgressBar value={percent} />
        </div>
      </Card>

      {nextDay ? (
        <Card className="roadmap-next">
          <div className="next-badge">
            <BookOpen size={17} />
          </div>
          <div className="roadmap-next-copy">
            <div className="eyebrow">NEXT UP · DAY {nextDay.day}</div>
            <h3>{nextDay.main_topic}</h3>
            <p>
              {nextDay.daily_goal || "Continue with your next focused lesson."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/app/lesson/${goalId}/${nextDay.day}`)}
          >
            Start lesson <ArrowRight size={15} />
          </Button>
        </Card>
      ) : null}

      <SectionTitle
        title="Your curriculum"
        subtitle={`${days.length} generated days · complete 80% (${requiredCompleted}/${days.length}) to unlock the next seven-day block.`}
      />
      {days.length ? (
        <div className="roadmap-timeline">
          {days.map((day, index) => (
            <article
              ref={(el) => {
                dayRefs.current[day.day] = el;
              }}
              className={`roadmap-day ${day.completed ? "day-complete" : ""} ${
                nextDay?.day === day.day ? "day-next" : ""
              }`}
              key={day.day}
            >
              <div className="day-rail">
                <div className="day-node">
                  {day.completed ? (
                    <Check size={16} />
                  ) : (
                    String(day.day).padStart(2, "0")
                  )}
                </div>
                {index < days.length - 1 ? <div className="day-line" /> : null}
              </div>
              <div className="roadmap-day-card">
                <div className="roadmap-day-top">
                  <div>
                    <div className="eyebrow">DAY {day.day}</div>
                    <h3>{day.main_topic}</h3>
                  </div>
                  {day.completed ? (
                    <Badge tone="success">Completed</Badge>
                  ) : nextDay?.day === day.day ? (
                    <Badge tone="info">Up next</Badge>
                  ) : (
                    <Badge>Planned</Badge>
                  )}
                </div>
                <p>
                  {day.daily_goal ||
                    "Build understanding through a focused lesson and practice."}
                </p>
                <div className="day-subtopics">
                  {(day.sub_topics || []).slice(0, 4).map((topic) => (
                    <span key={topic}>{topic}</span>
                  ))}
                </div>
                <div className="roadmap-day-bottom">
                  <div className="day-time">
                    <span>
                      <Clock3 size={13} /> Theory:{" "}
                      {day.hours_allocation?.theory || "—"}
                    </span>
                    <span>
                      Practice: {day.hours_allocation?.practice || "—"}
                    </span>
                  </div>
                  <Link
                    to={`/app/lesson/${goalId}/${day.day}`}
                    className="text-link"
                  >
                    {day.completed ? "Review lesson" : "Open lesson"}{" "}
                    <ChevronRight size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card>
          <div className="empty-state">
            <div className="empty-icon">
              <CalendarDays size={24} />
            </div>
            <h3>No roadmap days yet</h3>
            <p>Generate your first week to start learning.</p>
            <Button onClick={generateNext} loading={generating}>
              Generate first 7 days <Plus size={15} />
            </Button>
          </div>
        </Card>
      )}

      {days.length > 0 ? (
        <Card className="roadmap-extend">
          <div className="extend-icon">
            {canGenerateNext ? <Plus size={19} /> : <Lock size={19} />}
          </div>
          <div>
            <h3>
              {canGenerateNext
                ? `Days ${days.length + 1}–${days.length + 7} unlocked`
                : `Unlock Days ${days.length + 1}–${days.length + 7}`}
            </h3>
            <p>
              {canGenerateNext
                ? "You have met the 80% mastery threshold. Generate your next seven days tailored to your completed topics."
                : `Complete ${remainingToUnlock} more lesson${
                    remainingToUnlock === 1 ? "" : "s"
                  } (${percent}% / 80% completed) to unlock the next weekly block.`}
            </p>
          </div>
          <Button
            variant={canGenerateNext ? "primary" : "secondary"}
            onClick={generateNext}
            loading={generating}
            disabled={!canGenerateNext || generating}
          >
            {canGenerateNext ? (
              <>
                <Plus size={16} /> Generate next 7 days
              </>
            ) : (
              <>
                <Lock size={15} /> {remainingToUnlock} left to unlock
              </>
            )}
          </Button>
        </Card>
      ) : null}
    </>
  );
}
