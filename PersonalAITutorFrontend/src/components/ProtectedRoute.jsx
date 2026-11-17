import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from './UI';

export default function ProtectedRoute() {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();
  if (bootstrapping) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
