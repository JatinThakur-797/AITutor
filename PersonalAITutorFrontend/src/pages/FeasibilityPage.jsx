import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  Gauge,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { learningApi } from "../api/learning";
import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeading,
  StatCard,
} from "../components/UI";

export default function FeasibilityPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [result, setResult] = useState(state?.result || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (state?.score == null && !result)
    return (
      <Card>
        <h2>No assessment result found</h2>
        <p>Complete the skill assessment first.</p>
        <Button onClick={() => navigate("/app/start")}>Start assessment</Button>
      </Card>
    );

  const score = state?.score ?? result?.score ?? 0;
  const total = state?.total ?? result?.total ?? 10;
  const assignedLevel =
    state?.assignedLevel || result?.assignedLevel || "Beginner";
  const goal = state?.goal || result?.goal || "Your learning goal";
  const feasibility = result?.feasibility;

  const generate = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await learningApi.checkFeasibility({ score, assignedLevel });
      if (data?.degraded) {
        setError(
          data.message ||
            "The AI feasibility check is temporarily unavailable. Retry before generating your roadmap.",
        );
        return;
      }
      setResult({ score, total, assignedLevel, goal, feasibility: data });
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not complete the feasibility check."),
      );
    } finally {
      setLoading(false);
    }
  };

  const createRoadmap = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await learningApi.generateRoadmap(1, 7);
      if (data?.degraded) {
        setError(
          data.message ||
            "The roadmap generator returned fallback content. Please retry.",
        );
        return;
      }
      const goals = await learningApi.getGoals();
      const latest = [...(goals || [])].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      )[0];
      if (!latest?.goalId)
        throw new Error(
          "The roadmap was generated, but the goal could not be found. Refresh your dashboard.",
        );
      navigate(`/app/roadmap/${latest.goalId}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Could not generate your roadmap."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="STEP 03 · YOUR LEARNING PLAN"
        title="A realistic plan beats a perfect promise."
        description="Review your skill assessment and see how the target fits your available time."
      />
      {!result ? (
        <div className="feasibility-start">
          <Card className="assessment-result-card">
            <div className="result-icon">
              <Gauge size={25} />
            </div>
            <div className="eyebrow">ASSESSMENT COMPLETE</div>
            <h2>
              {score} <span>/ {total}</span>
            </h2>
            <p>
              You were assessed at{" "}
              <Badge tone={assignedLevel === "Advanced" ? "success" : "info"}>
                {assignedLevel}
              </Badge>
            </p>
            <p className="muted">Goal: {goal}</p>
            <Button onClick={generate} loading={loading}>
              Check learning feasibility <ArrowRight size={16} />
            </Button>
          </Card>
          <Card className="result-side-note">
            <Sparkles size={20} />
            <h3>What happens in this step?</h3>
            <p>
              PathAI compares your assessed level, daily study time, and
              duration. It then estimates the learning timeline and sets a
              suitable outcome.
            </p>
          </Card>
        </div>
      ) : (
        <>
          {error ? <Alert type="error">{error}</Alert> : null}
          <Card className="feasibility-hero">
            <div className="feasibility-copy">
              <div className="eyebrow">YOUR FEASIBILITY REPORT</div>
              <h2>
                {feasibility?.isFeasible
                  ? "Your goal looks achievable."
                  : "Your goal needs a more focused plan."}
              </h2>
              <p>
                {feasibility?.reason ||
                  "Your plan has been evaluated against your current level and available time."}
              </p>
              <div className="feasibility-tags">
                <Badge tone={feasibility?.isFeasible ? "success" : "warning"}>
                  {feasibility?.isFeasible ? "Feasible" : "Needs adjustment"}
                </Badge>
                <Badge tone="info">
                  {feasibility?.expectedOutcome || "foundation"} outcome
                </Badge>
              </div>
            </div>
            <div className="feasibility-gauge">
              <div className="gauge-number">
                {feasibility?.estimatedDaysRequired ?? "—"}
                <small>estimated days</small>
              </div>
              <div className="gauge-ring" />
            </div>
          </Card>
          <div className="stats-grid feasibility-stats">
            <StatCard
              icon={CheckCircle2}
              label="Assessment score"
              value={`${score}/${total}`}
              note={`${Math.round((score / total) * 100)}% correct`}
              tone="green"
            />
            <StatCard
              icon={GraduationCapIcon}
              label="Assessed level"
              value={assignedLevel}
              note="Based on quiz performance"
              tone="violet"
            />
            <StatCard
              icon={CalendarDays}
              label="Estimated duration"
              value={`${feasibility?.estimatedDaysRequired ?? "—"} days`}
              note="AI-estimated study days"
              tone="blue"
            />
            <StatCard
              icon={Target}
              label="Target outcome"
              value={feasibility?.expectedOutcome || "—"}
              note="Expected learning result"
              tone="amber"
            />
          </div>
          <Card className="roadmap-ready-card">
            <div className="ready-icon">
              <Compass size={22} />
            </div>
            <div>
              <h3>Ready to turn this into daily action?</h3>
              <p>
                PathAI will generate your first seven days. You can extend the
                roadmap in weekly chunks as you progress.
              </p>
            </div>
            <Button onClick={createRoadmap} loading={loading}>
              Generate my roadmap <ArrowRight size={16} />
            </Button>
          </Card>
        </>
      )}
    </>
  );
}

function GraduationCapIcon() {
  return <Clock3 size={18} />;
}
