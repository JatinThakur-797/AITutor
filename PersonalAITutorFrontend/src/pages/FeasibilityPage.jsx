import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  Clock3,
  Sparkles,
  Target
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { learningApi } from "../api/learning";
import { Alert, Badge, Button, Card } from "../components/UI";

const FEASIBILITY_STORAGE_KEY = "pathai-latest-assessment";

function readStoredAssessment() {
  try {
    const raw = sessionStorage.getItem(FEASIBILITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function FeasibilityPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const stored = readStoredAssessment();
  const goalId = location.state?.goalId || stored?.goalId;
  const goalTitle =
    location.state?.goalTitle || stored?.goalTitle || "Your Learning Goal";
  const feasibility = location.state?.feasibility || stored?.feasibility;
  const quizSummary = location.state?.quizSummary || stored?.quizSummary;

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  if (!goalId || !feasibility) {
    return (
      <div className="feasibility-page">
        <Card className="empty-state">
          <div className="empty-icon">
            <Target size={24} />
          </div>
          <h3>No assessment result found</h3>
          <p>
            Complete the skill assessment first to see your feasibility report.
          </p>
          <div className="feasibility-empty-actions">
            <Button onClick={() => navigate("/app/start")}>
              Start assessment <ArrowRight size={16} />
            </Button>
            <Link to="/" className="back-link">
              <ArrowLeft size={15} /> Back to home
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const isFeasible = Boolean(feasibility.isFeasible ?? feasibility.feasible);
  const estimatedDays = feasibility.estimatedDaysRequired ?? 30;
  const expectedOutcome = feasibility.expectedOutcome || "foundation";
  const reason =
    feasibility.reason ||
    "Your roadmap pacing has been calibrated to your assessed skill level and daily study hours.";

  const score = quizSummary?.score ?? 0;
  const total = quizSummary?.total ?? 10;
  const assignedLevel = quizSummary?.assignedLevel || "Beginner";

  const handleGenerateRoadmap = async () => {
    setGenerating(true);
    setError("");
    try {
      await learningApi.generateRoadmap(1,7,goalId);
      navigate(`/app/roadmap/${goalId}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not generate your roadmap."));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="feasibility-page">
      <div className="page-heading">
        <div>
          <Link to="/app/start" className="back-link">
            <ArrowLeft size={15} /> Retake assessment
          </Link>
          <div className="eyebrow" style={{ marginTop: 10 }}>
            STEP 2 OF 3 · FEASIBILITY &amp; PACING ANALYSIS
          </div>
          <h1>{goalTitle}</h1>
          <p>
            Based on your diagnostic quiz and daily availability, here is your
            realistic learning plan.
          </p>
        </div>
        <div className="page-heading-action">
          <Button variant="secondary" onClick={() => navigate("/app/start")}>
            Adjust goal or hours
          </Button>
        </div>
      </div>

      {error ? <Alert type="error">{error}</Alert> : null}

      <div className="feasibility-start">
        <Card className="assessment-result-card">
          <div className="result-icon">
            <Award size={26} />
          </div>
          <div className="eyebrow">DIAGNOSTIC SCORE</div>
          <h2>
            {score} <span>/ {total}</span>
          </h2>
          <p>
            Starting Level:{" "}
            <Badge tone={assignedLevel === "Advanced" ? "success" : "info"}>
              {assignedLevel}
            </Badge>
          </p>
        </Card>

        <Card className="result-side-note">
          <Sparkles size={20} />
          <h3>Pacing Calibration</h3>
          <p>
            Your daily hours and current baseline are factored into your
            estimated timeline before generating day-by-day milestones.
          </p>
        </Card>
      </div>

      <Card className="feasibility-hero" style={{ marginTop: 15 }}>
        <div className="feasibility-copy">
          <div className="eyebrow">FEASIBILITY VERDICT</div>
          <h2>
            {isFeasible
              ? "Timeline is realistic"
              : "Ambitious timeline detected"}
          </h2>
          <p>{reason}</p>
          <div className="feasibility-tags">
            <Badge tone={isFeasible ? "success" : "warning"}>
              {isFeasible ? "Feasible" : "Fast-Track Mode"}
            </Badge>
            <Badge tone="info">{expectedOutcome}</Badge>
          </div>
        </div>

        <div className="feasibility-gauge">
          <div className="gauge-ring" />
          <div className="gauge-number">
            {estimatedDays}
            <small>EST. DAYS</small>
          </div>
        </div>
      </Card>

      <div className="stats-grid feasibility-stats">
        <div className="stat-card">
          <div className="stat-icon tone-violet">
            <Calendar size={18} />
          </div>
          <div>
            <div className="stat-label">Estimated Duration</div>
            <div className="stat-value">{estimatedDays} days</div>
            <div className="stat-note">Target completion window</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon tone-blue">
            <Target size={18} />
          </div>
          <div>
            <div className="stat-label">Expected Outcome</div>
            <div className="stat-value" style={{ textTransform: "capitalize" }}>
              {expectedOutcome}
            </div>
            <div className="stat-note">Milestone depth</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon tone-green">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="stat-label">AI-Assessed Level</div>
            <div className="stat-value">{assignedLevel}</div>
            <div className="stat-note">Diagnostic baseline</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon tone-amber">
            {isFeasible ? <Clock3 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div>
            <div className="stat-label">Pacing Status</div>
            <div className="stat-value">
              {isFeasible ? "On Track" : "Fast-Track"}
            </div>
            <div className="stat-note">Schedule alignment</div>
          </div>
        </div>
      </div>

      <Card className="roadmap-ready-card">
        <div className="ready-icon"></div>
        <div>
          <h3>Ready to build your day-by-day roadmap?</h3>
          <p>
            Generate structured lessons, tasks, and mentor guidance tailored to
            your {assignedLevel.toLowerCase()} starting point.
          </p>
        </div>
        <Button onClick={handleGenerateRoadmap} loading={generating}>
          Generate personalized roadmap <ArrowRight size={16} />
        </Button>
      </Card>
    </div>
  );
}
