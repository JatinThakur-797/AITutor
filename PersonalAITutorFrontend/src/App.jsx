import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LessonPhase from "./components/tutor/LessonPhase";
import AIDashBoard from "./pages/AIDashBoard";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Success from "./pages/Success";
import Error from "./pages/Error";
import Landing from "./pages/Landing";

export default function App() {
  return (

    <AuthProvider>

      <BrowserRouter>
        <Routes>

          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/success" element={<Success />} />
          <Route path="/auth/error" element={<Error />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai"
            element={
              <ProtectedRoute>
                <AIDashBoard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ide"
            element={
              <ProtectedRoute>
                <LessonPhase />
              </ProtectedRoute>
            }
          />
          {/** OAuth Success handling is automatic because backend returns JSON */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
