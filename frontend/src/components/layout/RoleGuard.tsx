import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';
import { ROLE_PATHS } from '@/types';
import { getAuthRedirectPath } from '@/lib/authRedirect';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleDashboardPath = `${ROLE_PATHS[user.role]}/dashboard`;
  const redirectPath = getAuthRedirectPath(user);

  // Redirect users who still have account preconditions before opening role pages.
  if (redirectPath !== roleDashboardPath && location.pathname !== redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  // Check role
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleDashboardPath} replace />;
  }

  return <>{children}</>;
}
