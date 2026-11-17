import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Flame, GraduationCap, Plus, Sparkles, Target, TrendingUp } from 'lucide-react';
import { learningApi } from '../api/learning';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Alert, Badge, Button, Card, EmptyState, PageHeading, ProgressBar, SectionTitle, StatCard } from '../components/UI';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    learningApi.getGoals().then(async (items) => {
      if (!alive) return;
      const sorted = [...(items || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setGoals(sorted);
      const active = sorted.find((goal) => goal.status === 'ROADMAP_GENERATED');
      if (active) {
        try {
          const result = await learningApi.getRoadmapDays(active.goalId);
          if (alive) setDays(result?.days || []);
        } catch { if (alive) setDays([]); }
      }
    }).catch((err) => { if (alive) setError(getErrorMessage(err, 'Unable to load your learning overview.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const activeGoal = useMemo(() => goals.find((goal) => goal.status === 'ROADMAP_GENERATED'), [goals]);
  const completed = days.filter((day) => day.completed).length;
  const progress = days.length ? Math.round((completed / days.length) * 100) : 0;
  const nextDay = days.find((day) => !day.completed) || days[0];
  const displayName = user?.name?.split(' ')[0] || 'there';

  return <>
    <PageHeading eyebrow="YOUR LEARNING OVERVIEW" title={`Good to see you, ${displayName}.`} description="A clear direction, a focused session, and a little progress every day." action={<Button onClick={() => navigate('/start')}><Plus size={17} /> New learning path</Button>} />
    {error ? <Alert type="error">{error}</Alert> : null}
    <section className="welcome-hero">
      <div className="welcome-copy"><div className="hero-overline"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</div><h2>Make learning<br /><span>feel achievable.</span></h2><p>Turn a big career goal into daily lessons, practical tasks, and clear milestones.</p><div className="hero-actions"><Button onClick={() => navigate(activeGoal ? `/roadmap/${activeGoal.goalId}` : '/start')}>{activeGoal ? 'Continue learning' : 'Build my learning path'} <ArrowRight size={16} /></Button><Link to="/explore" className="hero-secondary">Explore the library</Link></div></div>
      <div className="hero-art" aria-hidden="true"><div className="hero-glow" /><div className="hero-planet planet-large" /><div className="hero-planet planet-small" /><div className="hero-ring ring-a" /><div className="hero-ring ring-b" /><div className="hero-floating-card float-one"><BookOpen size={15} /><span>Daily lessons</span><strong>One step at a time</strong></div><div className="hero-floating-card float-two"><Target size={15} /><span>Stay on track</span><strong>Progress that adds up</strong></div></div>
    </section>

    <div className="stats-grid">
      <StatCard icon={Target} label="Learning paths" value={loading ? '—' : goals.length} note="Goals you've started" tone="violet" />
      <StatCard icon={CheckCircle2} label="Lessons completed" value={loading ? '—' : completed} note="Across your active path" tone="green" />
      <StatCard icon={TrendingUp} label="Current progress" value={activeGoal ? `${progress}%` : '—'} note={activeGoal ? 'On your active roadmap' : 'Start a path to track it'} tone="blue" />
      <StatCard icon={Clock3} label="Daily intention" value={activeGoal ? `${activeGoal.duration || '—'} mo` : 'Set one'} note="Your target learning window" tone="amber" />
    </div>

    <div className="dashboard-grid">
      <div className="dashboard-main-column">
        <SectionTitle title="Your active learning path" subtitle="Pick up where your learning left off." to={activeGoal ? `/roadmap/${activeGoal.goalId}` : '/start'} linkLabel={activeGoal ? 'Open roadmap' : 'Create a path'} />
        {activeGoal ? <Card className="active-path-card">
          <div className="active-path-top"><div className="path-icon"><GraduationCap size={20} /></div><Badge tone="success">In progress</Badge></div>
          <h3>{activeGoal.goal}</h3><p className="muted">{activeGoal.currentLevel || 'Current level not specified'} <span className="dot-separator">·</span> {activeGoal.duration || '—'} month plan</p>
          <div className="path-progress-label"><span>{completed} of {days.length || activeGoal.totalDays || 0} generated lessons completed</span><strong>{progress}%</strong></div><ProgressBar value={progress} />
          <div className="path-card-bottom"><div className="path-meta"><span><BookOpen size={14} /> {days.length || activeGoal.totalDays || 0} days available</span><span><Flame size={14} /> {activeGoal.expectedOutcome || 'Learning journey'}</span></div><Button size="sm" onClick={() => navigate(`/roadmap/${activeGoal.goalId}`)}>Continue <ArrowRight size={15} /></Button></div>
        </Card> : <Card><EmptyState icon={GraduationCap} title={loading ? 'Loading your path…' : 'Your learning journey starts here'} description="Tell PathAI what you want to achieve. We'll assess your starting point and build a roadmap around your time and goals." action={<Button onClick={() => navigate('/start')}><Plus size={16} /> Create your first path</Button>} /></Card>}

        <SectionTitle title="Continue your learning" subtitle="Your next lesson is ready when you are." />
        {activeGoal && nextDay ? <Card className="next-lesson-card"><div className="next-lesson-icon"><BookOpen size={21} /></div><div className="next-lesson-copy"><div className="eyebrow">UP NEXT · DAY {nextDay.day}</div><h3>{nextDay.main_topic || 'Your next lesson'}</h3><p>{nextDay.daily_goal || 'Build understanding with a focused lesson and practical task.'}</p></div><Button variant="secondary" size="sm" onClick={() => navigate(`/lesson/${activeGoal.goalId}/${nextDay.day}`)}>Open lesson <ArrowRight size={15} /></Button></Card> : <Card className="quiet-card"><div className="quiet-icon"><BookOpen size={19} /></div><div><strong>No lesson queued yet</strong><p>Create a path to unlock your first lesson.</p></div></Card>}
      </div>
      <div className="dashboard-side-column">
        <Card className="side-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR MOMENTUM</div><h3>Keep it consistent</h3></div><div className="panel-heading-icon"><Flame size={17} /></div></div><p className="muted small">Progress comes from returning to the work. Set a realistic daily target and protect a little time for it.</p><div className="momentum-rule"><span>01</span><div><strong>Read with intent</strong><p>Understand one concept before moving on.</p></div></div><div className="momentum-rule"><span>02</span><div><strong>Practice immediately</strong><p>Turn the idea into a small coding exercise.</p></div></div><div className="momentum-rule"><span>03</span><div><strong>Ask when stuck</strong><p>Use the lesson-aware mentor to clarify doubts.</p></div></div></Card>
        <Card className="library-promo"><div className="promo-icon"><BookOpen size={19} /></div><div className="eyebrow">LEARNING LIBRARY</div><h3>Learn like you read a good technical article.</h3><p>Topic-focused lessons, clean explanations, code examples, and a mentor alongside your reading.</p><Link to="/explore" className="text-link">Explore lessons <ArrowRight size={15} /></Link></Card>
      </div>
    </div>
    {goals.length > 0 ? <><SectionTitle title="Your learning paths" subtitle="All the goals associated with your account." /><div className="goal-list">{goals.slice(0, 4).map((goal) => <Link to={goal.status === 'ROADMAP_GENERATED' ? `/roadmap/${goal.goalId}` : '/start'} className="goal-list-item" key={goal.goalId}><div className="goal-list-icon"><GraduationCap size={18} /></div><div className="goal-list-copy"><strong>{goal.goal}</strong><span>{goal.currentLevel || 'Level not set'} · {goal.duration || '—'} months</span></div><Badge tone={goal.status === 'ROADMAP_GENERATED' ? 'success' : 'warning'}>{String(goal.status || 'Started').replaceAll('_', ' ').toLowerCase()}</Badge><ArrowRight size={16} className="muted-icon" /></Link>)}</div></> : null}
  </>;
}
