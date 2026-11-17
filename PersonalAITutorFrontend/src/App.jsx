import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { LoadingScreen } from "./components/UI";
import { useAuth } from "./context/AuthContext";
import { LoginPage, OAuthSuccessPage, RegisterPage } from "./pages/AuthPages";
import DashboardPage from "./pages/DashboardPage";
import ExplorePage from "./pages/ExplorePage";
import FeasibilityPage from "./pages/FeasibilityPage";
import LandingPage from "./pages/LandingPage";
import LessonPage from "./pages/LessonPage";
import NotFoundPage from "./pages/NotFoundPage";
import OnboardingPage from "./pages/OnboardingPage";
import ProfilePage from "./pages/ProfilePage";
import QuizPage from "./pages/QuizPage";
import RoadmapPage from "./pages/RoadmapPage";

function PublicOnly({ children }) {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) return <LoadingScreen />;
  return user ? <Navigate to="/app" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route path="/auth/success" element={<OAuthSuccessPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="start" element={<OnboardingPage />} />
          <Route path="quiz" element={<QuizPage />} />
          <Route path="feasibility" element={<FeasibilityPage />} />
          <Route path="roadmap/:goalId" element={<RoadmapPage />} />
          <Route path="lesson/:goalId/:dayNumber" element={<LessonPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
