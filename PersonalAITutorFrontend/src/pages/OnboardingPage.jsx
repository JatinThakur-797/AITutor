import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  GraduationCap,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { learningApi } from "../api/learning";
import { Alert, Button, Card, Field, PageHeading } from "../components/UI";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    goal: "",
    currentLevel: "Beginner",
    timePerDay: 2,
    duration: 3,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (key) => (event) =>
    setForm((prev) => ({
      ...prev,
      [key]:
        event.target.type === "number"
          ? Number(event.target.value)
          : event.target.value,
    }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const quiz = await learningApi.startAssessment({
        ...form,
        timePerDay: Number(form.timePerDay),
        duration: Number(form.duration),
      });
      navigate("/app/quiz", {
        state: { quiz, goal: form.goal, currentLevel: form.currentLevel },
      });
    } catch (err) {
      setError(getErrorMessage(err, "Could not start your assessment."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="STEP 01 · SET YOUR DIRECTION"
        title="What do you want to become?"
        description="Start with a goal. PathAI will assess your current level before shaping a realistic roadmap."
        action={
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </Button>
        }
      />
      <div className="onboarding-layout">
        <Card className="onboarding-form-card">
          <div className="form-step-heading">
            <div className="step-icon">
              <Target size={20} />
            </div>
            <div>
              <h2>Set your learning goal</h2>
              <p>Be specific about the outcome you want to reach.</p>
            </div>
          </div>
          {error ? <Alert type="error">{error}</Alert> : null}
          <form className="stack-form" onSubmit={submit}>
            <Field
              label="Your goal"
              hint="Example: Become a Java backend developer, master React, or learn data structures."
            >
              <textarea
                className="input textarea"
                rows="3"
                placeholder="I want to become a…"
                value={form.goal}
                onChange={update("goal")}
                required
                minLength={5}
                maxLength={180}
              />
            </Field>
            <Field label="How would you describe your current level?">
              <select
                className="input"
                value={form.currentLevel}
                onChange={update("currentLevel")}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </Field>
            <div className="form-two-col">
              <Field label="Study time per day">
                <div className="input-icon-wrap">
                  <Clock3 size={17} />
                  <input
                    className="input-plain"
                    type="number"
                    min="1"
                    max="16"
                    value={form.timePerDay}
                    onChange={update("timePerDay")}
                    required
                  />
                </div>
                <span className="field-hint">1–16 hours</span>
              </Field>
              <Field label="Available duration">
                <div className="input-icon-wrap">
                  <GraduationCap size={17} />
                  <input
                    className="input-plain"
                    type="number"
                    min="1"
                    max="24"
                    value={form.duration}
                    onChange={update("duration")}
                    required
                  />
                </div>
                <span className="field-hint">1–24 months</span>
              </Field>
            </div>
            <Button type="submit" loading={loading} className="form-submit">
              Start skill assessment <ArrowRight size={17} />
            </Button>
          </form>
        </Card>
        <aside className="onboarding-aside">
          <div className="aside-illustration">
            <div className="aside-orbit" />
            <div className="aside-center">
              <Sparkles size={28} />
            </div>
            <span className="aside-star star-one">✦</span>
            <span className="aside-star star-two">✧</span>
          </div>
          <div className="eyebrow">WHAT HAPPENS NEXT</div>
          <h3>A roadmap that starts at your level.</h3>
          <div className="step-list">
            <div>
              <span>01</span>
              <p>
                <strong>Skill assessment</strong>Answer a short AI-generated
                quiz about your goal.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Feasibility check</strong>See how your time and current
                skills fit your target.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Personal roadmap</strong>Get a practical sequence of
                daily lessons and tasks.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
