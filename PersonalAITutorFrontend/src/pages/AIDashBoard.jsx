import { useState, useContext } from 'react';
import { checkFeasibility, generateRoadmap, generateTestQuiz, getRoadmapDays, markDayComplete } from "../api/tutorApi";
import { AuthContext } from "../auth/AuthContext";

import FeasibilityPhase from "../components/tutor/FeasibilityPhase";
import InputPhase from "../components/tutor/InputPhase";
import LessonPhase from "../components/tutor/LessonPhase"; // ✅ Import the new phase
import QuizPhase from "../components/tutor/QuizPhase";
import RoadmapPhase from "../components/tutor/RoadmapPhase";
import UserDashboard from './UserDashboard';

/**
 * Phase flow:
 *
 * "dashboard"   ← shown after login (new entry point)
 * ↓  user clicks "New Roadmap" or "Continue"
 * "input"       ← fill goal form
 * ↓
 * "quiz"
 * ↓
 * "feasibility"
 * ↓
 * "roadmap"     ← sidebar + lock system
 * ↓  user clicks "Start Lesson"
 * "lesson"      ← ✅ Split screen markdown reader & code editor
 * ↓
 * back to "roadmap" or "dashboard"
 */
const AIDashBoard = () => {
    const { user } = useContext(AuthContext);
    const [phase, setPhase] = useState('dashboard');
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({ goal: '', currentLevel: 'Beginner', timePerDay: 3, duration: 6 });
    const [quizData, setQuizData] = useState(null);
    const [userAnswers, setUserAnswers] = useState({});
    const [report, setReport] = useState(null);
    const [feasibility, setFeasibility] = useState(null);
    const [roadmap, setRoadmap] = useState([]);
    const [loadedDays, setLoadedDays] = useState(0);
    const [goalId, setGoalId] = useState(null);

    // ✅ NEW STATE: Track which day's lesson the user is currently reading
    const [activeDay, setActiveDay] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'timePerDay' || name === 'duration' ? Number(value) : value,
        }));
    };

    // ── Continue an existing goal from dashboard ───────────────────────────
    const handleContinueGoal = async (goal) => {
        setFormData({
            goal: goal.goal,
            currentLevel: goal.currentLevel || 'Beginner',
            timePerDay: goal.timePerDay || 3,
            duration: goal.duration || 6,
        });
        setFeasibility({
            isFeasible: goal.feasible,
            expectedOutcome: goal.expectedOutcome,
            estimatedDaysRequired: goal.estimatedDaysRequired,
        });
        setGoalId(goal.goalId);

        if (goal.status === 'ROADMAP_GENERATED') {
            setLoading(true);
            try {
                const res = await getRoadmapDays(goal.goalId);
                const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                setRoadmap(data.days || []);
                setLoadedDays(data.days?.length || 0);
            } catch (err) {
                console.error('Failed to load roadmap days:', err);
            } finally {
                setLoading(false);
            }
            setPhase('roadmap');
        } else if (goal.status === 'FEASIBILITY_DONE') {
            setPhase('feasibility');
        } else {
            setPhase('input');
        }
    };

    // ── Phase 1: form → quiz ───────────────────────────────────────────────
    const handleInitialSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await generateTestQuiz(formData);
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            setQuizData(data);
            setPhase('quiz');
        } catch (err) {
            console.error('Quiz generation failed:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Phase 2: quiz → feasibility ───────────────────────────────────────
    const handleQuizFinish = async () => {
        setLoading(true);
        const score = quizData.quiz.reduce(
            (acc, q) => userAnswers[q.id] === q.correct_answer ? acc + 1 : acc, 0
        );
        const pct = (score / quizData.quiz.length) * 100;
        const assignedLevel = pct > 80 ? 'Advanced' : pct > 50 ? 'Intermediate' : 'Beginner';
        const payload = { score, assignedLevel };
        setReport(payload);

        try {
            const res = await checkFeasibility(payload);
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            setFeasibility(data);
            setPhase('feasibility');
        } catch (err) {
            console.error('Feasibility check failed:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Phase 3: feasibility → roadmap chunk ──────────────────────────────
    const handleLoadRoadmapChunk = async (startDay, daysToLoad) => {
        setLoading(true);
        try {
            const res = await generateRoadmap(startDay, daysToLoad);
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            const newDays = data.roadmap.map(d => ({ ...d, completed: false }));
            setRoadmap(prev => [...prev, ...newDays]);
            setLoadedDays(startDay + daysToLoad - 1);
            if (data.goalId) setGoalId(data.goalId);
            setPhase('roadmap');
        } catch (err) {
            console.error('Roadmap generation failed:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Phase 4: roadmap → lesson ──────────────────────────────────────────
    // ✅ NEW: Navigate to the lesson view
    const handleStartLesson = (dayNumber) => {
        setActiveDay(dayNumber);
        setPhase('lesson');
    };

    // ── Mark day complete ──────────────────────────────────────────────────
    const handleMarkComplete = async (gId, dayNumber) => {
        try {
            if (gId) await markDayComplete(gId, dayNumber);
        } catch (err) {
            console.error('Mark complete failed:', err);
        }
        setRoadmap(prev => prev.map(d => d.day === dayNumber ? { ...d, completed: true } : d));
    };

    // ── Go back to dashboard ───────────────────────────────────────────────
    const goToDashboard = () => {
        setPhase('dashboard');
        setRoadmap([]);
        setLoadedDays(0);
        setQuizData(null);
        setUserAnswers({});
        setReport(null);
        setActiveDay(null);
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <>
            {phase === 'dashboard' && (
                <UserDashboard
                    user={user}
                    onStartNew={() => setPhase('input')}
                    onContinueGoal={handleContinueGoal}
                />
            )}

            {phase === 'input' && (
                <InputPhase
                    formData={formData}
                    handleChange={handleChange}
                    onSubmit={handleInitialSubmit}
                    loading={loading}
                    onBack={goToDashboard}
                />
            )}

            {phase === 'quiz' && quizData && (
                <QuizPhase
                    quizData={quizData}
                    userAnswers={userAnswers}
                    setUserAnswers={setUserAnswers}
                    onFinish={handleQuizFinish}
                    loading={loading}
                />
            )}

            {phase === 'feasibility' && feasibility && (
                <FeasibilityPhase
                    feasibility={feasibility}
                    report={report}
                    totalQuestions={quizData?.quiz?.length || 10}
                    onGenerate={() => handleLoadRoadmapChunk(1, 7)}
                    loading={loading}
                />
            )}

            {phase === 'roadmap' && (
                <RoadmapPhase
                    roadmap={roadmap}
                    formData={formData}
                    feasibility={feasibility}
                    loadedDays={loadedDays}
                    onLoadMore={() => handleLoadRoadmapChunk(loadedDays + 1, 7)}
                    loading={loading}
                    onMarkComplete={handleMarkComplete}
                    goalId={goalId}
                    onBackToDashboard={goToDashboard}
                    onStartLesson={handleStartLesson} // ✅ Pass the handler to RoadmapPhase
                />
            )}

            {/* ✅ NEW: Render the Lesson Phase */}
            {phase === 'lesson' && (
                <LessonPhase
                    goalId={goalId}
                    dayNumber={activeDay}
                    onBack={() => setPhase('roadmap')}
                    onComplete={(gId, dayNum) => {
                        handleMarkComplete(gId, dayNum); // Mark it done in the DB
                        setPhase('roadmap');             // Bounce back to the roadmap
                    }}
                />
            )}
        </>
    );
};

export default AIDashBoard;