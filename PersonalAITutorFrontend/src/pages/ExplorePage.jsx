import { ArrowUpRight, BookOpen, Clock3, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { learningApi } from "../api/learning";
import { Alert, Badge, Card, EmptyState, PageHeading } from "../components/UI";

const colors = [
  "article-violet",
  "article-blue",
  "article-amber",
  "article-green",
];

export default function ExplorePage() {
  const location = useLocation();
  const searchInputRef = useRef(null);
  const [goals, setGoals] = useState([]);
  const [activeGoalId, setActiveGoalId] = useState("");
  const [days, setDays] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (location.state?.focusSearch) {
      searchInputRef.current?.focus();
    }
  }, [location.state]);

  useEffect(() => {
    learningApi
      .getGoals()
      .then((items) => {
        const generated = (items || []).filter(
          (goal) => goal.status === "ROADMAP_GENERATED",
        );
        setGoals(generated);
        if (generated[0]) setActiveGoalId(generated[0].goalId);
        else setLoading(false);
      })
      .catch((err) => {
        setError(getErrorMessage(err, "Unable to load your lesson library."));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!activeGoalId) return;
    setLoading(true);
    learningApi
      .getRoadmapDays(activeGoalId)
      .then((result) => setDays(result?.days || []))
      .catch((err) =>
        setError(getErrorMessage(err, "Unable to load lessons for this path.")),
      )
      .finally(() => setLoading(false));
  }, [activeGoalId]);

  const filtered = useMemo(
    () =>
      days.filter((day) =>
        `${day.main_topic} ${(day.sub_topics || []).join(" ")} ${
          day.daily_goal || ""
        }`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [days, query],
  );

  const activeGoal = goals.find(
    (goal) => String(goal.goalId) === String(activeGoalId),
  );

  return (
    <>
      <PageHeading
        eyebrow="THE LEARNING LIBRARY"
        title="Explore your next concept."
        description="Structured technical articles generated from your curriculum—complete with code examples, practice workspaces, and a lesson-aware AI mentor."
      />
      <Card className="library-search-card">
        <div className="library-search-icon">
          <Search size={20} />
        </div>
        <div className="library-search-copy">
          <strong>Find a topic in your learning path</strong>
          <span>Search lesson titles, subtopics, and learning goals.</span>
        </div>
        <div className="library-search-input">
          <Search size={16} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Java, APIs, OOP…"
          />
        </div>
      </Card>
      {error ? <Alert type="error">{error}</Alert> : null}
      <div className="library-controls">
        <div>
          <div className="eyebrow">YOUR ARTICLE COLLECTION</div>
          <h2>{activeGoal?.goal || "Generated lessons"}</h2>
        </div>
        {goals.length > 1 ? (
          <select
            className="input library-select"
            value={activeGoalId}
            onChange={(e) => setActiveGoalId(e.target.value)}
          >
            {goals.map((goal) => (
              <option key={goal.goalId} value={goal.goalId}>
                {goal.goal}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {loading ? (
        <div className="article-grid">
          {[1, 2, 3].map((v) => (
            <div className="article-skeleton" key={v} />
          ))}
        </div>
      ) : !filtered.length ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={
              days.length ? "No matching lessons" : "Your library is waiting"
            }
            description={
              days.length
                ? "Try a different topic or keyword."
                : "Create a learning path and generate your first week to fill your library with tailored technical lessons."
            }
          />
        </Card>
      ) : (
        <div className="article-grid">
          {filtered.map((day, index) => (
            <Link
              className="article-card"
              to={`/app/lesson/${activeGoalId}/${day.day}`}
              key={day.day}
            >
              <div className={`article-cover ${colors[index % colors.length]}`}>
                <div className="article-cover-top">
                  <span>PATHAI NOTES</span>
                  <BookOpen size={17} />
                </div>
                <div className="article-cover-number">
                  {String(day.day).padStart(2, "0")}
                </div>
                <div className="article-cover-caption">
                  A practical learning guide
                </div>
              </div>
              <div className="article-body">
                <div className="article-meta">
                  <Badge tone={day.completed ? "success" : "info"}>
                    {day.completed ? "Read & completed" : "Lesson"}
                  </Badge>
                  <span>
                    <Clock3 size={13} />{" "}
                    {Math.max(
                      4,
                      Math.round(
                        ((day.main_topic || "").length +
                          (day.sub_topics || []).join("").length) /
                          90,
                      ),
                    )}{" "}
                    min read
                  </span>
                </div>
                <h3>{day.main_topic}</h3>
                <p>
                  {day.daily_goal ||
                    (day.sub_topics || []).join(" · ") ||
                    "Explore the main ideas with clear explanations and practical examples."}
                </p>
                <div className="article-tags">
                  {(day.sub_topics || []).slice(0, 2).map((topic) => (
                    <span key={topic}>{topic}</span>
                  ))}
                </div>
                <div className="article-footer">
                  <span>
                    {day.completed ? "Review article" : "Read lesson"}
                  </span>
                  <ArrowUpRight size={16} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="library-disclaimer">
        <Sparkles size={15} />
        <span>
          Lessons are dynamically synthesized and cached for your active
          learning roadmaps.
        </span>
      </div>
    </>
  );
}
