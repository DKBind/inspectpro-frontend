import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { ROUTES } from '@/components/Constant/Route';

export const ProtectedRoute = () => {
  const { isAuthenticated, isFirstLogin } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // On first login, force password update — only allow /update-password
  if (isFirstLogin && location.pathname !== ROUTES.UPDATE_PASSWORD) {
    return <Navigate to={ROUTES.UPDATE_PASSWORD} replace />;
  }

  return <Outlet />;
};

export const PublicRoute = () => {
  const { isAuthenticated, isFirstLogin } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    if (isFirstLogin) {
      return <Navigate to={ROUTES.UPDATE_PASSWORD} replace />;
    }
    const from = location.state?.from?.pathname || ROUTES.DASHBOARD;
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
};
