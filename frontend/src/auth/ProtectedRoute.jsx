// File: src/auth/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import { PageSpinner } from '../components/ui/Spinner';

export default function ProtectedRoute({ children, requireOnboarding = false }) {
  const location = useLocation();
  const { user, loading } = useApp();

  if (!getToken()) return <Navigate to="/login" state={{ from: location }} replace />;
  if (loading || !user) return <PageSpinner />;
  if (requireOnboarding && !user.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return children;
}
