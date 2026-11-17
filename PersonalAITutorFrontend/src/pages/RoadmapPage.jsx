import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, Plus, RefreshCw, Target } from 'lucide-react';
import { learningApi } from '../api/learning';
import { getErrorMessage } from '../api/client';
import { Alert, Badge, Button, Card, LoadingScreen, PageHeading, ProgressBar, SectionTitle } from '../components/UI';

export default function RoadmapPage() {
  const { goalId } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [goals, result] = await Promise.all([learningApi.getGoals(), learningApi.getRoadmapDays(goalId)]);
      setGoal((goals || []).find((item) => String(item.goalId) === String(goalId)) || null);
      setDays(result?.days || []);
    } catch (err) { setError(getErrorMessage(err, 'Unable to load this roadmap.')); }
    finally { setLoading(false); }
  }, [goalId]);

  useEffect(() => { load(); }, [load]);

  const completed = useMemo(() => days.filter((day) => day.completed).length, [days]);
  const percent = days.length ? Math.round((completed / days.length) * 100) : 0;
  const nextDay = days.find((day) => !day.completed);

  const generateNext = async () => {
    setGenerating(true); setError('');
    try {
      const response = await learningApi.generateRoadmap(days.length + 1, 7);
      if (response?.degraded) throw new Error(response.message || 'The AI returned fallback roadmap content. Try again.');
      await load();
    } catch (err) { setError(getErrorMessage(err, 'Unable to extend your roadmap.')); }
    finally { setGenerating(false); }
  };

  if (loading) return <LoadingScreen label="Loading your roadmap" />;

  return <>
    <PageHeading eyebrow="YOUR PERSONAL CURRICULUM" title={goal?.goal || 'Your learning roadmap'} description="A sequence of focused lessons, practical work, and milestones. Move at a pace you can sustain." action={<Button variant="secondary" onClick={load}><RefreshCw size={15} /> Refresh</Button>} />
    {error ? <Alert type="error">{error}</Alert> : null}
    <Card className="roadmap-summary"><div className="roadmap-summary-main"><div className="roadmap-summary-icon"><Target size={22} /></div><div><Badge tone="success">Active learning path</Badge><h2>{goal?.goal || 'Learning journey'}</h2><p>{goal?.currentLevel || 'Starting level'} <span className="dot-separator">·</span> {goal?.duration || '—'} month target <span className="dot-separator">·</span> {goal?.timePerDay || '—'} hours/day</p></div></div><div className="roadmap-summary-progress"><div><strong>{percent}%</strong><span>{completed} / {days.length} lessons done</span></div><ProgressBar value={percent} /></div></Card>

    {nextDay ? <Card className="roadmap-next"><div className="next-badge"><BookOpen size={17} /></div><div className="roadmap-next-copy"><div className="eyebrow">NEXT UP · DAY {nextDay.day}</div><h3>{nextDay.main_topic}</h3><p>{nextDay.daily_goal || 'Continue with your next focused lesson.'}</p></div><Button size="sm" onClick={() => navigate(`/lesson/${goalId}/${nextDay.day}`)}>Start lesson <ArrowRight size={15} /></Button></Card> : null}

    <SectionTitle title="Your curriculum" subtitle={`${days.length} generated days · new topics are created in seven-day blocks.`} />
    {days.length ? <div className="roadmap-timeline">{days.map((day, index) => <article className={`roadmap-day ${day.completed ? 'day-complete' : ''} ${nextDay?.day === day.day ? 'day-next' : ''}`} key={day.day}>
      <div className="day-rail"><div className="day-node">{day.completed ? <Check size={16} /> : String(day.day).padStart(2, '0')}</div>{index < days.length - 1 ? <div className="day-line" /> : null}</div>
      <div className="roadmap-day-card"><div className="roadmap-day-top"><div><div className="eyebrow">DAY {day.day}</div><h3>{day.main_topic}</h3></div>{day.completed ? <Badge tone="success">Completed</Badge> : nextDay?.day === day.day ? <Badge tone="info">Up next</Badge> : <Badge>Planned</Badge>}</div>
        <p>{day.daily_goal || 'Build understanding through a focused lesson and practice.'}</p>
        <div className="day-subtopics">{(day.sub_topics || []).slice(0, 4).map((topic) => <span key={topic}>{topic}</span>)}</div>
        <div className="roadmap-day-bottom"><div className="day-time"><span><Clock3 size={13} /> Theory: {day.hours_allocation?.theory || '—'}</span><span>Practice: {day.hours_allocation?.practice || '—'}</span></div><Link to={`/lesson/${goalId}/${day.day}`} className="text-link">{day.completed ? 'Review lesson' : 'Open lesson'} <ChevronRight size={15} /></Link></div>
      </div>
    </article>)}</div> : <Card><div className="empty-state"><div className="empty-icon"><CalendarDays size={24} /></div><h3>No roadmap days yet</h3><p>Generate your first week to start learning.</p><Button onClick={generateNext} loading={generating}>Generate first 7 days <Plus size={15} /></Button></div></Card>}

    <Card className="roadmap-extend"><div className="extend-icon"><Plus size={19} /></div><div><h3>Keep building your path</h3><p>Generate the next seven days when you're ready. Previously covered topics are shared with the roadmap generator to reduce repetition.</p></div><Button variant="secondary" onClick={generateNext} loading={generating} disabled={generating}><Plus size={16} /> Generate next 7 days</Button></Card>
  </>;
}
