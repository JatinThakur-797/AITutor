import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  HelpCircle,
  Lightbulb,
  SkipForward,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { learningApi } from "../api/learning";
import { Alert, Badge, Button, Card, ProgressBar } from "../components/UI";

const SKIPPED = "__SKIPPED__";
const FEASIBILITY_STORAGE_KEY = "pathai-latest-assessment";

export default function QuizPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const quizData = location.state?.quiz;
  const goalId = location.state?.goalId || quizData?.goalId;
  const questions = quizData?.quiz || [];

  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadingFeasibility, setLoadingFeasibility] = useState(false);
  const [error, setError] = useState("");

  const current = questions[index];
  const respondedCount = Object.keys(answers).length;
  const skippedCount = useMemo(
    () => Object.values(answers).filter((val) => val === SKIPPED).length,
    [answers],
  );
  const answeredCount = respondedCount - skippedCount;

  const progress = questions.length
    ? Math.round((respondedCount / questions.length) * 100)
    : 0;
  const selected = current ? answers[current.id] : null;
  const goal = location.state?.goal || quizData?.goal || "Your learning goal";

  const score = useMemo(
    () =>
      questions.reduce(
        (sum, question) =>
          sum + (answers[question.id] === question.correct_answer ? 1 : 0),
        0,
      ),
    [answers, questions],
  );

  const assignedLevel = useMemo(() => {
    if (!questions.length) return "Beginner";
    if (score >= Math.ceil(questions.length * 0.8)) return "Advanced";
    if (score >= Math.ceil(questions.length * 0.5)) return "Intermediate";
    return "Beginner";
  }, [score, questions.length]);

  if (!quizData || !questions.length) {
    return (
      <Card className="empty-quiz">
        <h2>No active assessment</h2>
        <p>
          Start a learning path first. Your generated skill assessment will
          appear here.
        </p>
        <Button onClick={() => navigate("/app/start")}>
          Create a learning path
        </Button>
      </Card>
    );
  }

  const handleSkipQuestion = () => {
    setError("");
    setAnswers((prev) => ({ ...prev, [current.id]: SKIPPED }));
    if (index < questions.length - 1) {
      setIndex((v) => v + 1);
    } else {
      setShowSubmit(true);
    }
  };

  const handleSkipAllAsBeginner = () => {
    const allSkipped = {};
    questions.forEach((q) => {
      allSkipped[q.id] = SKIPPED;
    });
    setAnswers(allSkipped);
    setError("");
    setShowSubmit(false);
    setSubmitted(true);
  };

  const finish = () => {
    const remaining = questions.length - respondedCount;
    if (remaining > 0) {
      setError(
        `Please answer or skip all ${questions.length} questions before submitting (${remaining} remaining).`,
      );
      return;
    }
    setError("");
    setShowSubmit(true);
  };

  const confirmSubmit = () => {
    setShowSubmit(false);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continueToFeasibility = async () => {
    setLoadingFeasibility(true);
    setError("");

    try {
      const checkFn =
        learningApi.checkFeasibility || learningApi.getFeasibility;
      const feasibilityRes = checkFn
        ? await checkFn({
            goalId,
            score,
            assignedLevel,
          })
        : null;

      const resolvedGoalId =
        feasibilityRes?.goalId || goalId || quizData?.goalId;

      const feasibilityObj =
        feasibilityRes?.feasibility &&
        typeof feasibilityRes.feasibility === "object"
          ? feasibilityRes.feasibility
          : feasibilityRes;

      const assessmentPayload = {
        goalId: resolvedGoalId,
        goalTitle: feasibilityRes?.goalTitle || goal,
        feasibility: feasibilityObj,
        quizSummary: {
          score,
          total: questions.length,
          assignedLevel: feasibilityRes?.assignedLevel || assignedLevel,
        },
      };

      try {
        sessionStorage.setItem(
          FEASIBILITY_STORAGE_KEY,
          JSON.stringify(assessmentPayload),
        );
      } catch {
        // ignore storage quota errors
      }

      navigate("/app/feasibility", {
        state: assessmentPayload,
      });
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Could not calculate feasibility. Please try again.",
        ),
      );
    } finally {
      setLoadingFeasibility(false);
    }
  };

  // ──────────────────────────────────────────────
  // POST-SUBMIT FULL REVIEW VIEW
  // ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="quiz-page">
        <div className="quiz-intro">
          <div>
            <div className="eyebrow">ASSESSMENT RESULTS &amp; REVIEW</div>
            <h1>
              You scored {score} out of {questions.length}
            </h1>
            <p>
              Assigned starting level:{" "}
              <Badge tone={assignedLevel === "Advanced" ? "success" : "info"}>
                {assignedLevel}
              </Badge>{" "}
              · {answeredCount} answered · {skippedCount} skipped
            </p>
          </div>
          <Button onClick={continueToFeasibility} loading={loadingFeasibility}>
            Continue to feasibility <ArrowRight size={16} />
          </Button>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

        <div className="quiz-review-list">
          {questions.map((q, idx) => {
            const userAns = answers[q.id];
            const isSkipped = !userAns || userAns === SKIPPED;
            const isCorrect = !isSkipped && userAns === q.correct_answer;

            return (
              <Card
                key={q.id}
                className={`quiz-review-card ${
                  isCorrect
                    ? "review-correct"
                    : isSkipped
                      ? "review-skipped"
                      : "review-wrong"
                }`}
              >
                <div className="quiz-review-head">
                  <div className="quiz-review-meta">
                    <span className="review-q-num">Q{idx + 1}</span>
                    <Badge
                      tone={
                        q.difficulty === "easy"
                          ? "success"
                          : q.difficulty === "hard"
                            ? "warning"
                            : "info"
                      }
                    >
                      {q.difficulty || "Question"}
                    </Badge>
                    {q.concept ? (
                      <span className="review-concept">{q.concept}</span>
                    ) : null}
                  </div>
                  {isCorrect ? (
                    <Badge tone="success">
                      <CheckCircle2 size={13} /> Correct
                    </Badge>
                  ) : isSkipped ? (
                    <Badge>
                      <HelpCircle size={13} /> Skipped
                    </Badge>
                  ) : (
                    <Badge tone="warning">
                      <XCircle size={13} /> Incorrect
                    </Badge>
                  )}
                </div>

                <h3>{q.question}</h3>

                <div className="review-options-grid">
                  {Object.entries(q.options || {}).map(([key, text]) => {
                    const isRightOpt = key === q.correct_answer;
                    const isUserWrongOpt =
                      !isSkipped && key === userAns && !isRightOpt;
                    return (
                      <div
                        key={key}
                        className={`review-option ${
                          isRightOpt ? "is-right" : ""
                        } ${isUserWrongOpt ? "is-user-wrong" : ""}`}
                      >
                        <span className="option-key">{key}</span>
                        <span>{text}</span>
                        {isRightOpt ? (
                          <strong className="opt-tag right">
                            Correct answer
                          </strong>
                        ) : isUserWrongOpt ? (
                          <strong className="opt-tag wrong">Your choice</strong>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {q.explanation ? (
                  <div className="quiz-explanation-box is-correct">
                    <div className="explanation-head">
                      <Lightbulb size={15} />
                      <strong>Explanation</strong>
                    </div>
                    <p>{q.explanation}</p>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>

        <div className="quiz-review-footer">
          <Button onClick={continueToFeasibility} loading={loadingFeasibility}>
            Continue to feasibility report <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // ACTIVE ASSESSMENT VIEW (No mid-quiz answers shown)
  // ──────────────────────────────────────────────
  return (
    <div className="quiz-page">
      <div className="quiz-topline">
        <button className="back-link" onClick={() => navigate("/app/start")}>
          <ArrowLeft size={15} /> Edit goal
        </button>
        <div className="quiz-meta">
          <span>
            <Clock3 size={14} /> Self-paced
          </span>
          <span>
            <Flag size={14} /> {questions.length} questions
          </span>
          <button
            type="button"
            className="skip-all-link"
            onClick={handleSkipAllAsBeginner}
          >
            <SkipForward size={14} /> Skip quiz (Start as Beginner)
          </button>
        </div>
      </div>

      <div className="quiz-intro">
        <div>
          <div className="eyebrow">STEP 02 · SKILL ASSESSMENT</div>
          <h1>Let's find your starting point.</h1>
          <p>
            Answer what you know, or skip any question you haven't learned yet.
            Full answers and explanations appear right after you submit.
          </p>
        </div>
        <div className="quiz-goal-chip">
          <span>ASSESSING</span>
          <strong>{goal}</strong>
        </div>
      </div>

      <div className="quiz-progress-row">
        <div>
          <strong>Assessment progress</strong>
          <span>
            {answeredCount} answered · {skippedCount} skipped ·{" "}
            {questions.length - respondedCount} remaining
          </span>
        </div>
        <strong>{progress}%</strong>
      </div>
      <ProgressBar value={progress} />

      <div className="quiz-layout">
        <Card className="quiz-card">
          <div className="quiz-question-top">
            <Badge
              tone={
                current?.difficulty === "easy"
                  ? "success"
                  : current?.difficulty === "hard"
                    ? "warning"
                    : "info"
              }
            >
              {current?.difficulty || "Question"}
            </Badge>
            <span>
              QUESTION {index + 1} / {questions.length}
            </span>
          </div>

          <h2>{current?.question}</h2>

          <div className="quiz-options">
            {Object.entries(current?.options || {}).map(([key, option]) => (
              <button
                key={key}
                type="button"
                className={`quiz-option ${selected === key ? "selected" : ""}`}
                onClick={() => {
                  setError("");
                  setAnswers((prev) => ({ ...prev, [current.id]: key }));
                }}
              >
                <span className="option-key">{key}</span>
                <span>{option}</span>
                {selected === key ? (
                  <CheckCircle2 size={18} className="option-check" />
                ) : null}
              </button>
            ))}
          </div>

          {selected === SKIPPED ? (
            <div className="skipped-banner">
              <HelpCircle size={15} />
              <span>
                Marked as skipped — you can still pick an option above if you
                change your mind.
              </span>
            </div>
          ) : null}

          {error ? <Alert type="error">{error}</Alert> : null}

          <div className="quiz-card-footer">
            <Button
              variant="secondary"
              disabled={index === 0}
              onClick={() => setIndex((v) => v - 1)}
            >
              <ChevronLeft size={16} /> Previous
            </Button>

            <div className="quiz-footer-right">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkipQuestion}
              >
                <SkipForward size={15} /> I don't know / Skip
              </Button>

              {index < questions.length - 1 ? (
                <Button
                  onClick={() => {
                    setError("");
                    setIndex((v) => v + 1);
                  }}
                >
                  Next question <ChevronRight size={16} />
                </Button>
              ) : (
                <Button onClick={finish}>
                  Submit assessment <ArrowRight size={16} />
                </Button>
              )}
            </div>
          </div>
        </Card>

        <aside className="quiz-sidebar">
          <Card>
            <div className="quiz-side-head">
              <h3>Question navigator</h3>
              <span>
                {respondedCount}/{questions.length}
              </span>
            </div>
            <div className="question-grid">
              {questions.map((q, i) => {
                const status = answers[q.id];
                const isSkipped = status === SKIPPED;
                const isAnswered = Boolean(status) && !isSkipped;
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setIndex(i);
                      setError("");
                    }}
                    className={`question-number ${i === index ? "current" : ""} ${
                      isAnswered ? "answered" : ""
                    } ${isSkipped ? "skipped" : ""}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="navigator-legend">
              <span>
                <i className="legend-current" /> Current
              </span>
              <span>
                <i className="legend-answered" /> Answered
              </span>
              <span>
                <i className="legend-skipped" /> Skipped
              </span>
            </div>
          </Card>

          <Card className="quiz-note">
            <div className="note-icon">
              <Flag size={17} />
            </div>
            <strong>No guessing needed</strong>
            <p>
              If you don't know a question yet, click{" "}
              <strong>I don't know / Skip</strong> so PathAI starts your roadmap
              at the right level. You'll review all answers after submitting.
            </p>
          </Card>
        </aside>
      </div>

      {showSubmit ? (
        <div className="modal-backdrop">
          <Card className="confirm-modal">
            <div className="confirm-icon">
              <CheckCircle2 size={24} />
            </div>
            <div className="eyebrow">READY TO SUBMIT</div>
            <h2>Submit your assessment?</h2>
            <p>
              You answered <strong>{answeredCount}</strong> and skipped{" "}
              <strong>{skippedCount}</strong> of {questions.length} questions.
              Submit now to see your score, explanations, and assigned level.
            </p>
            <div className="confirm-actions">
              <Button variant="secondary" onClick={() => setShowSubmit(false)}>
                Keep reviewing
              </Button>
              <Button onClick={confirmSubmit}>
                Submit &amp; view answers <ArrowRight size={16} />
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
