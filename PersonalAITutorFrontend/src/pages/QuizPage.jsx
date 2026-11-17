import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Flag } from 'lucide-react';
import { Button, Card, ProgressBar, Badge, Alert } from '../components/UI';

export default function QuizPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const quizData = location.state?.quiz;
  const questions = quizData?.quiz || [];
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [error, setError] = useState('');
  const current = questions[index];
  const answered = Object.keys(answers).length;
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;
  const selected = current ? answers[current.id] : null;
  const goal = location.state?.goal || quizData?.goal || 'Your learning goal';
  const score = useMemo(() => questions.reduce((sum, question) => sum + (answers[question.id] === question.correct_answer ? 1 : 0), 0), [answers, questions]);

  if (!quizData || !questions.length) return <Card className="empty-quiz"><h2>No active assessment</h2><p>Start a learning path first. Your generated skill assessment will appear here.</p><Button onClick={() => navigate('/start')}>Create a learning path</Button></Card>;

  const finish = () => {
    if (answered !== questions.length) { setError(`Answer all ${questions.length} questions before submitting. ${questions.length - answered} remaining.`); return; }
    setError(''); setShowSubmit(true);
  };
  const confirm = () => {
    const assignedLevel = score >= Math.ceil(questions.length * 0.8) ? 'Advanced' : score >= Math.ceil(questions.length * 0.5) ? 'Intermediate' : 'Beginner';
    navigate('/feasibility', { state: { score, total: questions.length, assignedLevel, goal } });
  };

  return <div className="quiz-page">
    <div className="quiz-topline"><button className="back-link" onClick={() => navigate('/start')}><ArrowLeft size={15} /> Edit goal</button><div className="quiz-meta"><span><Clock3 size={14} /> Self-paced</span><span><Flag size={14} /> {questions.length} questions</span></div></div>
    <div className="quiz-intro"><div><div className="eyebrow">STEP 02 · SKILL ASSESSMENT</div><h1>Let's find your starting point.</h1><p>Answer based on what you know today. This is a guide, not a judgement.</p></div><div className="quiz-goal-chip"><span>ASSESSING</span><strong>{goal}</strong></div></div>
    <div className="quiz-progress-row"><div><strong>Assessment progress</strong><span>{answered} of {questions.length} answered</span></div><strong>{progress}%</strong></div><ProgressBar value={progress} />
    <div className="quiz-layout"><Card className="quiz-card">
      <div className="quiz-question-top"><Badge tone={current?.difficulty === 'easy' ? 'success' : current?.difficulty === 'hard' ? 'warning' : 'info'}>{current?.difficulty || 'Question'}</Badge><span>QUESTION {index + 1} / {questions.length}</span></div>
      <h2>{current?.question}</h2><div className="quiz-options">{Object.entries(current?.options || {}).map(([key, option]) => <button key={key} type="button" className={`quiz-option ${selected === key ? 'selected' : ''}`} onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: key }))}><span className="option-key">{key}</span><span>{option}</span>{selected === key ? <CheckCircle2 size={18} className="option-check" /> : null}</button>)}</div>
      {error ? <Alert type="error">{error}</Alert> : null}
      <div className="quiz-card-footer"><Button variant="secondary" disabled={index === 0} onClick={() => setIndex((v) => v - 1)}><ChevronLeft size={16} /> Previous</Button>{index < questions.length - 1 ? <Button onClick={() => { setError(''); setIndex((v) => v + 1); }}>Next question <ChevronRight size={16} /></Button> : <Button onClick={finish}>Review answers <ArrowRight size={16} /></Button>}</div>
    </Card>
    <aside className="quiz-sidebar"><Card><div className="quiz-side-head"><h3>Question navigator</h3><span>{answered}/{questions.length}</span></div><div className="question-grid">{questions.map((q, i) => <button key={q.id} onClick={() => { setIndex(i); setError(''); }} className={`question-number ${i === index ? 'current' : ''} ${answers[q.id] ? 'answered' : ''}`}>{i + 1}</button>)}</div><div className="navigator-legend"><span><i className="legend-current" /> Current</span><span><i className="legend-answered" /> Answered</span><span><i className="legend-empty" /> Unanswered</span></div></Card><Card className="quiz-note"><div className="note-icon"><Flag size={17} /></div><strong>Take your time</strong><p>Choose the best answer for each question. Your result helps PathAI estimate your current level and build a relevant plan.</p></Card></aside></div>
    {showSubmit ? <div className="modal-backdrop"><Card className="confirm-modal"><div className="confirm-icon"><CheckCircle2 size={24} /></div><div className="eyebrow">READY TO SUBMIT</div><h2>Finish your assessment?</h2><p>You answered {answered} questions. Your result will be calculated and used for the feasibility check.</p><div className="confirm-actions"><Button variant="secondary" onClick={() => setShowSubmit(false)}>Review answers</Button><Button onClick={confirm}>Submit assessment <ArrowRight size={16} /></Button></div></Card></div> : null}
  </div>;
}
